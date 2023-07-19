import FS from "fs"

const { env } = process


export default {

    /**
     * The port to listen on. If not set defaults to system-allocated port
     */
    port: env.PORT || 0,

    /**
     * The host to listen on. If not set defaults to "localhost"
     */
    host: env.HOST || "0.0.0.0",

    /**
     * We use this to sign our tokens
     */
    jwtSecret: env.SECRET || "this is a secret",

    /**
     * The base URL of the R2 FHIR server (if any)
     */
    fhirServerR2: env.FHIR_SERVER_R2 ?? "https://r2.smarthealthit.org",
    
    /**
     * The base URL of the R3 FHIR server (if any)
     */
    fhirServerR3: env.FHIR_SERVER_R3 ?? "https://r3.smarthealthit.org",
    
    /**
     * The base URL of the R4 FHIR server (if any)
     */
    fhirServerR4: env.FHIR_SERVER_R4 ?? "https://r4.smarthealthit.org",
    
    /**
     * Default access token lifetime in minutes
     */
    accessTokenLifetime: env.ACCESS_TOKEN_LIFETIME || 60,

    /**
     * Default refresh token lifetime in minutes
     */
    refreshTokenLifeTime : env.REFRESH_TOKEN_LIFETIME || 60 * 24 * 365,
    
    /**
     * Accept JWKs using the following algorithms
     */
    supportedAlgorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],

    /**
     * Whether to include encounter in standalone launch context. Note that if
     * this is false, encounter will not be included even if "launch/encounter"
     * scope is requested
     */
    includeEncounterContextInStandaloneLaunch: true,

    /**
     * Our private key as PEM (used to generate the JWKS at /keys)
     */
    privateKeyAsPem: FS.readFileSync(__dirname + "/../private-key.pem", "utf8"),

    /**
     * Associated endpoints for imaging, etc
     */
    associatedEndpoints: JSON.parse(env.ASSOCIATED_ENDPOINTS || "[]"),

    /**
     * Proxy requests to the FHIR server. Defaults to true. Can be disabled 
     * if the FHIR server has its own .well-known/smart-configuration
     */
    proxyFhirRequests: env.PROXY_FHIR_REQUESTS !== "false",
};
