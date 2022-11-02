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
        subject_types_supported: [
            "public"
        ],

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

        // "token_endpoint_auth_methods_supported": ["client_secret_basic", "private_key_jwt"],
        // "token_endpoint_auth_signing_alg_values_supported": ["RS256", "ES256"],
        // "userinfo_endpoint": "https://server.example.com/connect/userinfo",
        // "check_session_iframe": "https://server.example.com/connect/check_session",
        // "end_session_endpoint": "https://server.example.com/connect/end_session",
        // "registration_endpoint":"https://server.example.com/connect/register",
        // "scopes_supported":["openid", "profile", "email", "address","phone", "offline_access"],
        // "acr_values_supported":["urn:mace:incommon:iap:silver","urn:mace:incommon:iap:bronze"],
        // "userinfo_signing_alg_values_supported":["RS256", "ES256", "HS256"],
        // "userinfo_encryption_alg_values_supported":["RSA1_5", "A128KW"],
        // "userinfo_encryption_enc_values_supported":["A128CBC-HS256", "A128GCM"],
        // "id_token_encryption_alg_values_supported":["RSA1_5", "A128KW"],
        // "id_token_encryption_enc_values_supported":["A128CBC-HS256", "A128GCM"],
        // // "request_object_signing_alg_values_supported":["none", "RS256", "ES256"],
        // // "display_values_supported":["page", "popup"],
        // // "claim_types_supported":["normal", "distributed"],
        // "claims_supported":["sub", "iss", "auth_time", "acr","name", "given_name", "family_name", "nickname","profile", "picture", "website","email", "email_verified", "locale", "zoneinfo","http://example.info/claims/groups"],
        // // "claims_parameter_supported":true,
        // // "service_documentation":"http://server.example.com/connect/service_documentation.html",
        // // "ui_locales_supported":["en-US", "en-GB", "en-CA", "fr-FR", "fr-CA"]

    };

    res.json(json);
}
