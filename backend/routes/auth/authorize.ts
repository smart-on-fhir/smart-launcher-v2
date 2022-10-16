import { SMART } from "../../.."
import jwt           from "jsonwebtoken"
import LaunchOptions from "../../../src/isomorphic/LaunchOptions"
import ScopeSet      from "../../../src/isomorphic/ScopeSet"
import config        from "../../config"
import { getRequestBaseURL, humanizeArray, requireUrlencodedPost } from "../../lib"
import { Request, Response } from "express"
import { InvalidClientError, InvalidRequestError, InvalidScopeError, OAuthError } from "../../errors"


export interface AuthorizeParams {

    response_type: "code" | "token"
    client_id: string
    redirect_uri: string
    launch?: string
    scope: string
    state: string
    aud: string

    code_challenge_method?: "S256"
    code_challenge?: string
    
    // These can be set by dialogs
    patient?: string
    provider?: string
    encounter?: string
    auth_success?: "0" | "1"
    login_success?: string
    // aud_validated?: string
}


export default class AuthorizeHandler {

    protected request: SMART.AuthorizeRequest;

    protected response: Response;

    protected params: AuthorizeParams;

    protected launchOptions: LaunchOptions;

    protected baseUrl: string;

    protected scope: ScopeSet;

    public static handle(req: Request, res: Response)
    {
        if (req.method === "POST") {
            requireUrlencodedPost(req)
        }

        const params: AuthorizeParams = req.method === "POST" ? req.body : req.query

        try {
            var launchOptions = new LaunchOptions(String(params.launch || "") || req.params.sim || "")
        } catch (ex) {
            throw new InvalidRequestError("Invalid launch options: " + ex)
        }

        switch (params.response_type) {

            // requesting an authorization code
            case "code":
                const instance = new AuthorizeHandler(req, res, params, launchOptions)
                return instance.authorize();

            // requesting an access token (implicit grant)
            // case "token":
            //     throw new OAuthError('Invalid Authorization Grant "%s"', params.response_type)
            //         .errorId("unsupported_grant_type")
            //         .status(400);

            // missing response_type
            case void 0:
                throw new OAuthError('Missing response_type parameter')
                    .errorId("invalid_request")
                    .status(400);
            
            // invalid response_type
            default:
                throw new OAuthError('Invalid Authorization Grant "%s"', params.response_type)
                    .errorId("unsupported_grant_type")
                    .status(400);
        }
    }

    public constructor(req: Request, res: Response, params: AuthorizeParams, launchOptions: LaunchOptions)
    {
        this.request       = req as unknown as SMART.AuthorizeRequest
        this.response      = res
        this.params        = params
        this.launchOptions = launchOptions
        this.baseUrl       = getRequestBaseURL(req)
        this.scope         = new ScopeSet(decodeURIComponent(params.scope));
    }

    /**
     * This is used to intercept the authorize flow by redirecting to intermediate
     * page for logging in, selecting a patient, etc. Those pages will then
     * redirect back here.
     * @param to The pathname to redirect to
     * @param query Custom parameters (if any)
     */
    public redirect(to: string, query: Record<string, any> = {}): void {

        // In development the frontend is served by Webpack Dev Server and
        // is available on different port than the backend endpoints. In
        // production backend and frontend share the same origin.
        const origin = process.env.NODE_ENV === "development" ?
            "http://localhost:8444" : // TODO: make this dynamic
            this.baseUrl;

        const url = new URL(to, origin /*+ req.originalUrl*/)

        // Make sure we preserve all the authorize params by passing them
        // to the redirect url. Then, the tools at that url should pass them
        // back here
        for (let p in this.params) {
            if (this.params[p as keyof AuthorizeParams] !== undefined) {
                url.searchParams.set(p, this.params[p as keyof AuthorizeParams] + "")
            }
        }

        // Now add any custom params
        for (let p in query) {
            if (query[p] || query[p] === 0) {
                url.searchParams.set(p, query[p])
            }
        }

        return this.response.redirect(url.href);
    }

    /**
     * Decides if a patient login screen needs to be displayed 
     */
    public needToLoginAsPatient(): boolean {

        const { launch_type, patient, skip_login } = this.launchOptions;

        // This is only applicable for patient-portal and patient-standalone launch
        if (launch_type !== "patient-portal" && launch_type !== "patient-standalone") {
            return false;
        }

        // No patients selected but we need some
        if (!patient.size()) {
            return true;
        }

        // Multiple patients selected and we need one
        if (patient.size() > 1) {
            return true;
        }

        // One patient selected - skip login if preferred
        return !skip_login;
    }

    /**
     * Decides if a provider login screen needs to be displayed  
     */
    public needToLoginAsProvider(): boolean {

        const { scope, launchOptions: { launch_type, provider }} = this;

        // In patient-standalone launch the patient is the user
        if (launch_type === "patient-standalone" || launch_type === "patient-portal") {
            return false;
        }

        // Require "openid" scope
        if (!scope.has("openid")) {
            return false;
        }

        // Require "profile" or "fhirUser" scope
        if (!(scope.has("profile") || scope.has("fhirUser"))) {
            return false;
        }

        // If single provider is selected show login if skip_login is not set
        if (provider.size() === 1) {
            return false;
        }

        // If multiple providers are selected show login to pick one of them
        return true;
    }

    /**
     * Decides if an encounter picker needs to be displayed 
     */
    public needToPickEncounter(): boolean {
        
        const { scope, launchOptions: { launch_type, encounter }} = this;

        // Already selected
        if (encounter && encounter !== "AUTO" && encounter !== "MANUAL") {
            return false;
        }

        // Only if launch or launch/encounter scope is requested
        if (!scope.has("launch") && !scope.has("launch/encounter")) {
            return false;
        }

        // N/A to standalone launches unless configured otherwise
        if (launch_type === "provider-standalone" || launch_type === "patient-standalone") {
            return config.includeEncounterContextInStandaloneLaunch;
        }

        return true;
    }

    /**
     * Decides if a patient picker needs to be displayed 
     */
    public needToPickPatient(): boolean {

        const { scope, launchOptions: { launch_type, patient }} = this;

        // No - if already have one patient selected
        if (patient.size() === 1) {            
            return false;
        }

        if (launch_type === "provider-standalone") {
            return scope.has("launch/patient");
        }

        if (launch_type === "provider-ehr") {
            return scope.has("launch/patient") || scope.has("launch");
        }

        // if (launch_type === "cds-hooks") {
        //     return scope.has("launch/patient") || scope.has("launch");
        // }

        return false
    }

    /**
     * Decides if the authorization page needs to be displayed 
     */
    public needToAuthorize(): boolean {

        const { launch_type, skip_auth } = this.launchOptions;

        if (skip_auth) {
            return false;
        }

        return (
            launch_type === "provider-standalone" ||
            launch_type === "patient-standalone"  ||
            launch_type === "patient-portal"
        );
    }

    public renderProviderLogin(): void {
        this.redirect("/provider-login", {
            provider: this.launchOptions.provider.toString(),
            login_type: "provider"
        });
    }
    
    public renderPatientLogin(): void {
        this.redirect("/patient-login", {
            patient: this.launchOptions.patient.toString(),
            login_type: "patient"
        });
    }
    
    public renderEncounterPicker(): void {
        this.redirect("/select-encounter", {
            patient: this.launchOptions.patient.toString(),
            select_first: this.launchOptions.encounter === "AUTO"
        });
    }
    
    public renderPatientPicker(): void {
        this.redirect("/select-patient", {
            patient: this.launchOptions.patient.toString()
        });
    }
    
    public renderApprovalScreen(): void {
        this.redirect("/authorize-app", {
            patient: this.launchOptions.patient.toString()
        });
    }

    /**
     * Creates and returns the signed JWT code that contains some authorization
     * details.
     */
    public createAuthCode(): string {
        
        const { params, launchOptions } = this

        const scope = new ScopeSet(decodeURIComponent(this.params.scope));
        
        const code: SMART.AuthorizationToken = {
            context: {
                need_patient_banner: !launchOptions.sim_ehr,
                smart_style_url: this.baseUrl + "/smart-style.json",
            },
            client_id   : params.client_id,
            redirect_uri: params.redirect_uri + "",
            scope       : params.scope,
            // sde         : sim.sde,
        };

        // Add client_secret to the client token (to be used later)
        if (launchOptions.client_secret) {
            code.client_secret = launchOptions.client_secret
        }

        // code_challenge_method and code_challenge
        if (params.code_challenge_method) {
            code.code_challenge_method = params.code_challenge_method
            code.code_challenge        = params.code_challenge
        }

        // jwks_url
        if (launchOptions.jwks_url) {
            code.jwks_url = launchOptions.jwks_url
        }

        // jwks
        if (launchOptions.jwks) {
            code.jwks = launchOptions.jwks
        }

        // auth_error
        if (launchOptions.auth_error) {
            code.auth_error = launchOptions.auth_error;
        }

        // patient
        if (launchOptions.patient.size() === 1) {
            if (scope.has("launch") || scope.has("launch/patient")) {
                code.context.patient = launchOptions.patient.get(0);
            }
        }

        // encounter
        if (launchOptions.encounter) {
            if (scope.has("launch") || scope.has("launch/encounter")) {
                code.context.encounter = launchOptions.encounter;
            }
        }

        // user
        if (scope.has("openid") && (scope.has("profile") || scope.has("fhirUser"))) {
            
            // patient as user
            if (launchOptions.launch_type === "patient-standalone" ||
                launchOptions.launch_type === "patient-portal") {
                if (launchOptions.patient.size() === 1) {
                    code.user = `Patient/${launchOptions.patient.get(0)}`;
                }
            }

            // provider as user
            else {
                if (launchOptions.provider.size() === 1) {
                    code.user = `Practitioner/${launchOptions.provider.get(0)}`;
                }
            }
        }

        // Add nonce, if provided, so it can be reflected back in the subsequent
        // token request.
        // if (nonce) {
        //     code.nonce = nonce;
        // }

        return jwt.sign(code, config.jwtSecret, { expiresIn: "5m" });
    }

    public validateAuthorizeRequest(): void
    {
        const { params, request } = this

        // User decided not to authorize the app launch
        if (params.auth_success === "0") {
            throw new InvalidRequestError("Unauthorized").status(401)
        }

        // Assert that the redirect_uri param is present
        if (!("redirect_uri" in params)) {
            throw new InvalidRequestError("Missing %s parameter", "redirect_uri").status(400)
        }

        // Assert that the aud param is present
        if (!("aud" in params)) {
            throw new InvalidRequestError("Missing %s parameter", "aud")
        }

        // bad_redirect_uri if we cannot parse it
        try {
            new URL(decodeURIComponent(params.redirect_uri));
        } catch (ex) {
            throw new InvalidRequestError("Bad redirect_uri: %s. %s.", params.redirect_uri, (ex as Error).message).status(400)
        }

        // The "aud" param must match the apiUrl (but can have different protocol)
        // console.log(req.url, req.baseUrl)
        const apiUrl = new URL(request.baseUrl.replace(/\/auth.*$/, "/fhir"), this.baseUrl)
        const apiUrlHref = apiUrl.href

        let audUrl: URL        
        try {
            audUrl = new URL(params.aud)
        } catch (ex) {
            throw new InvalidRequestError('Bad audience value "%s". %s.', params.aud, (ex as Error).message)
        }

        apiUrl.protocol = "https:"
        audUrl.protocol = "https:"

        apiUrl.hostname = apiUrl.hostname.replace(/^:\/\/localhost/, "://127.0.0.1")
        audUrl.hostname = apiUrl.hostname.replace(/^:\/\/localhost/, "://127.0.0.1")

        if (apiUrl.href !== audUrl.href) {
            throw new InvalidRequestError('Bad audience value "%s". Expected "%s".', params.aud, apiUrlHref)
        }

        // code_challenge_method must be 'S256' if set
        if (params.code_challenge_method && params.code_challenge_method !== 'S256') {
            throw new InvalidRequestError("Invalid code_challenge_method. Must be S256.")
        }

        // code_challenge required if code_challenge_method is set
        if (params.code_challenge_method && !params.code_challenge) {
            throw new InvalidRequestError("Missing code_challenge parameter")
        }
    }

    /**
     * The client constructs the request URI by adding the following
     * parameters to the query component of the authorization endpoint URI
     * using the "application/x-www-form-urlencoded" format:
     * 
     * - `response_type` REQUIRED
     * - `client_id`     REQUIRED
     * - `redirect_uri`  OPTIONAL
     * - `scope`         OPTIONAL
     * - `state`         RECOMMENDED
     *
     * The authorization server validates the request to ensure that all
     * required parameters are present and valid.  If the request is valid,
     * the authorization server authenticates the resource owner and obtains
     * an authorization decision (by asking the resource owner or by
     * establishing approval via other means).
     * 
     * In our case the client_id is in fact a token, which when decoded contains
     * information about the registered client (we can be stateless this way).
     * Additionally, some launch preferences are sent via `sim` url segment or
     * `launch` query parameter.
     */
    public authorize()
    {
        const { params, launchOptions } = this

        this.validateAuthorizeRequest();

        // Handle response from dialogs
        if (params.patient      ) launchOptions.patient.set(params.patient);
        if (params.provider     ) launchOptions.provider.set(params.provider);
        if (params.encounter    ) launchOptions.encounter  = params.encounter;
        if (params.auth_success ) launchOptions.skip_auth  = true;
        if (params.login_success) launchOptions.skip_login = true;
        // if (authorizeParams.aud_validated) launchOptions.aud_validated = true;


        // Simulate auth_invalid_client_id error if requested
        if (launchOptions.auth_error == "auth_invalid_client_id") {
            throw new InvalidClientError("Simulated invalid client_id parameter error")
        }

        // Simulate auth_invalid_redirect_uri error if requested
        if (launchOptions.auth_error == "auth_invalid_redirect_uri") {
            throw new InvalidRequestError("Simulated invalid redirect_uri parameter error")
        }

        // Simulate auth_invalid_scope error if requested
        if (launchOptions.auth_error == "auth_invalid_scope") {
            throw new InvalidScopeError("Simulated invalid scope error")
        }

        // If a client_id is specified in launch options make sure it matches
        if (launchOptions.client_id && launchOptions.client_id !== params.client_id) {
            throw new InvalidClientError('Invalid client_id "%s". Expected "%s".', params.client_id, launchOptions.client_id)
        }

        // If scopes are specified in launch options, validate the requested scopes
        if (launchOptions.scope && params.scope) {
            const grantedScopeSet = new ScopeSet(launchOptions.scope)
            const { rejectedScopes } = grantedScopeSet.negotiate(params.scope)

            if (rejectedScopes.length) {
                throw new InvalidScopeError(
                    `Scope${ rejectedScopes.length > 1 ? "s" : "" } %s could not be granted. Your client is allowed to request %s.`,
                    humanizeArray(rejectedScopes, true),
                    humanizeArray(grantedScopeSet.scopes, true)
                )
            }
        }

        // If redirect_uris is specified in launch options, validate that
        if (launchOptions.redirect_uris) {
            const urls = launchOptions.redirect_uris.trim().split(/\s*,\s*/).map(s => {
                try {
                    return new URL(s)
                } catch (e) {
                    throw new InvalidClientError(`Invalid redirect_uris entry %s. %s`, s, e)
                }
            });

            if (!urls.some(u => {
                const url = new URL(params.redirect_uri);
                return (url.origin + url.pathname).startsWith(u.origin + u.pathname);
            })) {
                throw new InvalidRequestError(`Invalid redirect_uri`)
            }
        }

        // PATIENT LOGIN SCREEN
        if (this.needToLoginAsPatient()) {
            return this.renderPatientLogin();
        }

        // PROVIDER LOGIN SCREEN
        if (this.needToLoginAsProvider()) {
            return this.renderProviderLogin();
        }

        // PATIENT PICKER
        if (this.needToPickPatient()) {
            return this.renderPatientPicker();
        }

        // ENCOUNTER
        if (this.needToPickEncounter()) {
            return this.renderEncounterPicker()
        }

        // AUTH SCREEN
        if (this.needToAuthorize()) {
            return this.renderApprovalScreen();
        }

        // LAUNCH!
        const RedirectURL = new URL(decodeURIComponent(params.redirect_uri));
        RedirectURL.searchParams.set("code", this.createAuthCode());
        if (params.state) {
            RedirectURL.searchParams.set("state", params.state);
        }
        this.response.redirect(RedirectURL.href);
    }
}
