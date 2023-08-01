import { Request } from "express-serve-static-core"

declare global {
    var ENV: {
        NODE_ENV           : string
        PICKER_ORIGIN      : string
        GOOGLE_ANALYTICS_ID: string
        FHIR_SERVER_R2     : string
        FHIR_SERVER_R3     : string
        FHIR_SERVER_R4     : string
        ACCESS_TOKEN       : string
        VERSION            : string
        COMMIT             : string
    }
}

declare namespace SMART {

    /**
     * All the launch types that we recognize
     */
    type LaunchType = "provider-ehr" | "patient-portal" | "provider-standalone" | "patient-standalone" | "backend-service"; //| "cds-hooks";

    type SimulatedError = 

        // authorize request ---------------------------------------------------
        "auth_invalid_client_id" |
        "auth_invalid_redirect_uri" |
        "auth_invalid_scope" |
        "auth_invalid_client_secret" |

        // token request -------------------------------------------------------
        "token_invalid_token" |
        "token_expired_refresh_token" |
        "token_expired_registration_token" |
        "token_invalid_scope" |
        "token_invalid_jti" |
        
        // FHIR requests -------------------------------------------------------
        "request_invalid_token" |
        "request_expired_token";

    interface JWKS {
        keys: JsonWebKey[]
    }

    type SMARTClientType = "public" | "confidential-symmetric" | "confidential-asymmetric" | "backend-service"

    type PKCEValidation = "none" | "auto" | "always"

    /**
     * All the possible launch parameters. Only `launch_type` is required and
     * everything else is optional.
     */
    interface LaunchParams {
        launch_type: LaunchType
        patient?: string
        provider?: string
        encounter?: string
        skip_login?: boolean
        skip_auth?: boolean
        sim_ehr?: boolean
        scope?: string
        redirect_uris?: string
        client_id?: string
        client_secret?: string
        auth_error?: SimulatedError
        jwks_url?: string
        jwks?: string
        pkce?: PKCEValidation
        client_type?: SMARTClientType
        fhirContextStr?: string
    }

    interface AuthorizeParams {
        response_type: "code" | "token"
        client_id: string
        redirect_uri: string
        launch?: string
        scope: string
        state: string
        aud: string

        code_challenge_method?: "S256"
        code_challenge?: string
        // jwks_url?: string
        
        // These can be set by dialogs
        patient?: string
        provider?: string
        encounter?: string
        auth_success?: "0" | "1"
        login_success?: string
    }

    // Describe possible authorize requests ------------------------------------
    // interface Request<
    //     P = ParamsDictionary,
    //     ResBody = any,
    //     ReqBody = any,
    //     ReqQuery = ParsedQs,
    //     Locals extends Record<string, any> = Record<string, any>
    // > extends http.IncomingMessage, Express.Request
    

    interface AuthorizeGetRequest extends Request {
        method: "GET"
        params: { fhir_release: "r2" | "r3" | "r4"; sim?: string }
        query: AuthorizeParams
    }

    interface AuthorizePostRequest extends Request {
        method: "POST"
        params: { fhir_release: "r2" | "r3" | "r4"; sim?: string }
        body: AuthorizeParams
    }

    type AuthorizeRequest = AuthorizeGetRequest | AuthorizePostRequest

    /**
     * Defines the shapes of the payload or query parameters that various
     * backend endpoints expect
     */
    namespace Request {
    
        /**
         * An HTTP POST transaction is made to the EHR authorization server’s
         * token URL, with content-type application/x-www-form-urlencoded. The
         * decision about how long the refresh token lasts is determined by a
         * mechanism that the server chooses. For clients with online access,
         * the goal is to ensure that the user is still online.
         */
        interface RefreshToken {

            grant_type: "refresh_token"

            /**
             * The refresh token from a prior authorization response
             */
            refresh_token: string
            
            /**
             * The scopes of access requested. If present, this value must be a
             * strict sub-set of the scopes granted in the original launch (no
             * new permissions can be obtained at refresh time). A missing value
             * indicates a request for the same scopes granted in the original
             * launch.
             */
            scope?: string

            client_assertion_type
            client_assertion
        }

        /**
         * The body of POST requests sent to the token endpoint sending a `code`
         * and expecting an AccessToken response in return
         */
        interface AuthorizationCode {

            grant_type: "authorization_code"

            /**
             * The authorization token as obtained from the `authorize` call
             */
            code: string

            /**
             * The same redirect_uri used in the initial authorization request
             */
            redirect_uri: string

            /**
             * This parameter is used to verify against the code_challenge
             * parameter previously provided in the authorize request.
             */
            code_verifier?: string

            /**
             * Required for public apps. Omit for confidential apps.
             */
            client_id?: string

            /**
             * Auth token sighed with the client's private jwk
             */
            client_assertion?: string

            /**
             * If client_assertion is set, then this should be set to
             * "urn:ietf:params:oauth:client-assertion-type:jwt-bearer" 
             */
            client_assertion_type?: string
        }
    }

    /**
     * Defines the shapes of the payload returned various backend endpoints
     */
    namespace Response {

        /**
         * The shape of the response of the token endpoint.
         */
        interface TokenResponse {
            
            token_type: "Bearer"

            access_token: string

            /**
             * Lifetime in seconds of the access token, after which the token SHALL
             * NOT be accepted by the resource server
             */
            expires_in?: number

            /**
             * Scope of access authorized. Note that this can be different from the
             * scopes requested by the app.
             */
            scope: string

            /**
             * Token that can be used to obtain a new access token, using the same
             * or a subset of the original authorization grants. If present, the
             * app should discard any previous refresh_token associated with this
             * launch and replace it with this new value.
             */
            refresh_token?: string
        }

        interface RefreshToken {
            token_type: "Bearer"

            access_token: string

            /**
             * Lifetime in seconds of the access token, after which the token
             * SHALL NOT be accepted by the resource server
             */
            expires_in?: number

            /**
             * Scope of access authorized. Note that this can be different from
             * the scopes requested by the app.
             */
            scope: string

            /**
             * Token that can be used to obtain a new access token, using the
             * same or a subset of the original authorization grants. If present,
             * the app should discard any previous refresh_token associated with
             * this launch and replace it with this new value.
             */
            refresh_token?: string
        }
    }

    /**
     * Once an app is authorized, the token response will include any context
     * data the app requested and any (potentially) unsolicited context data the
     * EHR may decide to communicate. For example, EHRs may use launch context
     * to communicate UX and UI expectations to the app (need_patient_banner).
     */
    interface LaunchContext {

        /**
         * Boolean value indicating whether the app was launched in a UX context
         * where a patient banner is required (when true) or not required (when
         * false). An app receiving a value of false should not take up screen
         * real estate displaying a patient banner.
         */
        need_patient_banner?: boolean

        /**
         * String value with a patient id, indicating that the app was launched
         * in the context of FHIR Patient 123. If the app has any patient-level
         * scopes, they will be scoped to Patient 123.
         */
        patient?: string
        
        /**
         * String value with an encounter id, indicating that the app was
         * launched in the context of FHIR Encounter 123.
         */
        encounter?: string

        /**
         * String URL where the EHR’s style parameters can be retrieved (for
         * apps that support styling)
         */
        smart_style_url?: string

        /**
         * String value describing the intent of the application launch.
         * Some SMART apps might offer more than one context or user interface
         * that can be accessed during the SMART launch. The optional intent
         * parameter in the launch context provides a mechanism for the SMART
         * EHR to communicate to the client app which specific context should be
         * displayed as the outcome of the launch. This allows for closer
         * integration between the EHR and client, so that different launch
         * points in the EHR UI can target specific displays within the client
         * app.
         * 
         * For example, a patient timeline app might provide three specific UI
         * contexts, and inform the SMART EHR (out of band, at app configuration
         * time) of the intent values that can be used to launch the app
         * directly into one of the three contexts. The app might respond to
         * intent values like:
         * 
         * `summary-timeline-view` - A default UI context, showing a data summary
         * `recent-history-timeline` - A history display, showing a list of entries
         * `encounter-focused-timeline` - A timeline focused on the currently
         * in-context encounter
         * 
         * If a SMART EHR provides a value that the client does not recognize,
         * or does not provide a value, the client app SHOULD display a default
         * application UI context.
         * 
         * Note that SMART makes no effort to standardize intent values. Intents
         * simply provide a mechanism for tighter custom integration between an
         * app and a SMART EHR. The meaning of intent values must be negotiated
         * between the app and the EHR.
         */
        intent?: string

        /**
         * String conveying an opaque identifier for the healthcare organization
         * that is launching the app. This parameter is intended primarily to
         * support EHR Launch scenarios.
         */
        tenant?: string

        /**
         * Array of relative resource References to any resource type other than
         * “Patient” or “Encounter”. It is not prohibited to have more than one
         * Reference to a given type of resource.
         */
        fhirContext?: Record<string, string>[]

        /**
         * Simulated error to throw
         * @PROPRIETARY
         */
        sim_error?: string
    }

    /**
     * The shape of the response of the token endpoint.
     */
    interface TokenResponse {
        
        token_type: "Bearer"

        access_token: string

        /**
         * Lifetime in seconds of the access token, after which the token SHALL
         * NOT be accepted by the resource server
         */
        expires_in?: number

        /**
         * Scope of access authorized. Note that this can be different from the
         * scopes requested by the app.
         */
        scope: string

        /**
         * Token that can be used to obtain a new access token, using the same
         * or a subset of the original authorization grants. If present, the
         * app should discard any previous refresh_token associated with this
         * launch and replace it with this new value.
         */
        refresh_token?: string
    }

    /**
     * The shape of the response of the token endpoint.
     */
    interface AccessTokenResponse extends TokenResponse, LaunchContext {
        
        /**
         * Authenticated user identity and user details, if requested
         */
        id_token?: string
    }

    /**
     * This is similar to the access token response but it does not include
     * launch context and id_token
     */
    interface RefreshTokenResponse extends TokenResponse {}

    /**
     * In our case the client_id is also a token. It contains details about the
     * registered client and allows us to be stateless
     */
    interface ClientToken {
        
        /**
         * In case the app wants to simulate certain errors
         */
        auth_error?: SimulatedError

        /**
         * Identifies principal that issued the JWT. This is the FHIR server URL
         */
        iss: string

        scope: string

        pub_key: JsonWebKey

        jwks_url?: string

        jwks?: { keys: JsonWebKey[] }
    }

    /**
     * The authorization token (for example the one that is represented as `code`
     * parameter in the code flow)
     */
    interface AuthorizationToken extends LaunchContext {
        context: LaunchContext,

        /**
         * The client_id of the app being launched
         */
        client_id: string

        /**
         * The scopes requested bu the app
         */
        scope: string

        /**
         * The code_challenge_method used by the app
         */
        code_challenge_method?: string

        /**
         * The code_challenge used by the app
         */
        code_challenge?: string
        
        /**
         * Service Discovery URL
         */
        // sde: string

        /**
         * In case the app wants to simulate certain errors
         * @PROPRIETARY
         */
        auth_error?: SimulatedError

        /**
         * AccessToken lifetime in minutes
         * @PROPRIETARY
         */
        accessTokensExpireIn?: number

        /**
         * The client_secret for the client
         * @PROPRIETARY
         */
        client_secret?: string

        nonce?: string
        
        redirect_uri: string

        /**
         * The selected user ID (if any)
         * @example `Patient/123` or `Practitioner/123`
         */
        user?: string

        jwks_url?: string
        jwks?: string

        validation?: 0 | 1
        pkce?: PKCEValidation
        client_type?: SMARTClientType

    }

    interface ClientMetadata {

        /**
         * Array of redirection URI strings for use in redirect-based flows
         * such as the authorization code and implicit flows.  As required by
         * Section 2 of OAuth 2.0 [RFC6749], clients using flows with
         * redirection MUST register their redirection URI values.
         * Authorization servers that support dynamic registration for
         * redirect-based flows MUST implement support for this metadata
         * value.
         */
        redirect_uris: string[]

        /**
         * String indicator of the requested authentication method for the
         * token endpoint.  Values defined by this specification are:
         * 
         * - "none": The client is a public client as defined in OAuth 2.0,
         * Section 2.1, and does not have a client secret.
         * 
         * - "client_secret_post": The client uses the HTTP POST parameters
         * as defined in OAuth 2.0, Section 2.3.1.
         * 
         * - "client_secret_basic": The client uses HTTP Basic as defined in
         * OAuth 2.0, Section 2.3.1.
         * 
         * Additional values can be defined via the IANA "OAuth Token
         * Endpoint Authentication Methods" registry established in
         * Section 4.2.  Absolute URIs can also be used as values for this
         * parameter without being registered.  If unspecified or omitted,
         * the default is "client_secret_basic", denoting the HTTP Basic
         * authentication scheme as specified in Section 2.3.1 of OAuth 2.0.
         */
        token_endpoint_auth_method?: "none" | "client_secret_post" | "client_secret_basic" | string
      
    }

}