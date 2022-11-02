import { Request, Response } from "express"
import config                from "../../../config"
import { getRequestBaseURL } from "../../../lib"


/**
 * @see https://openid.net/specs/openid-connect-discovery-1_0.html
 */
export default function getWellKnownOpenidConfig(req: Request, res: Response) {

    const baseUrl = getRequestBaseURL(req);
    
    let prefix = `${baseUrl}/v/${req.params.fhir_release}`;
    if (req.params.sim) {
        prefix += `/sim/${req.params.sim}`;
    }
    
    const json = {

        // REQUIRED. URL using the https scheme with no query or fragment
        // component that the OP asserts as its Issuer Identifier. If Issuer
        // discovery is supported (see Section 2), this value MUST be identical 
        // to the issuer value returned by WebFinger. This also MUST be
        // identical to the iss Claim value in ID Tokens issued from this Issuer. 
        issuer: `${prefix}/fhir`,

        // REQUIRED. URL of the OPs JSON Web Key Set [JWK] document. This
        // contains the signing key(s) the RP uses to validate signatures from
        // the OP. The JWK Set MAY also contain the Server's encryption key(s), 
        // which are used by RPs to encrypt requests to the Server. When both
        // signing and encryption keys are made available, a use (Key Use)
        // parameter value is REQUIRED for all keys in the referenced JWK Set to
        // indicate each keys intended usage. Although some algorithms allow the
        // same key to be used for both signatures and encryption, doing so is
        // NOT RECOMMENDED, as it is less secure. The JWK x5c parameter MAY be
        // used to provide X.509 representations of keys provided. When used,
        // the bare key values MUST still be present and MUST match those in the
        // certificate.  
        jwks_uri: `${baseUrl}/keys`,

        // REQUIRED, URL to the OAuth2 authorization endpoint.
        authorization_endpoint: `${prefix}/auth/authorize`,

        // REQUIRED, URL to the OAuth2 token endpoint.
        token_endpoint: `${prefix}/auth/token`,

        // OPTIONAL, URL of the authorization server's introspection endpoint.	
        introspection_endpoint: `${prefix}/auth/introspect`,

        // REQUIRED. JSON array containing a list of the Subject Identifier
        // types that this OP supports. Valid types include pairwise and public. 
        subject_types_supported: [ "public" ],

        // REQUIRED. JSON array containing a list of the OAuth 2.0 response_type
        // values that this OP supports. Dynamic OpenID Providers MUST support
        // the `code`, `id_token`, and the `token id_token` Response Type values
        response_types_supported: [ "code", "id_token", "token id_token" ],

        // REQUIRED. JSON array containing a list of the JWS signing algorithms
        // (alg values) supported by the OP for the ID Token to encode the
        // Claims in a JWT [JWT]. The algorithm RS256 MUST be included. The value
        // none MAY be supported, but MUST NOT be used unless the Response Type
        // used returns no ID Token from the Authorization Endpoint (such as when
        // using the Authorization Code Flow).
        id_token_signing_alg_values_supported: config.supportedAlgorithms,

        // OPTIONAL. JSON array containing a list of Client Authentication methods
        // supported by this Token Endpoint. The options are `client_secret_post`,
        // `client_secret_basic`, `client_secret_jwt`, and `private_key_jwt`, as
        // described in Section 9 of OpenID Connect Core 1.0 [OpenID.Core]. Other
        // authentication methods MAY be defined by extensions. If omitted, the
        // default is `client_secret_basic` -- the HTTP Basic Authentication
        // Scheme specified in Section 2.3.1 of OAuth 2.0 [RFC6749].
        token_endpoint_auth_methods_supported: [
            "client_secret_basic", // for confidential apps
            "client_secret_post",  // for public apps
            "private_key_jwt"      // for asymmetric auth
        ],

        // OPTIONAL. JSON array containing a list of the JWS signing algorithms
        // (alg values) supported by the Token Endpoint for the signature on the
        // JWT [JWT] used to authenticate the Client at the Token Endpoint for
        // the private_key_jwt and client_secret_jwt authentication methods.
        // Servers SHOULD support RS256. The value none MUST NOT be used.
        token_endpoint_auth_signing_alg_values_supported: config.supportedAlgorithms
    };

    res.json(json);
}
