import { SMART } from "../../"

/**
 * The purpose of this is to encode and decode the launch parameters. These
 * are built from the front-end and sent to the authorize endpoint via `launch`
 * query parameter in case of EHR launch, or as an url segment in case of
 * standalone launch. We are mostly doing two things here:
 * 1. Encode those params as base64url so that they can be used as url segment
 * 2. Compress them to shorten the URL
 */


/**
 * Keep this internal list of launch types so that we can safely convert any
 * given LaunchType to its index and vice versa
 */
export const launchTypes: SMART.LaunchType[] = [
    "provider-ehr",
    "patient-portal",
    "provider-standalone",
    "patient-standalone",
    "backend-service"
];

export const clientTypes: SMART.SMARTClientType[] = [
    "public",
    "confidential-symmetric",
    "confidential-asymmetric",
    "backend-service"
];

export const PKCEValidationTypes: SMART.PKCEValidation[] = [
    "none",
    "auto",
    "always"
];


/**
 * Used on the front-end to encode launch parameters
 */
export function encode(params: SMART.LaunchParams, ignoreErrors = false): string {

    const launchTypeIndex = launchTypes.indexOf(params.launch_type);

    if (!ignoreErrors && launchTypeIndex === -1) {
        throw new Error(`Invalid launch type "${params.launch_type}"`)
    }

    if (params.launch_type === "backend-service") {
        return base64UrlEncode(JSON.stringify([
            launchTypeIndex,
            "", // patient
            "", // provider
            "", // encounter
            0,  // skip_login
            0,  // skip_auth
            0,  // sim_ehr
            params.scope         || "",
            "", // redirect_uris
            params.client_id     || "",
            "", // params.client_secret
            params.auth_error    || "",
            params.jwks_url      || "",
            params.jwks          || "",
            clientTypes.indexOf(params.client_type || "public"),
            PKCEValidationTypes.indexOf(params.pkce || "auto"),
            "", // fhirContext
        ]))
    }

    const arr = [
        launchTypeIndex,
        params.patient       || "",
        params.provider      || "",
        params.encounter     || "AUTO",
        params.skip_login    ? 1 : 0,
        params.skip_auth     ? 1 : 0,
        params.sim_ehr && !params.launch_type.includes("standalone") ? 1 : 0,
        params.scope         || "",
        params.redirect_uris || "",
        params.client_id     || "",
        params.client_secret || "",
        params.auth_error    || "",
        params.jwks_url      || "",
        params.jwks          || "",
        clientTypes.indexOf(params.client_type || "public"),
        PKCEValidationTypes.indexOf(params.pkce || "auto"),
        params.fhir_context || "",
    ];

    return base64UrlEncode(JSON.stringify(arr))
}

/**
 * Used on the back-end to decode launch parameters
 */
export function decode(launch: string): SMART.LaunchParams {
    const arr = JSON.parse(base64UrlDecode(launch));

    if (arr && typeof arr === "object" && !Array.isArray(arr)) {
        const result = decodeLegacy(arr)
        // console.log(arr, "====>", result)
        return result
    }

    const launchType = launchTypes[arr[0]];

    if (!launchType) {
        throw new Error(`Invalid launch type`)
    }

    return {
        launch_type  : launchType,
        patient      : arr[1 ] || "",
        provider     : arr[2 ] || "",
        encounter    : arr[3 ] || "",
        skip_login   : arr[4 ] === 1,
        skip_auth    : arr[5 ] === 1,
        sim_ehr      : arr[6 ] === 1,
        scope        : arr[7 ] || "",
        redirect_uris: arr[8 ] || "",
        client_id    : arr[9 ] || "",
        client_secret: arr[10] || "",
        auth_error   : arr[11] || "",
        jwks_url     : arr[12] || "",
        jwks         : arr[13] || "",
        client_type  : clientTypes[arr[14]],
        pkce         : PKCEValidationTypes[arr[15]],
        fhir_context: arr[16] || "",
    }
}

// =============================================================================
//                            LEGACY PARSING
// 
// This is for backwards compatibility with the old launcher, as well as the one
// at https://smart.argo.run
// =============================================================================

// Errors used to be resolved by their index in this array
const SIM_ERRORS = [
    "auth_invalid_client_id",
    "auth_invalid_redirect_uri",
    "auth_invalid_scope",
    "auth_invalid_client_secret",
    "token_invalid_token",
    "token_expired_refresh_token",
    "request_invalid_token",
    "request_expired_token"
];

function decodeLegacy(object: Record<string, string>): SMART.LaunchParams {

    /**
     * {"h":"1"}       -> provider-standalone
     * {"a":"1"}       -> provider-ehr
     * {"a":"1","k":1} -> patient-portal
     * {"k":"1"}       -> patient-standalone
     * {"l":"1"}       -> launch_cds (no longer supported)
     */
    let launch_type: SMART.LaunchType = "provider-ehr"

    if (object.a === "1") { // launch_ehr
        launch_type = "provider-ehr"
    }
    if (object.k === "1") { // launch_pt
        launch_type = "patient-standalone"
    }
    if (object.a === "1" && object.k === "1") { // launch_ehr + launch_pt
        launch_type = "patient-portal"
    }
    if (object.h === "1") { // launch_prov
        launch_type = "provider-standalone"
    }
    if (object.l === "1") { // launch_cds
        throw new Error("CDS Hooks launch is not supported")
    }

    const out = {
        launch_type,
        patient      : object.b || "",
        provider     : object.e || "",
        encounter    : object.c || object.g === "1" ? "MANUAL" : "AUTO",
        skip_login   : object.i === "1",
        skip_auth    : object.j === "1",
        sim_ehr      : object.f === "1",
        scope        : "",
        redirect_uris: "",
        client_id    : "",
        client_secret: "",
        auth_error   : "",
        jwks_url     : "",
        jwks         : "",
        client_type  : "public", // "backend-service"
        pkce         : "auto"
    }

    if (object.d && Number.isInteger(+object.d)) { // auth_error
        out.auth_error = String(SIM_ERRORS[+object.d] || "")
    }

    // The following is for URLs from https://smart.argo.run
    // -------------------------------------------------------------------------
    if (object.m === "1") {
        out.pkce = "always"
    }
    if (object.n === "cc-asym") {
        out.client_type = "confidential-asymmetric"
    }
    if (object.n === "cc-sym") {
        out.client_type = "confidential-symmetric"
    }
    if (object.n === "public") {
        out.client_type = "public"
    }
    if (Array.isArray(object.o)) {
        out.redirect_uris = object.o.join(",")
    }
    if (object.p) {
        out.client_secret = object.p
    }
    if (object.q) {
        out.jwks_url = object.q
    }
    if (object.r) {
        out.jwks = object.r
    }
    // -------------------------------------------------------------------------

    return out as SMART.LaunchParams;
}

// =============================================================================

/**
 * IMPORTANT: This function will be called in the browser, but also in Node
 * environment while testing
 */
export function base64UrlEncode(str: string) {
    return typeof Buffer === "undefined" ?
        window.btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '') :
        Buffer.from(str, "utf8").toString("base64url");
}

/**
 * IMPORTANT: This function will be called in the browser, but also in Node
 * environment while testing
 */
export function base64UrlDecode(str: string) {
    if (typeof Buffer === "undefined") {
        while (str.length % 4) str += "="
        str = str.replace(/-/g, "+").replace(/_/g, "/")
        return window.atob(str)
    }

    return Buffer.from(str, "base64url").toString("utf8");
}
