import crypto                from "crypto"
import { Request, Response } from "express"
import jwt, { JwtHeader }    from "jsonwebtoken"
import jose                  from "node-jose"
import fetch                 from "cross-fetch"
import { SMART }             from "../../.."
import config                from "../../config"
import ScopeSet              from "../../../src/isomorphic/ScopeSet"
import { decode }            from "../../../src/isomorphic/codec"
import {
    getRequestBaseURL,
    requireUrlencodedPost
} from "../../lib"
import {
    InvalidClientError,
    InvalidRequestError,
    InvalidScopeError,
    OAuthError
} from "../../errors"



export default class TokenHandler {

    protected request: Request;

    protected response: Response;

    protected baseUrl: string;

    protected constructor(req: Request, res: Response) {
        this.request = req;
        this.response = res;
        this.baseUrl = getRequestBaseURL(req)
    }

    /**
     * This is the typical public static entry point designed to be easy to use
     * as route handler. 
     */
    public static handle(req: Request, res: Response) {
        return new TokenHandler(req, res).handle();
    }

    /**
     * Validates that the request is form-urlencoded" POST and then uses the
     * grant_type parameter to pick the right flow
     */
    public async handle(): Promise<void> {
        const req = this.request;

        requireUrlencodedPost(req);

        switch (req.body.grant_type) {
            case "authorization_code":
                return await this.handleAuthorizationCode();
            case "refresh_token":
                return this.handleRefreshToken();
            case "client_credentials":
                return this.handleBackendServices();
            default:
                throw new OAuthError('Invalid or missing grant_type parameter "%s"', req.body.grant_type)
                    .errorId("unsupported_grant_type")
                    .status(400);
        }
    }

    public async handleBackendServices(): Promise<void> {
        
        const { scope, client_assertion, client_assertion_type } = this.request.body

        try {
            var launchOptions = decode(this.request.params.sim)
        } catch (ex) {
            throw new InvalidRequestError("Invalid launch options: " + ex)
        }

        // Require scope param
        if (!scope) {
            throw new InvalidClientError("Missing 'scope' parameter").status(400)
        }

        // Require client_assertion_type param
        if (!client_assertion_type) {
            throw new InvalidClientError("Missing 'client_assertion_type' parameter").status(400)
        }

        // Require client_assertion param
        if (!client_assertion) {
            throw new InvalidClientError("Missing 'client_assertion' parameter").status(400)
        }

        // Validate client_assertion_type param
        if (client_assertion_type !== "urn:ietf:params:oauth:client-assertion-type:jwt-bearer") {
            throw new InvalidClientError(
                "Invalid 'client_assertion_type' parameter. Must be " +
                "'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'."
            ).status(400)
        }

        const client: Partial<SMART.AuthorizationToken> = {
            accessTokensExpireIn: 600,
            scope: launchOptions.scope
        }
        
        const token = jwt.decode(client_assertion, { complete: true })
        
        await this.validateClientAssertion(client_assertion, launchOptions)

        if (launchOptions.auth_error === "token_invalid_token") {
            throw new InvalidClientError("Simulated invalid token error").status(401)
        }

        if (launchOptions.auth_error === "token_invalid_scope") {
            throw new InvalidScopeError("Simulated invalid scope error").status(401)
        }

        // Validate client_id
        if (launchOptions.client_id && token?.payload.sub !== launchOptions.client_id) {
            throw new InvalidClientError("Invalid 'client_id' (as sub claim of the assertion JWT)").status(401)
        }

        // Only use system scopes
        const invalidScopes = ScopeSet.getInvalidSystemScopes(scope)
        if (invalidScopes) {
            throw new InvalidScopeError(`Invalid scope(s) "%s" requested. Only system scopes are allowed.`, invalidScopes).status(401)
        }

        // Basic scope negotiation
        let grantedScopes = client.scope ? new ScopeSet(client.scope).negotiate(scope).grantedScopes : scope.trim().split(/\s+/);
        if (!grantedScopes.length) {
            throw new InvalidScopeError(`No scope(s) could be granted`).status(401)
        }

        const tokenResponse: SMART.AccessTokenResponse = {
            access_token : "",
            token_type   : "Bearer",
            expires_in   : client.accessTokensExpireIn,
            scope        : grantedScopes.join(" ")
        };

        const accessToken = {
            scope     : tokenResponse.scope,
            jwks_url  : launchOptions.jwks_url,
            jwks      : launchOptions.jwks,
            sim_error : ""
        }

        // Inject invalid token error (to be thrown while requesting FHIR data)
        if (launchOptions.auth_error === "request_invalid_token") {
            accessToken.sim_error = "Invalid token (simulated error)";
        }

        // Inject expired token error (to be thrown while requesting FHIR data)
        if (launchOptions.auth_error === "request_expired_token") {
            accessToken.sim_error = "Token expired (simulated error)";
        }

        // access_token
        tokenResponse.access_token = jwt.sign(accessToken, config.jwtSecret, { expiresIn: client.accessTokensExpireIn });

        this.response.set({ "Cache-Control": "no-store", "Pragma": "no-cache" });
        this.response.json(tokenResponse);
    }

    /**
     * Handles the common authorization requests. Parses and validates
     * token from request.body.code and eventually calls this.finish() with it.
     */
    public async handleAuthorizationCode(): Promise<void> {
        const payload = this.request.body as SMART.Request.AuthorizationCode

        const {
            code,
            redirect_uri,
            code_verifier,
            client_assertion,
            client_assertion_type
        } = payload

        // Require code param
        if (!code) {
            throw new InvalidClientError("Missing 'code' parameter").status(400)
        }

        // Require redirect_uri param
        if (!redirect_uri) {
            throw new InvalidRequestError("Missing 'redirect_uri' parameter").status(400)
        }

        // Verify code
        try {
            var authorizationToken = jwt.verify(code, config.jwtSecret) as SMART.AuthorizationToken
        } catch (ex) {
            throw new InvalidClientError("Invalid token (supplied as code parameter in the POST body). %s", (ex as Error).message).status(401)
        }

        // Require authorizationToken.redirect_uri
        if (!authorizationToken.redirect_uri) {
            throw new InvalidClientError("The authorization token must include redirect_uri").status(401);
        }

        // Require authorizationToken.redirect_uri to equal payload.redirect_uri
        if (authorizationToken.redirect_uri !== redirect_uri) {
            throw new InvalidRequestError("Invalid redirect_uri parameter").status(401);
        }

        // If the client is using PKCE
        if (authorizationToken.code_challenge_method || authorizationToken.pkce === "always") {

            // We support only 'S256'
            if (authorizationToken.code_challenge_method !== 'S256') {
                throw new InvalidRequestError(
                    "Unsupported code_challenge_method '%s'. We support only 'S256'",
                    authorizationToken.code_challenge_method
                ).status(400)
            }

            // Require code_verifier param
            if (!code_verifier) {
                throw new InvalidRequestError("Missing code_verifier parameter").status(400)
            }

            // Verify code_challenge
            const hash = crypto.createHash('sha256');
            hash.update(code_verifier);
            const code_challenge = jose.util.base64url.encode(hash.digest());
            if (code_challenge !== authorizationToken.code_challenge) {
                throw new OAuthError(
                    "Invalid grant or Invalid PKCE Verifier, '%s' vs '%s'.",
                    code_challenge,
                    authorizationToken.code_challenge
                ).status(401).errorId("invalid_grant")
            }
        }

        // console.log(authorizationToken, client_assertion)
        // Validate asymmetric authorization
        if (client_assertion && client_assertion_type === "urn:ietf:params:oauth:client-assertion-type:jwt-bearer") {
            await this.validateClientAssertion(client_assertion, authorizationToken)
        }

        return this.finish(authorizationToken);
    }

    /**
     * The FHIR authorization server SHALL validate the JWT according to the
     * processing requirements defined in Section 3 of RFC7523
     * (https://www.rfc-editor.org/rfc/rfc7523#section-3) including validation
     * of the signature on the JWT.
     */
    public async validateClientAssertion(clientAssertion: string, client: Partial<SMART.AuthorizationToken>): Promise<void> {
        
        // client_assertion must be a token ------------------------------------
        try {
            var {
                header: jwtHeaders,
                payload: token
            } = jwt.decode(clientAssertion, { complete: true, json: true }) as {
                header: JwtHeader
                payload: Record<string, any>
            }
        } catch {
            throw new InvalidRequestError('Could not decode the "client_assertion" parameter').status(401)
        }

        // if (client.validation === 1) {
        //     if (!client.client_id) {
        //         throw new InvalidClientError("The client has no client_id defined").status(401)
        //     }

        //     if (!client.scope) {
        //         throw new InvalidClientError("The client has no scopes allowed").status(401)
        //     }

        //     if (!client.jwks && !client.jwks_url) {
        //         throw new InvalidClientError(`The client has neither jwks_url nor jwks defined`).status(401)
        //     }
        // }


        // Check required token claims and headers -----------------------------
        if (!token.iss) { // client_id
            throw new InvalidClientError("Missing token 'iss' claim").status(401)
        }
        if (!token.sub) { // client_id
            throw new InvalidClientError("Missing token 'sub' claim").status(401)
        }
        if (!token.aud) { // token url
            throw new InvalidClientError("Missing token 'aud' claim").status(401)
        }
        if (!token.exp) {
            throw new InvalidClientError("Missing token 'exp' claim").status(401)
        }
        if (!token.jti) {
            throw new InvalidClientError("Missing token 'jti' claim").status(401)
        }
        if (jwtHeaders.typ !== "JWT") {
            throw new InvalidClientError("Invalid token 'typ' header. Must be 'JWT'.").status(401)
        }
        if (!jwtHeaders.kid) {
            throw new InvalidClientError("Missing token 'kid' header").status(401)
        }
        if (!jwtHeaders.alg) {
            throw new InvalidClientError("Missing token 'alg' header").status(401)
        }

        // simulated errors ----------------------------------------------------
        if (client.auth_error === "token_expired_registration_token") {
            throw new InvalidClientError("Simulated expired token error").status(401)
        }
        if (client.auth_error === "token_invalid_jti") {
            throw new InvalidClientError("Simulated invalid 'jti' value").status(401);
        }

        // TODO: ensure that the client_id provided is known and matches the
        // JWT’s iss claim.

        // TODO: Do we need real jti validation? Check that the jti value has
        // not been previously encountered for the given iss within the maximum
        // allowed authentication JWT lifetime (e.g., 5 minutes). This check
        // prevents replay attacks.

        // token.iss should be the same as token.sub
        if (token.iss !== token.sub) {
            throw new InvalidClientError("The token sub does not match the token iss claim").status(401)
        }

        // token.aud should be the token url but can use different protocol
        const aud = this.baseUrl + this.request.originalUrl;
        if (aud.replace(/^https?/, "") !== token.aud.replace(/^https?/, "")) {
            throw new InvalidClientError(
                "Invalid token 'aud' value (%s). Must be '%s'.",
                token.aud,
                aud
            ).status(401)
        }

        

        // If neither jwks nor jwks_uri is set in "App Registration Options",
        // disable client authn checks. Just make sure a well-formed JWS is
        // present in the client assertion, and consider it "valid" if so.
        // (This is similar to how we disable client authn checks for symmetric
        // authn, if no client secret is set in app registration.)
        if (!client.jwks_url && !client.jwks) {
            // if (client.validation === 1) {
            //     throw new InvalidClientError(`The client has neither jwks_url nor jwks defined`)
            // }
            return;
        }

        // if (client.validation === 1) {
            // Build a set of "allowed keys" as the union of all keys in jwks and
            // all keys in jwks_uri
            // ---------------------------------------------------------------------
            const unionJWKS: { keys: any[] } = { keys: [] };

            if (client.jwks_url) {
                let jwks = await this.fetchJwks(client.jwks_url);
                // jwks.keys = removeDuplicateKeys(jwks.keys);
                this.validateJwks(jwks)
                unionJWKS.keys.push(...jwks.keys)
            }

            if (client.jwks) {
                let jwks;
                if (typeof client.jwks === "string") {
                    try {
                        jwks = JSON.parse(client.jwks)
                    } catch {
                        throw new InvalidClientError("Invalid JWKS json").status(401)
                    }
                } else {
                    jwks = client.jwks
                }
                // jwks.keys = removeDuplicateKeys(jwks.keys);
                this.validateJwks(jwks)
                unionJWKS.keys.push(...jwks.keys)
            }

            // Check whether the JWS is valid and signed with one of the allowed keys
            // ---------------------------------------------------------------------
            const key = await this.pickPublicKey(unionJWKS.keys, jwtHeaders.kid, jwtHeaders.alg)

            try {
                jwt.verify(clientAssertion, key.toPEM(), { algorithms: config.supportedAlgorithms as jwt.Algorithm[] });
            } catch (ex) {
                throw new InvalidClientError("Invalid token. %s", (ex as Error).message).status(401)
            }

            // If jku is present as a JWS header, check that an identical jwks_uri
            // was included in "App Registration" options, because
            // https://hl7.org/fhir/smart-app-launch/client-confidential-asymmetric.html
            // says: "When present, this SHALL match the JWKS URL value that the
            // client supplied to the FHIR authorization server at client registration
            // time."
            // ---------------------------------------------------------------------
            if (jwtHeaders.jku && jwtHeaders.jku !== client.jwks_url) {
                throw new InvalidRequestError("Invalid jku header of the assertion token token. must be '%s'", client.jwks_url).status(401)
            }
        // }
    }

    protected async fetchJwks(url: string): Promise<SMART.JWKS> {
        try {
            const res = await fetch(url, { headers: { accept: "application/json" } })
            if (!res.ok) {
                throw new Error(res.status + " " + res.statusText)
            }
            return await res.json();
        } catch (ex) {
            throw new InvalidClientError("Failed to fetch JWKS from %s. %s", url, (ex as Error).message).status(401)
        }
    }

    protected validateJwks(jwks: any) {
        if (!jwks || typeof jwks !== "object" || Array.isArray(jwks)) {
            throw new InvalidClientError('JWKS is not an object').status(401);
        }
        if (!jwks.hasOwnProperty("keys")) {
            throw new InvalidClientError('JWKS does not have a "keys" property').status(401);
        }
        if (!Array.isArray(jwks.keys)) {
            throw new InvalidClientError('jwks.keys must be an array').status(401);
        }
    }

    /**
     * Identify a set of candidate keys by filtering the potential keys to
     * identify the single key where the kid matches the value supplied in
     * the client's JWT header, and the kty is consistent with the signature
     * algorithm supplied in the client's JWT header (e.g., RSA for a JWT using
     * an RSA-based signature, or EC for a JWT using an EC-based signature).
     * @param keys Array of JWK keys
     * @param kid The `kid` we are looking for
     * @param alg The `alg` we are using
     */
    protected async pickPublicKey(keys: JsonWebKey[], kid: string, alg: string)
    {
        if (!keys.length) {
            throw new InvalidClientError('No usable keys found').status(401);
        }

        // let _keys = keys.filter(k => Array.isArray(k.key_ops));

        // if (!_keys.length) {
        //     throw new InvalidClientError('None of the keys found in the JWKS have the key_ops array property').status(401);
        // }

        let _keys = keys.filter(k => k.alg === alg);

        if (!_keys.length) {
            throw new InvalidClientError('None of the keys found in the JWKS have alg equal to %s', alg).status(401);
        }

        // @ts-ignore
        _keys = _keys.filter(k => k.kid === kid);

        if (!_keys.length) {
            throw new InvalidClientError('None of the keys found in the JWKS have kid equal to %s', kid).status(401);
        }

        // @ts-ignore
        _keys = _keys.filter(k => !k.key_ops?.includes("sign"));

        // If no keys match the verification fails.
        if (!_keys.length) {
            throw new InvalidClientError('No usable public keys found in the JWKS').status(401);
        }

        // Filter duplicate keys (by kid)
        // _keys = removeDuplicateKeys(_keys);
        // console.log(_keys)

        // If more than one key matches, the verification fails.
        if (_keys.length > 1) {
            throw new InvalidClientError('Multiple usable public keys found in the JWKS').status(401);
        }

        try {
            return await jose.JWK.asKey(_keys[0], "json")
        } catch (ex) {
            throw new InvalidClientError('No usable public key found in the JWKS. %s', ex).status(401);
        }
    }

    /**
     * Handles the refresh_token authorization requests. Parses and validates
     * token from request.body.refresh_token and eventually calls this.finish()
     * with it.
     */
    public handleRefreshToken(): void {
        try {
            var token: any = jwt.verify(this.request.body.refresh_token, config.jwtSecret)
        } catch (ex) {
            throw new OAuthError("Invalid refresh token").errorId("invalid_grant").status(401)
        }

        if (token.auth_error === "token_expired_refresh_token") {
            throw new OAuthError("Expired refresh token").errorId("invalid_grant").status(403)
        }

        return this.finish(token);
    }

    public validateBasicAuth(authorizationToken: SMART.AuthorizationToken): void {

        // Simulate invalid client secret error
        if (authorizationToken.auth_error === "auth_invalid_client_secret") {
            throw new InvalidClientError("Simulated invalid client secret error").status(401)
        }

        const secret = authorizationToken.client_secret
        
        if (secret) {
            const authHeader = String(this.request.headers.authorization || "").trim();

            if (!authHeader || authHeader.search(/^basic\s*/i) !== 0) {
                throw new InvalidRequestError("Basic authentication is required for confidential clients").status(401)
            }

            let auth: string | string[] = authHeader.replace(/^basic\s*/i, "")

            // Check for empty auth
            if (!auth) {
                throw new InvalidRequestError("The authorization header '%s' cannot be empty", authHeader).status(401)
            }

            // base64 decode and split
            auth = Buffer.from(auth, "base64").toString().split(":")

            // Check for bad auth syntax
            if (auth.length !== 2) {
                throw new InvalidRequestError("The decoded header must contain '{client_id}:{client_secret}'").status(401)
            }

            if (authorizationToken.client_id && authorizationToken.client_id !== auth[0]) {
                throw new InvalidClientError("Invalid client_id in the basic auth header").status(401)
            }

            if (secret !== auth[1]) {
                throw new InvalidClientError("Invalid client_secret in the basic auth header").status(401)
            }
        }
    }

    /**
     * Generates the id token that is included in the response if needed
     * @param {Object} clientDetailsToken
     * @see https://openid.net/specs/openid-connect-core-1_0.html#IDToken
     */
    public createIdToken(clientDetailsToken: SMART.AuthorizationToken): string {
        // let secure = this.request.secure || this.request.headers["x-forwarded-proto"] == "https";
        // let iss    = config.baseUrl.replace(/^https?/, secure ? "https" : "http");
        let iss = `${this.baseUrl}${this.request.baseUrl}/fhir`
        let payload = {
            profile: clientDetailsToken.user,
            fhirUser: clientDetailsToken.user,
            aud: clientDetailsToken.client_id,
            sub: crypto.createHash('sha256').update(clientDetailsToken.user!).digest('hex'),
            iss
        };

        // // Reflect back the nonce if it was provided in the original Authentication
        // // Request.
        // let { nonce } = clientDetailsToken;
        // if (nonce) {
        //     payload.nonce = nonce;
        // }

        return jwt.sign(payload, config.privateKeyAsPem, {
            algorithm: "RS256",
            expiresIn: `${(clientDetailsToken.accessTokensExpireIn || 60)} minutes`
        });
    }

    public generateRefreshToken(code: SMART.AuthorizationToken): string {
        let token = {
            context: code.context,
            // client_id : code.client_id,
            scope: code.scope,
            user: code.user,
            // iat       : code.iat,
            auth_error: code.auth_error
        };

        return jwt.sign(token, config.jwtSecret, {
            expiresIn: +config.refreshTokenLifeTime * 60
        });
    }

    /**
     * Generates and sends the response
     */
    public finish(authorizationToken: SMART.AuthorizationToken) {

        const res = this.response;

        if (authorizationToken.client_type === "confidential-symmetric") {
            this.validateBasicAuth(authorizationToken)
        }

        if (authorizationToken.auth_error === "token_invalid_token") {
            throw new InvalidClientError("Simulated invalid client error").status(401)
        }

        const scope = new ScopeSet(decodeURIComponent(authorizationToken.scope));

        const expiresIn = authorizationToken.accessTokensExpireIn ?
            authorizationToken.accessTokensExpireIn * 60 :
            +config.accessTokenLifetime * 60;

        const tokenResponse: SMART.AccessTokenResponse = {
            access_token : "",
            token_type   : "Bearer",
            expires_in   : expiresIn,
            scope        : authorizationToken.scope,
            id_token     : authorizationToken.user && scope.has("openid") && (scope.has("profile") || scope.has("fhirUser")) ? 
                this.createIdToken(authorizationToken) :
                undefined,
            refresh_token: scope.has('offline_access') || scope.has('online_access') ?
                this.generateRefreshToken(authorizationToken) :
                undefined,
            ...authorizationToken.context
        };

        // Inject invalid authorization token error (to be thrown while
        // requesting FHIR data)
        if (authorizationToken.auth_error === "request_invalid_token") {
            tokenResponse.sim_error = "Invalid token";
        }

        // Inject expired authorization token error (to be thrown while
        // requesting FHIR data)
        else if (authorizationToken.auth_error === "request_expired_token") {
            tokenResponse.sim_error = "Token expired";
        }

        // access_token - includes settings that might be needed for refresh
        tokenResponse.access_token = jwt.sign({
            scope                : authorizationToken.scope,
            jwks_url             : authorizationToken.jwks_url,
            jwks                 : authorizationToken.jwks,
            code_challenge_method: authorizationToken.code_challenge_method,
            code_challenge       : authorizationToken.code_challenge,
            client_secret        : authorizationToken.client_secret,
            nonce                : authorizationToken.nonce,
            auth_error           : authorizationToken.auth_error
        }, config.jwtSecret, { expiresIn });

        // The authorization servers response must include the HTTP
        // Cache-Control response header field with a value of no-store,
        // as well as the Pragma response header field with a value of no-cache.
        res.set({ "Cache-Control": "no-store", "Pragma": "no-cache" });

        res.json(tokenResponse);
    }
}

