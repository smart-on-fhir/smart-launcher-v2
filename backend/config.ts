import FS from "fs"

const { env } = process


export default {

    /**
     * The port to listen on. If not set defaults to 8443
     */
    port: env.LAUNCHER_PORT || env.PORT || 8444,

    /**
     * The host to listen on. If not set defaults to "localhost"
     */
    host: env.HOST || "localhost",

    /**
     * We use this to sign our tokens
     */
    jwtSecret: env.SECRET || "this is a secret",

    /**
     * The base URL of the R2 FHIR server (if any)
     */
    fhirServerR2: env.FHIR_SERVER_R2 || "",
    
    /**
     * The base URL of the R3 FHIR server (if any)
     */
    fhirServerR3: env.FHIR_SERVER_R3 || "",
    
    /**
     * The base URL of the R4 FHIR server (if any)
     */
    fhirServerR4: env.FHIR_SERVER_R4 || "",
    
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
    privateKeyAsPem: FS.readFileSync(__dirname + "/../private-key.pem", "utf8")
}
