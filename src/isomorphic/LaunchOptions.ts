import { SMART }  from "../../"
import * as codec from "./codec"
import List       from "./List"


export default class LaunchOptions
{

    launch_type: SMART.LaunchType;

    /**
     * Comma-separated list of zero or more provider IDs
     */
    provider: List = new List();

    /**
     * Comma-separated list of zero or more patient IDs
     */
    patient: List = new List();

    /**
     * How to handle encounter if applicable. Can be
     * "AUTO"   - selects the most recent encounter if available
     * "MANUAL" - Shows encounter selector
     * Defaults to "auto"
     */
    encounter: string = "AUTO";

    /**
     * Indicates if the user wants to skip provider or patient login if possible
     */
    skip_login: boolean = false;

    /**
     * Indicates if the user wants to skip the app authorization screen login if
     * possible
     */
    skip_auth: boolean = false;

    sim_ehr: boolean = false;
    
    scope: string = "";
    
    // serviceDiscoveryURL
    sde: string = "";

    redirect_uris: string = "";
    
    client_id: string = "";

    // aud_validated: boolean = false;
    
    // select_encounter: boolean = false;
    
    // context?: Record<string, any>;
    
    client_secret: string = "";
    
    auth_error?: SMART.SimulatedError;

    jwks_url?: string;

    jwks?: string;

    client_type: SMART.SMARTClientType;

    pkce: SMART.PKCEValidation;

    fhir_context: List = new List();

    
    constructor(input: string | SMART.LaunchParams)
    {
        if (typeof input === "string") {
            input = codec.decode(input)
        }

        this.launch_type   = input.launch_type
        this.skip_login    = input.skip_login === true
        this.skip_auth     = input.skip_auth  === true
        this.sim_ehr       = input.sim_ehr    === true
        this.auth_error    = input.auth_error
        this.client_secret = input.client_secret || ""
        this.encounter     = input.encounter     || ""
        this.scope         = input.scope         || ""
        this.redirect_uris = input.redirect_uris || ""
        this.client_id     = input.client_id     || ""
        this.jwks_url      = input.jwks_url      || ""
        this.jwks          = input.jwks          || ""
        this.client_type   = input.client_type   || "public"
        this.pkce          = input.pkce          || "auto"
        this.provider.set(input.provider || "");
        this.patient.set(input.patient  || "");
        this.fhir_context.setFhirContext(input.fhir_context || "");
    }

    public toString(): string
    {
        return codec.encode(this.toJSON())
    }

    public toJSON(): SMART.LaunchParams
    {
        return {
            launch_type  : this.launch_type,
            patient      : this.patient.toString(),
            provider     : this.provider.toString(),
            encounter    : this.encounter,
            skip_login   : this.skip_login,
            skip_auth    : this.skip_auth,
            sim_ehr      : this.sim_ehr,
            scope        : this.scope,
            redirect_uris: this.redirect_uris,
            client_id    : this.client_id,
            client_secret: this.client_secret,
            auth_error   : this.auth_error,
            jwks_url     : this.jwks_url,
            jwks         : this.jwks,
            client_type  : this.client_type,
            pkce         : this.pkce
        }
    }
}
