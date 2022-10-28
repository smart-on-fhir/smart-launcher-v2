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
            params.validation    || 0,
            3, // client_type = backend-service
            0, // pkce = none
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
        params.validation    || 0,
        clientTypes.indexOf(params.client_type || "public"),
        PKCEValidationTypes.indexOf(params.pkce || "auto")
    ];

    return base64UrlEncode(JSON.stringify(arr))
}

/**
 * Used on the back-end to decode launch parameters
 */
export function decode(launch: string): SMART.LaunchParams {
    const arr = JSON.parse(base64UrlDecode(launch));

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
        validation   : arr[14] || 0,
        client_type  : clientTypes[arr[15]],
        pkce         : PKCEValidationTypes[arr[16]]
    }
}

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
