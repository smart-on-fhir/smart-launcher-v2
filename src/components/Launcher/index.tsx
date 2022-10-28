import { SMART }        from "../../../"
import { encode }       from "../../isomorphic/codec"
import pkg              from "../../../package.json"
import useLauncherQuery, { LauncherQuery } from "../../hooks/useLauncherQuery"
import UserPicker       from "../UserPicker"
import PatientInput     from "../PatientInput"
import { copyElement }  from "../../lib"
import { useEffect, useRef } from "react"


const launchTypes = [
    {
        name: "Provider EHR Launch",
        description: "Practitioner opens the app from within an EHR",
        value: "provider-ehr"
    },
    {
        name: "Patient Portal Launch",
        description: "Patient opens the app from within a patient portal",
        value: "patient-portal"
    },
    {
        name: "Provider Standalone Launch",
        description: "Practitioner opens the app directly and connects to FHIR",
        value: "provider-standalone"
    },
    {
        name: "Patient Standalone Launch",
        description: "Patient opens the app directly and connects to FHIR",
        value: "patient-standalone"
    },
    {
        name: "Backend Service",
        description: "App connects to FHIR without user login",
        value: "backend-service"
    }
];

const DEFAULT_LAUNCH_PARAMS: SMART.LaunchParams = {
    launch_type  : "provider-ehr",
    patient      : "",
    provider     : "",
    encounter    : "AUTO",
    skip_login   : false,
    skip_auth    : false,
    sim_ehr      : false,
    scope        : "",
    redirect_uris: "",
    client_id    : "",
    client_secret: "",
    validation   : 0,
    client_type  : "public",
    pkce         : "auto"
}

function getValidationErrors(launch: SMART.LaunchParams, query: LauncherQuery) {

    const { launch_type } = launch
    const { launch_url } = query
    const isStandaloneLaunch = launch_type.includes("standalone");
    const isBackendService = launch_type === "backend-service";

    let validationErrors: string[] = [];
    if (!isStandaloneLaunch && !isBackendService) {
        if (!launch_url) {
            validationErrors.push("Missing app launch URL")
        }
        else if (!launch_url.match(/^https?:\/\/.+/)) {
            validationErrors.push("Invalid app launch URL")
        }
    }

    try {
        JSON.parse(launch.jwks || "null")
    } catch {
        validationErrors.push("Invalid JWKS JSON")
    }

    if (launch.jwks_url) {
        try {
            new URL(launch.jwks_url)
        } catch {
            validationErrors.push("Invalid JWKS URL")
        }   
    }

    return validationErrors
}

export default function Launcher() {

    const { query, launch, setQuery } = useLauncherQuery()

    const { launch_type, sim_ehr } = launch
    const { fhir_version, launch_url, tab } = query

    // console.log("launch:", launch, query)

    const launchCode = encode({
        ...DEFAULT_LAUNCH_PARAMS,
        launch_type,
        patient      : launch.patient,
        provider     : launch.provider,
        encounter    : launch.encounter,
        skip_login   : launch.skip_login,
        skip_auth    : launch.skip_auth,
        sim_ehr,
        scope        : launch.scope,
        redirect_uris: launch.redirect_uris,
        client_id    : launch.client_id,
        client_secret: launch.client_secret,
        auth_error   : launch.auth_error,
        jwks_url     : launch.jwks_url,
        jwks         : launch.jwks,
        validation   : launch.validation,
        client_type  : launch.client_type,
        pkce         : launch.pkce
    })

    const isStandaloneLaunch = launch_type.includes("standalone");

    const isBackendService = launch_type === "backend-service";

    const { origin } = window.location;

    const backendOrigin = process.env.NODE_ENV === "development" ? pkg.proxy : origin;

    // FHIR baseUrl for standalone launches
    const aud = `${backendOrigin}/v/${fhir_version}/sim/${launchCode}/fhir`;

    // FHIR baseUrl for EHR launches
    const iss = `${backendOrigin}/v/${fhir_version}/fhir`;

    // The URL to launch the sample app
    let sampleLaunchUrl = new URL(
        isBackendService ?
            "/sample-app/launch-bs" :
            isStandaloneLaunch ?
                "/sample-app" :
                "/sample-app/launch",
        origin
    );
    
    // The URL to launch the user-specified app
    let userLaunchUrl: URL | undefined;

    try {
        userLaunchUrl = new URL(launch_url || "", origin);
    } catch {
        userLaunchUrl = new URL("/", origin);
    }

    if (!isStandaloneLaunch && !isBackendService) {
        sampleLaunchUrl.searchParams.set("iss", iss);
        userLaunchUrl.searchParams.set("iss", iss);

        sampleLaunchUrl.searchParams.set("launch", launchCode);
        userLaunchUrl.searchParams.set("launch", launchCode);
    } else {
        sampleLaunchUrl.searchParams.set("aud", aud);
    }

    if (sim_ehr) {
        sampleLaunchUrl.searchParams.set("app", sampleLaunchUrl.href);
        sampleLaunchUrl.searchParams.delete("iss");
        sampleLaunchUrl.searchParams.delete("launch");
        sampleLaunchUrl.searchParams.delete("aud");
        sampleLaunchUrl.pathname = "/ehr";
        
        userLaunchUrl = new URL(`/ehr?app=${encodeURIComponent(userLaunchUrl.href)}`, origin);
    }

    let validationErrors = getValidationErrors(launch, query);
    
    return (
        <div className="container">
            <h1 className="text-primary">
                <a href="/" style={{ textDecoration: "none" }}>
                    <img src="/logo.png" alt="SMART Logo" height={32} style={{ margin: "-6px 0px 0 0" }} /> SMART Launcher
                </a>
            </h1>
            <br/>
            <ul className="nav nav-tabs" role="tablist">
                <li role="presentation" className={ tab === "0" ? "active" : undefined } onClick={ () => setQuery({ tab: "0" }) }>
                    <b role="tab">App Launch Options</b>
                </li>
                {/* <li role="presentation" className={ tab === "1" ? "active" : undefined } onClick={ () => setQuery({ tab: "1" }) }>
                    <b role="tab">App Registration Options</b>
                </li> */}
                <li role="presentation" className={ tab === "2" ? "active" : undefined } onClick={ () => setQuery({ tab: "2" }) }>
                    <b role="tab">Client Registration & Validation</b>
                </li>
            </ul>
            <br/>
            <form onSubmit={e => e.preventDefault()}>
                {/* <button type="submit">Submit</button> */}
                { tab === "0" && <LaunchTab /> }
                {/* { tab === "1" && <ClientRegistrationTab /> } */}
                { tab === "2" && <ValidationTab /> }
                <div className="text-danger">
                    { validationErrors.length ?
                        <><i className="glyphicon glyphicon-exclamation-sign"/> {validationErrors.join("; ")}</> :
                        <>&nbsp;</>
                    }
                </div>
                <div className="alert alert-success mt-2">
                    <h4 className="text-success mt-0">
                        <i className="glyphicon glyphicon-fire"/> {
                        isStandaloneLaunch || launch_type === "backend-service" ? "Server's FHIR Base URL" : "App's Launch URL"
                    }
                    </h4>
                    <div style={{ display: "flex" }}>
                        <div style={{ flex: "10 1 0" }}>
                            <div className="input-group">
                                <input
                                    id="launch-url"
                                    type="url"
                                    className="form-control"
                                    value={ isStandaloneLaunch || isBackendService ? aud : launch_url }
                                    onChange={ e => !isStandaloneLaunch && !isBackendService && setQuery({ launch_url: e.target.value }) }
                                    readOnly={ isStandaloneLaunch || isBackendService }
                                />
                                <span className="input-group-btn">
                                    { isStandaloneLaunch || isBackendService ? 
                                        <button className="btn btn-primary" onClick={() => copyElement("#launch-url")}>Copy</button> :
                                        validationErrors.length ? 
                                            <button className="btn btn-default" disabled>Launch</button> :
                                            <a
                                                id="ehr-launch-url"
                                                href={userLaunchUrl.href}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                className={"btn btn-primary" + (validationErrors.length ? " disabled": "")}>
                                                Launch
                                            </a> }
                                </span>
                            </div>
                        </div>
                        <div style={{ flex: "1 1 0", marginLeft: 5 }}>
                            { validationErrors.filter(e => e !== "Missing app launch URL" && e !== "Invalid app launch URL").length ? 
                                <button className="btn btn-default" disabled>Launch Sample App</button> :
                                <a href={sampleLaunchUrl.href} target="_blank" rel="noreferrer noopener" className="btn btn-default">
                                    <span className="text-success">Launch Sample App</span>
                                </a>
                            }
                        </div>
                    </div>
                    { isStandaloneLaunch || launch_type === "backend-service" ?
                        <span className="small text-muted">
                            Your app should use this url to connect to the sandbox FHIR server
                        </span> :
                        <span className="small text-muted">
                            Full url of the page in your app that will initialize the
                            SMART session (often the path to a launch.html file or endpoint)
                        </span>
                    }
                </div>
                <br/>
            </form>
            <hr/>
            <p className="text-center">
                Please report any issues you encounter to the <a
                href="https://groups.google.com/forum/#!forum/smart-on-fhir"
                rel="noreferrer noopener"
                target="_blank">
                    SMART Community Forum
                </a> or submit an issue or PR at <a
                href="https://github.com/smart-on-fhir/smart-launcher-v2/"
                rel="noreferrer noopener"
                target="_blank">GitHub</a>.
            </p>
            <br/>
        </div>
    );
}


// function ClientRegistrationTab() {

//     const { launch, setQuery, query } = useLauncherQuery()

//     const jwksTextarea = useRef<HTMLTextAreaElement>(null)

//     let jwksError = ""
//     try {
//         JSON.parse(launch.jwks || "null")
//     } catch {
//         jwksError = "This is not valid JSON"
//     }

//     useEffect(() => {
//         if (jwksTextarea.current) {
//             jwksTextarea.current.setCustomValidity(jwksError)
//             jwksTextarea.current.reportValidity()
//         }
//     }, [jwksError])

//     const cvm = launch.launch_type === "backend-service" ?
//         "client-confidential-asymmetric" :
//         query.cvm;

//     return (
//         <>
//             <div className="alert alert-info">
//                 <i className="glyphicon glyphicon-info-sign" /> <b>All of these
//                 settings are optional!</b> Their only purpose is to simulate how
//                 the app has been registered with the EHR, and by doing so, to
//                 enforce some additional validation. Use these to test how your
//                 app handles errors.
//             </div>
//             <div className="row">
//                 <div className="col-sm-6">
//                     <div className="form-group">
//                         <label htmlFor="client_id" className="text-primary">Client ID</label>
//                         <input
//                             type="text"
//                             name="client_id"
//                             id="client_id"
//                             placeholder="client_id"
//                             className="form-control"
//                             value={ launch.client_id }
//                             onChange={ e => setQuery({ client_id: e.target.value }) }
//                         />
//                         <span className="help-block small">
//                             This sandbox accepts any client ID as if it has been
//                             registered already. You can also enter a client ID 
//                             here for testing purposes. For example, enter a
//                             client_id which is different than the used by the
//                             launched app to get an error and test how your app
//                             handles that.
//                         </span>
//                     </div>

//                     <div className="form-group">
//                         <label htmlFor="scope" className="text-primary">Scopes</label>
//                         <input
//                             type="text"
//                             name="scope"
//                             id="scope"
//                             placeholder="scopes"
//                             className="form-control"
//                             value={launch.scope}
//                             onChange={ e => setQuery({ scope: e.target.value }) }
//                         />
//                         <span className="help-block small">
//                             Space-separated list of scopes that your app is allowed to
//                             request. Leave this empty to allow any scopes. If scopes are
//                             specified and your app requests a scope which is not
//                             implicitly listed here, you will get an <code>invalid scope</code> error.
//                         </span>
//                     </div>

//                 </div>

//                 <div className="col-sm-6">
//                     { launch.launch_type !== "backend-service" &&
//                     <div className="form-group">
//                         <label htmlFor="redirect_uris" className="text-primary">Redirect URIs</label>
//                         <input
//                             type="text"
//                             name="redirect_uris"
//                             id="redirect_uris"
//                             placeholder="redirect_uris"
//                             className="form-control"
//                             value={ launch.redirect_uris }
//                             onChange={ e => setQuery({ redirect_uris: e.target.value }) }
//                         />
//                         <span className="help-block small">
//                             Comma-separated list of redirect URIs. Leave this empty to
//                             allow any redirect URI. If URIs are specified and your
//                             redirect URL does not match any of them, you will get
//                             an <code>invalid redirect_uri</code> error.
//                         </span>
//                     </div> }

//                     <div className="form-group">
//                         <label htmlFor="client_validation_method" className="text-primary">Client Identity Validation Method</label>
//                         <select
//                             id="client_validation_method"
//                             className="form-control"
//                             value={ cvm }
//                             onChange={ e => setQuery({ cvm: e.target.value }) }
//                             disabled={launch.launch_type === "backend-service"}
//                         >
//                             <option value="client-public" disabled={launch.launch_type === "backend-service"}>client-public</option>
//                             <option value="client-confidential-symmetric" disabled={launch.launch_type === "backend-service"}>client-confidential-symmetric</option>
//                             <option value="client-confidential-asymmetric">client-confidential-asymmetric</option>
//                         </select>
//                         <span className="help-block small">
//                             { launch.launch_type !== "backend-service" ? (
//                                 <>
//                                     <b>Public clients</b> are validated based on the redirect_uri they use (use
//                                     the Redirect URIs field to test that validation). <b>Symmetric confidential
//                                     clients</b> use a client secret. <b>Asymmetric confidential clients</b> use
//                                     a JWKS, either provided inline, or as an URL to the JWKS json. 
//                                 </>
//                             ) : (
//                                 <div style={{ marginBottom: 25 }}>
//                                     <b>Asymmetric confidential clients</b> use a JWKS, either provided inline, or
//                                     as an URL to the JWKS json.
//                                 </div>
//                             )}
                             
//                         </span>
//                     </div>

//                     { cvm === "client-confidential-symmetric" && (
//                         <div className="form-group">
//                             <label htmlFor="client_secret" className="text-primary">Client Secret</label>
//                             <input
//                                 type="text"
//                                 name="client_secret"
//                                 id="client_secret"
//                                 placeholder="client_secret"
//                                 className="form-control"
//                                 value={ launch.client_secret }
//                                 onChange={ e => setQuery({ client_secret: e.target.value }) }
//                             />
//                             <span className="help-block small">
//                                 Confidential clients using symmetric authentication
//                                 register with a client secret and are expected to
//                                 provide it at launch time. This sandbox will NOT
//                                 validate your client secret, unless you provide it
//                                 here.
//                             </span>
//                         </div>
//                     )}

//                     { cvm === "client-confidential-asymmetric" && (
//                         <div className="form-group">
//                             <ul className="nav nav-tabs small" role="tablist" style={{ marginBottom: 4 }}>
//                                 <li role="presentation" className={ query.jwks_tab === "0" ? "active" : undefined } onClick={ () => setQuery({ jwks_tab: "0" }) }>
//                                     <b role="tab" className="text-primary">JWKS URL</b>
//                                 </li>
//                                 <li role="presentation" className={ query.jwks_tab === "1" ? "active" : undefined } onClick={ () => setQuery({ jwks_tab: "1" }) }>
//                                     <b role="tab" className="text-primary">JWKS Inline</b>
//                                 </li>
//                             </ul>
//                             { query.jwks_tab === "0" && (
//                                 <>
//                                     <input
//                                         type="url"
//                                         placeholder="URL to JWKS"
//                                         className="form-control"
//                                         value={ launch.jwks_url }
//                                         onChange={ e => setQuery({ jwks_url: e.target.value }) }
//                                     />
//                                     <span className="help-block small">
//                                         Enter the URL where the JWKS with your public keys can be found. If provided,
//                                         this must match the <code>jku</code> header of the assertion token.
//                                     </span>
//                                 </>
//                             )}
//                             { query.jwks_tab === "1" && (
//                                 <>
//                                     <textarea
//                                         placeholder="JWKS as json"
//                                         className={ "form-control" + (jwksError ? " invalid" : "")}
//                                         value={ launch.jwks }
//                                         spellCheck={ false }
//                                         ref={ jwksTextarea }
//                                         onChange={ e => setQuery({ jwks: e.target.value })}
//                                         style={{ whiteSpace: "pre", fontFamily: "monospace", fontSize: "small" }}
//                                     />
//                                     <span className="help-block small">
//                                         Enter a valid JSON object listing your public JWK keys.
//                                         Example: <code dangerouslySetInnerHTML={{ __html: '{"keys":[JWK(s)...]}' }} />.
//                                         This will only be used if the assertion token of the app does not have a <code>jku</code> header!
//                                     </span>
//                                 </>
//                             )}

//                         </div>
//                     )}
//                 </div>
//             </div>
//         </>
//     )
// }

function LaunchTab() {
    const { query, launch, setQuery } = useLauncherQuery()

    // In development the frontend is served by Webpack Dev Server and
    // is available on different port than the backend endpoints. In
    // production backend and frontend share the same origin.
    const origin = process.env.NODE_ENV === "development" ?
        pkg.proxy :
        window.location.origin;

    const fhirServerBaseUrl = `${origin}/v/${ query.fhir_version }/fhir/`;

    return (
        <>
            <div className="row">
                <div className={ launch.launch_type === "backend-service" ? "col-xs-12" : "col-sm-6" }>
                    <div className="form-group">
                        <label htmlFor="launch_type" className="text-primary">Launch Type</label>
                        <select
                            name="launch_type"
                            id="launch_type"
                            className="form-control"
                            value={ launch.launch_type }
                            onChange={ e => setQuery({ launch_type: e.target.value as SMART.LaunchType }) }
                        >
                            { launchTypes.map(o => (<option value={o.value} key={o.value}>{o.name}</option> )) }
                        </select>
                        <span className="help-block small">
                            { launchTypes.find(l => l.value === launch.launch_type)?.description }
                        </span>
                    </div>

                    <div className="row">
                        <div className="col-md-6">
                            <div className="form-group">
                                <label htmlFor="fhir_version" className="text-primary">FHIR Version</label>
                                <select
                                    name="fhir_version"
                                    id="fhir_version"
                                    className="form-control"
                                    value={ query.fhir_version }
                                    onChange={ e => setQuery({ fhir_version: e.target.value, patient: "", provider: "" }) }>
                                    <option value="r4" disabled={!ENV.FHIR_SERVER_R4}>R4</option>
                                    <option value="r3" disabled={!ENV.FHIR_SERVER_R3}>R3 (STU3)</option>
                                    <option value="r2" disabled={!ENV.FHIR_SERVER_R2}>R2 (DSTU2)</option>
                                </select>
                                <span className="help-block small">
                                    Select what FHIR version your app should work with
                                </span>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="form-group">
                                <label htmlFor="sim_error" className="text-primary">Simulated Error</label>
                                <select
                                    id="sim_error"
                                    className="form-control"
                                    value={ launch.auth_error }
                                    onChange={ e => setQuery({ auth_error: e.target.value as SMART.SimulatedError }) }
                                >
                                    <option value="">None</option>

                                    {/* { launch.launch_type !== "backend-service" && <optgroup label="During the authorize request">
                                        <option value="auth_invalid_client_id">invalid client_id</option>
                                        <option value="auth_invalid_redirect_uri">invalid redirect_uri</option>
                                        <option value="auth_invalid_scope">invalid scope</option>
                                        <option value="auth_invalid_client_secret">invalid client_secret</option>
                                    </optgroup> } */}

                                    <optgroup label="During the token request">
                                        <option value="token_invalid_token">invalid token</option>
                                        <option value="token_expired_registration_token">expired token</option>
                                        { launch.launch_type !== "backend-service" && <option value="token_expired_refresh_token">expired refresh token</option> }
                                        {/* <option value="token_invalid_scope">invalid scope</option> */}
                                        { launch.launch_type === "backend-service" && <option value="token_invalid_jti">invalid jti</option> }
                                    </optgroup>
                                    
                                    <optgroup label="During FHIR requests">
                                        <option value="request_invalid_token">invalid access token</option>
                                        <option value="request_expired_token">expired access token</option>
                                    </optgroup>
                                </select>
                                <span className="help-block small">
                                    Force the server to throw certain type of error (useful for manual testing).
                                </span>
                            </div>
                        </div>
                    </div>

                    { launch.launch_type !== "backend-service" &&
                    <div className="form-group">
                        <div style={{ borderBottom: "1px solid #EEE" }}>
                            <label className="text-primary">Misc. Options</label>
                        </div>
                        { (launch.launch_type === "provider-ehr" || launch.launch_type === "patient-portal") &&
                            <div className="checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="sim_ehr"
                                        value="1"
                                        checked={ launch.sim_ehr }
                                        onChange={ e => setQuery({ sim_ehr: e.target.checked }) }
                                    /> Simulate launch within the EHR UI <span className="text-muted small">
                                        (launch within an iFrame)
                                    </span>
                                </label>
                            </div>
                        }
                        { launch.launch_type !== "provider-ehr" && (
                            <div className="checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="skip_login"
                                        value="1"
                                        disabled={ 
                                            (launch.launch_type === "patient-portal"      && (launch.patient  || "").split(",").filter(Boolean).length !== 1) ||
                                            (launch.launch_type === "provider-standalone" && (launch.provider || "").split(",").filter(Boolean).length !== 1)
                                        }
                                        checked={ launch.skip_login }
                                        onChange={ e => setQuery({ skip_login: e.target.checked }) }
                                    /> Skip login screen <span className="text-muted small">
                                        (will launch as if the selected user had logged in)
                                    </span>
                                </label>
                            </div>
                        )}
                        { launch.launch_type !== "provider-ehr" && (
                            <div className="checkbox">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="skip_auth"
                                        value="1"
                                        checked={ launch.skip_auth }
                                        onChange={ e => setQuery({ skip_auth: e.target.checked }) }
                                    /> Skip authorization screen <span className="text-muted small">
                                        (assume the user approved the app launch)
                                    </span>
                                </label>
                            </div>
                        )}
                    </div>}
                </div>
                { launch.launch_type !== "backend-service" ? 
                    <div className="col-sm-6">
                        <div className="form-group">
                            <label htmlFor="patient" className="text-primary">Patient(s)</label>
                            <PatientInput
                                onChange={list => setQuery({ patient: list })}
                                value={ launch.patient }
                                fhirVersion={ query.fhir_version as any }
                                inputProps={{
                                    name: "patient",
                                    id  : "patient",
                                    placeholder: "Patient ID(s)"
                                }}
                            />
                            <span className="help-block small">
                                Simulates the active patient in EHR when app is launched. If
                                no Patient ID is entered or if multiple comma delimited IDs
                                are specified, a patient picker will be displayed as part of
                                the launch flow.
                            </span>
                        </div>

                        { launch.launch_type !== "patient-portal" && launch.launch_type !== "patient-standalone" && (
                            <div className="form-group">
                                <label htmlFor="provider" className="text-primary">Provider(s)</label>
                                <UserPicker
                                    fhirServerBaseUrl={fhirServerBaseUrl}
                                    onChange={ list => setQuery({ provider: list }) }
                                    value={ launch.provider }
                                    inputProps={{
                                        name        : "provider",
                                        id          : "provider",
                                        placeholder : "Provider ID(s)",
                                        autoComplete: "off"
                                    }}
                                />
                                <span className="help-block small">
                                    Simulates user who is launching the app. If no provider is
                                    selected, or if multiple comma delimited Practitioner IDs
                                    are specified, a login screen will be displayed as part of
                                    the launch flow.
                                </span>
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="encounter" className="text-primary">Encounter</label>
                            <select
                                name="encounter"
                                id="encounter"
                                className="form-control"
                                value={ launch.encounter }
                                onChange={ e => setQuery({ encounter: e.target.value }) }
                            >
                                <option value="AUTO">Select the most recent encounter if available</option>
                                <option value="MANUAL">Manually select an encounter if available</option>
                            </select>
                            <span className="help-block small">
                                How to select the current Encounter
                            </span>
                        </div>
                    </div> : null }
            </div>
        </>
    )
}

function ValidationTab() {

    const { launch, setQuery } = useLauncherQuery()

    const jwksTextarea = useRef<HTMLTextAreaElement>(null)

    let jwksError = ""
    try {
        JSON.parse(launch.jwks || "null")
    } catch {
        jwksError = "This is not valid JSON"
    }

    useEffect(() => {
        if (jwksTextarea.current) {
            jwksTextarea.current.setCustomValidity(jwksError)
            jwksTextarea.current.reportValidity()
        }
    }, [jwksError])

    // const cvm = query.cvm || "none";

    // const clientType = launch.launch_type === "backend-service" ?
    //     "backend-service" :
    //      query.ct || "none";

    return (
        <>
            <div className="row">
                <div className="col-sm-6">
                { launch.launch_type !== "backend-service" && (
                    <div className="form-group pb-2">
                        <label className="text-primary">Client Type</label>
                        <select
                            className="form-control"
                            value={ launch.client_type }
                            onChange={ e => setQuery({ client_type: e.target.value as SMART.SMARTClientType }) }
                        >
                            <option value="public" title="for client-side web apps that cannot reliably keep a secret">Public</option>
                            <option value="confidential-symmetric" title="for clients using a client secret to authenticate">Confidential Symmetric</option>
                            <option value="confidential-asymmetric" title="for clients authenticating with signed JWT">Confidential Asymmetric</option>
                        </select>
                        { launch.client_type === "public" && <li className="small text-muted mt-1">for client-side web apps that cannot reliably keep a secret</li> }
                        { launch.client_type === "confidential-symmetric" && <li className="small text-muted mt-1">for clients using a client secret to authenticate</li> }
                        { launch.client_type === "confidential-asymmetric" && <li className="small text-muted mt-1">for clients authenticating with signed JWT</li> }
                    </div>
                )}
                    <div className="form-group pb-2">
                        <div className="row">
                            <div className="col-xs-7">
                                <label className="text-primary form-control-static">Client Identity Validation</label>
                            </div>
                            <div className="col-xs-5 text-right">
                                <div className="btn-group">
                                    <div className="btn-group">
                                        <button type="button" className={ "btn" + (launch.validation === 0 ? " btn-danger info" : " btn-default")} onClick={() => setQuery({ validation: 0 })}>Loose</button>
                                    </div>
                                    <div className="btn-group">
                                        <button type="button" className={ "btn" + (launch.validation === 1 ? " btn-success active" : " btn-default")} onClick={() => setQuery({ validation: 1 })}>Strict</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        { launch.validation === 0 && (
                            <>
                                <li className="small text-muted mt-1"><b>Client ID</b> can be empty to allow any <code>client_id</code></li>
                                <li className="small text-muted"><b>Allowed Scopes</b> can be empty to allow any <code>scope</code></li>
                                { launch.launch_type !== "backend-service" && (<li className="small text-muted"><b>Redirect URIs</b> can be empty to allow any <code>redirect_uri</code></li>)}
                                { launch.launch_type === "backend-service" && (<li className="small text-muted">Do not verify the JWK signature or the <code>jku</code> token header</li>)}
                                { launch.client_type === "confidential-symmetric" && (<li className="small text-muted"><b>Client Secret</b> can be empty to allow any <code>client_secret</code></li>)}
                                { launch.client_type === "confidential-asymmetric" && (<li className="small text-muted">Do not verify the JWK signature or the <code>jku</code> token header</li>)}
                            </>
                        )}
                        { launch.validation === 1 && (
                            <>
                                <li className="small text-muted mt-1">Require the <code>client_id</code> to match the one provided at registration time</li>
                                <li className="small text-muted">Require the <code>scope</code> to be covered by the scopes provided at registration time</li>
                                { launch.launch_type !== "backend-service" && (<li className="small text-muted">Verify that the <code>redirect_uri</code> is within the allowed redirect URIs</li>)}
                                { launch.launch_type === "backend-service" && (<li className="small text-muted">If a <code>jku</code> token header is sent, verify that it matches the JWKS URL</li>)}
                                { launch.client_type === "confidential-symmetric" && (<li className="small text-muted">Verify that the <code>client_secret</code> matches the one provided at registration time</li>)}
                                { launch.client_type === "confidential-asymmetric" && (<li className="small text-muted">Verify JWK using the public keys from JWKS and/or JWKS URL</li>)}
                            </>
                        )}
                    </div>
                    {/* <hr /> */}
                    { launch.launch_type !== "backend-service" && (
                        <>
                            <div className="form-group pb-2">
                                <div className="row">
                                    <div className="col-xs-5">
                                        <label className="text-primary form-control-static">PKCE Validation</label>
                                    </div>
                                    <div className="col-xs-7 text-right">
                                        <div className="btn-group" role="group" aria-label="...">
                                            <div className="btn-group" role="group">
                                                <button type="button" className={ "btn" + (launch.pkce === "none" ? " btn-danger active" : " btn-default")} onClick={() => setQuery({ pkce: "none" })}>None</button>
                                            </div>
                                            <div className="btn-group" role="group">
                                                <button type="button" className={ "btn" + (launch.pkce === "auto" ? " btn-success active" : " btn-default")} onClick={() => setQuery({ pkce: "auto" })}>Auto</button>
                                            </div>
                                            <div className="btn-group" role="group">
                                                <button type="button" className={ "btn" + (launch.pkce === "always" ? " btn-success active" : " btn-default")} onClick={() => setQuery({ pkce: "always" })}>Always</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <li className="text-muted small mt-1">
                                    { launch.pkce === "none" && <span>Do not require or validate PKCE</span> }
                                    { launch.pkce === "auto" && <span>Require valid PKCE if a <code>code_challenge_method</code> parameter is sent</span> }
                                    { launch.pkce === "always" && <span>Require apps to use valid PKCE</span> }
                                </li>
                            </div>
                            {/* <div className="form-group">
                                <b className="text-primary">PKCE Validation</b>
                                <div className="radio" style={{ marginBottom: 4 }}>
                                    <label>
                                        <input type="radio" /> <b>None</b> <span className="small text-muted">- Do not require or validate PKCE</span>
                                    </label>
                                </div>
                                <div className="radio" style={{ marginBottom: 4 }}>
                                    <label>
                                        <input type="radio" /> <b>Auto</b> <span className="small text-muted">- Require valid PKCE if a <code>code_challenge_method</code> parameter is sent</span>
                                    </label>
                                </div>
                                <div className="radio" style={{ marginBottom: 4 }}>
                                    <label>
                                        <input type="radio" /> <b>Always</b> <span className="small text-muted">- Require the app to use valid PKCE</span>
                                    </label>
                                </div>
                            </div> */}
                            {/* <hr/> */}
                        </>
                    )}
                    { launch.launch_type === "backend-service" && (
                        <>
                        <div className="form-group">
                            <label htmlFor="jwks" className="text-primary">JWKS</label>
                            <textarea
                                placeholder="JWKS as json"
                                id="jwks"
                                className={ "form-control" + (jwksError ? " invalid" : "")}
                                value={ launch.jwks }
                                spellCheck={ false }
                                ref={ jwksTextarea }
                                onChange={ e => setQuery({ jwks: e.target.value })}
                                style={{ whiteSpace: "pre", fontFamily: "monospace", fontSize: "small" }}
                                rows={8}
                                required={ launch.validation === 1 && !launch.jwks_url }
                            />
                            <span className="help-block small">
                                Enter a valid JSON object listing your public JWK keys.
                                Example: <code dangerouslySetInnerHTML={{ __html: '{"keys":[JWK(s)...]}' }} />.
                            </span>
                        </div>
                        </>
                    )}
                </div>
                <div className="col-sm-6">
                    <div className="form-group">
                        <label htmlFor="client_id" className="text-primary">Client ID</label>
                        <input
                            type="text"
                            name="client_id"
                            id="client_id"
                            placeholder="client_id"
                            className="form-control"
                            value={ launch.client_id }
                            onChange={ e => setQuery({ client_id: e.target.value }) }
                            required={ launch.validation === 1 }
                        />
                        <span className="help-block small">
                            Enter a client ID that the launched app is expected to use.
                        </span>
                    </div>

                    <div className="form-group">
                        <label htmlFor="scope" className="text-primary">Allowed Scopes</label>
                        <input
                            type="text"
                            name="scope"
                            id="scope"
                            placeholder="scopes"
                            className="form-control"
                            value={launch.scope}
                            onChange={ e => setQuery({ scope: e.target.value }) }
                            required={ launch.validation === 1 }
                        />
                        <span className="help-block small">
                            Space-separated list of scopes that your app is allowed to
                            request. If the app requests a scope which is not implicitly
                            listed here, you will get an <code>invalid scope</code> error. { launch.launch_type === "backend-service" && (
                                <span>Only <code>system</code> scopes are supported for backend services.</span>
                            )}
                        </span>
                    </div>

                    { launch.launch_type !== "backend-service" &&
                    <div className="form-group">
                        <label htmlFor="redirect_uris" className="text-primary">Allowed Redirect URIs</label>
                        <input
                            type="text"
                            name="redirect_uris"
                            id="redirect_uris"
                            placeholder="redirect_uris"
                            className="form-control"
                            value={ launch.redirect_uris }
                            onChange={ e => setQuery({ redirect_uris: e.target.value }) }
                            required={ launch.validation === 1 }
                        />

                        <span className="help-block small">
                            Comma-separated list of redirect URIs. Leave this empty to
                            allow any redirect URI. If URIs are specified and your
                            redirect URL does not match any of them, you will get
                            an <code>invalid redirect_uri</code> error.
                        </span>
                    </div> }

                    { launch.client_type === "confidential-symmetric" && (
                        <div className="form-group">
                            <label htmlFor="client_secret" className="text-primary">Client Secret</label>
                            <input
                                type="text"
                                name="client_secret"
                                id="client_secret"
                                placeholder="client_secret"
                                className="form-control"
                                value={ launch.client_secret }
                                onChange={ e => setQuery({ client_secret: e.target.value }) }
                                required={ launch.validation === 1 }
                            />
                            <span className="help-block small">
                                If provided, apps will be expected to authenticate with this secret.
                            </span>
                        </div>
                    )}

                    { (launch.client_type === "confidential-asymmetric" || launch.launch_type === "backend-service") && (
                        <div className="form-group">
                            <label htmlFor="jwks_url" className="text-primary">JWKS URL</label>
                            <input
                                type="url"
                                id="jwks_url"
                                placeholder="URL to JWKS"
                                className="form-control"
                                value={ launch.jwks_url }
                                onChange={ e => setQuery({ jwks_url: e.target.value }) }
                                required={ launch.validation === 1 && !launch.jwks }
                            />
                            <span className="help-block small">
                                Enter the URL where the JWKS with your public keys can be found. If provided,
                                the <code>jku</code> header of the assertion token must match this value.
                            </span>
                        </div>
                    )}
                    { launch.client_type === "confidential-asymmetric" && (
                        <div className="form-group">
                            <label htmlFor="jwks" className="text-primary">JWKS</label>
                            <textarea
                                placeholder="JWKS as json"
                                id="jwks"
                                className={ "form-control" + (jwksError ? " invalid" : "")}
                                value={ launch.jwks }
                                spellCheck={ false }
                                ref={ jwksTextarea }
                                onChange={ e => setQuery({ jwks: e.target.value })}
                                style={{ whiteSpace: "pre", fontFamily: "monospace", fontSize: "small" }}
                                rows={3}
                                required={ launch.validation === 1 && !launch.jwks_url }
                            />
                            <span className="help-block small">
                                Enter a valid JSON object listing your public JWK keys.
                                Example: <code dangerouslySetInnerHTML={{ __html: '{"keys":[JWK(s)...]}' }} />.
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}