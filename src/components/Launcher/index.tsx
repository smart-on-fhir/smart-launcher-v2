import { useEffect, useRef, useState }     from "react"
import { Helmet, HelmetProvider }          from "react-helmet-async"
import { SMART }                           from "../../../"
import { encode }                          from "../../isomorphic/codec"
import pkg                                 from "../../../package.json"
import UserPicker                          from "../UserPicker"
import PatientInput                        from "../PatientInput"
import { copyElement }                     from "../../lib"
import useLauncherQuery, { LauncherQuery } from "../../hooks/useLauncherQuery"


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

if (window.ENV.CDS_SANDBOX_URL) {
    launchTypes.push({
        name       : "CDS Hooks Service",
        description: "Test your CDS services",
        value      : "cds-hooks"
    })
}

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
    client_type  : "public",
    pkce         : "auto"
}

function getValidationErrors(launch: SMART.LaunchParams, query: LauncherQuery) {

    const { launch_type } = launch
    const { launch_url } = query
    const isStandaloneLaunch = launch_type.includes("standalone");
    const isBackendService = launch_type === "backend-service";
    const isAsymmetric = launch_type === "backend-service" || launch.client_type === "confidential-asymmetric";

    let validationErrors: string[] = [];
    if (!isStandaloneLaunch && !isBackendService) {
        if (!launch_url) {
            validationErrors.push("Missing app launch URL")
        }
        else if (!launch_url.match(/^https?:\/\/.+/)) {
            validationErrors.push("Invalid app launch URL")
        }
    }

    if (isAsymmetric) {
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
        client_type  : launch.client_type,
        pkce         : launch.pkce
    })

    const isStandaloneLaunch = launch_type.includes("standalone");

    const isBackendService = launch_type === "backend-service";
    const isCDSHooksLaunch = launch_type === "cds-hooks";

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

    if (isCDSHooksLaunch) {
        userLaunchUrl = new URL("/launch.html", ENV.CDS_SANDBOX_URL)
        userLaunchUrl.searchParams.set("launch", launchCode);
        userLaunchUrl.searchParams.set("iss", iss);
    }

    let validationErrors = getValidationErrors(launch, query);

    return (
        <HelmetProvider>
            <Helmet>
                <title>SMART Launcher</title>
            </Helmet>
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
                    { !isCDSHooksLaunch && <li role="presentation" className={ tab === "1" ? "active" : undefined } onClick={ () => setQuery({ tab: "1" }) }>
                        <b role="tab">Client Registration & Validation</b>
                    </li> }
                </ul>
                <form onSubmit={e => e.preventDefault()}>
                    <div className="tab-content">
                    { tab === "0" && <LaunchTab /> }
                    { tab === "1" && <ValidationTab /> }
                    </div>
                    
                    { !!(validationErrors.length && !(validationErrors.length === 1 && validationErrors[0] === "Missing app launch URL")) &&
                        <div className="text-danger mt-2" style={{ background: "#f9f3f4", padding: "5px 15px", borderRadius: 5 }}>
                            <i className="glyphicon glyphicon-exclamation-sign"/> {validationErrors.join("; ")}
                        </div>
                    }
                    <div className="mt-2" style={{ background: "#F3F3F3", padding: "10px 15px", borderRadius: 5 }}>
                        <h4 className="text-primary mt-0">
                            <i className="glyphicon glyphicon-fire"/> {
                            isStandaloneLaunch || launch_type === "backend-service" ?
                                "Server's FHIR Base URL" :
                                launch_type === "cds-hooks" ?
                                    "Discovery Endpoint URL" :
                                    "App's Launch URL"
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
                                        placeholder={ isStandaloneLaunch || isBackendService ?
                                            undefined :
                                            launch_type === "cds-hooks" ?
                                                "Discovery Endpoint URL" :
                                                "Launch URL"
                                        }
                                    />
                                    <span className="input-group-btn">
                                        { (isStandaloneLaunch || isBackendService) ? 
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
                            { launch_type !== "cds-hooks" && <div style={{ flex: "1 1 0", marginLeft: 5 }}>
                                { validationErrors.filter(e => e !== "Missing app launch URL" && e !== "Invalid app launch URL").length ? 
                                    <button className="btn btn-default" disabled>Launch Sample App</button> :
                                    <a href={sampleLaunchUrl.href} target="_blank" rel="noreferrer noopener" className="btn btn-default">
                                        <span className="text-success">Launch Sample App</span>
                                    </a>
                                }
                            </div> }
                        </div>
                        { (isStandaloneLaunch || launch_type === "backend-service") ?
                            <span className="small text-muted">
                                Your app should use this url to connect to the sandbox FHIR server
                            </span> :
                            launch_type === "cds-hooks" ?
                            <span className="small text-muted">
                                If you have developed CDS service(s) enter your discovery endpoint
                                URL and click "Launch" to launch the CDS Hooks Sandbox.
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
                <p className="text-center small">
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
                <p className="text-center small">
                    <b> Version:</b> { window.ENV.VERSION }
                    { window.ENV.COMMIT && <>
                    <b> Commit:</b> <a
                    href={ "https://github.com/smart-on-fhir/smart-launcher-v2/commit/" + window.ENV.COMMIT }
                    rel="noreferrer noopener"
                    target="_blank">{ window.ENV.COMMIT }</a></> }
                </p>
                <br/>
            </div>
        </HelmetProvider>
    );
}

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
                    <div className={ launch.launch_type === "cds-hooks" ? "col-md-12" : "col-md-6" }>
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
                    { launch.launch_type !== "cds-hooks" && <div className="col-md-6">
                        <div className="form-group">
                            <label htmlFor="sim_error" className="text-primary">Simulated Error</label>
                            <select
                                id="sim_error"
                                className="form-control"
                                value={ launch.auth_error }
                                onChange={ e => setQuery({ auth_error: e.target.value as SMART.SimulatedError }) }
                            >
                                <option value="">None</option>

                                { launch.launch_type !== "backend-service" && <optgroup label="During the authorize request">
                                    <option value="auth_invalid_client_id">invalid client_id</option>
                                    <option value="auth_invalid_redirect_uri">invalid redirect_uri</option>
                                    <option value="auth_invalid_scope">invalid scope</option>
                                    <option value="auth_invalid_client_secret">invalid client_secret</option>
                                </optgroup> }

                                <optgroup label="During the token request">
                                    <option value="token_invalid_token">invalid token</option>
                                    <option value="token_expired_registration_token">expired token</option>
                                    { launch.launch_type !== "backend-service" && <option value="token_expired_refresh_token">expired refresh token</option> }
                                    <option value="token_invalid_scope">invalid scope</option>
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
                    </div> }
                </div>

                { launch.launch_type !== "backend-service" && launch.launch_type !== "cds-hooks" &&
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
                            Simulates the active patient in EHR when { launch.launch_type === "cds-hooks" ? "the CDS sandbox" : "app" } is
                            launched. If no Patient ID is entered or if multiple comma delimited IDs are specified, a patient picker will
                            be displayed as part of the launch flow.
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
                                Simulates user who is launching the { launch.launch_type === "cds-hooks" ? "CDS sandbox" : "app" }.
                                If no provider is selected, or if multiple comma delimited Practitioner IDs are specified,
                                a login screen will be displayed as part of the launch flow.
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
    )
}

function ValidationTab() {

    const { launch, setQuery, query } = useLauncherQuery()

    const jwksTextarea = useRef<HTMLTextAreaElement>(null)

    const validation = query.validation || "0"

    let jwksError = ""
    try {
        JSON.parse(launch.jwks || "null")
    } catch {
        jwksError = "This is not valid JSON"
    }

    const [ clientID     , setStateClientId ] = useState(launch.client_id    )
    const [ scope        , setScope         ] = useState(launch.scope        )
    const [ jwks         , setJwks          ] = useState(launch.jwks         )
    const [ jwks_url     , setJwksUrl       ] = useState(launch.jwks_url     )
    const [ client_secret, setClientSecret  ] = useState(launch.client_secret)
    const [ redirect_uris, setRedirectUris  ] = useState(launch.redirect_uris)

    useEffect(() => {
        if (jwksTextarea.current) {
            jwksTextarea.current.setCustomValidity(jwksError)
            jwksTextarea.current.reportValidity()
        }
    }, [jwksError])

    function setValidation(validation: "0" | "1") {
        if (validation === "1") {
            setQuery({
                client_id: clientID,
                scope,
                jwks,
                jwks_url,
                client_secret,
                redirect_uris,
                validation
            })
            setStateClientId("")
            setScope("")
            setJwks("")
            setJwksUrl("")
            setClientSecret("")
            setRedirectUris("")
        } else {
            setStateClientId(launch.client_id)
            setScope(launch.scope)
            setJwks(launch.jwks)
            setJwksUrl(launch.jwks_url)
            setClientSecret(launch.client_secret)
            setRedirectUris(launch.redirect_uris)
            setQuery({
                client_id: "",
                scope: "",
                jwks: "",
                jwks_url: "",
                client_secret: "",
                redirect_uris: "",
                validation
            })
        }
    }

    function renderClientTypeWidget() {
        return (
            <div className="form-group">
                <label className="text-primary">Client Type</label>
                <div className="radio">
                    <label>
                        <input type="radio" checked={ launch.client_type === "public" } onChange={ () => setQuery({ client_type: "public" })} /> <b>Public</b>
                        <div className="small text-muted">for client-side web apps that cannot reliably keep a secret</div>
                    </label>
                </div>
                <div className="radio">
                    <label>
                        <input type="radio" checked={ launch.client_type === "confidential-symmetric" } onChange={ () => setQuery({ client_type: "confidential-symmetric" })} /> <b>Confidential Symmetric</b>
                        <div className="small text-muted">for clients using a client secret to authenticate</div>
                    </label>
                </div>
                <div className="radio">
                    <label>
                        <input type="radio" checked={ launch.client_type === "confidential-asymmetric" } onChange={ () => setQuery({ client_type: "confidential-asymmetric" })} /> <b>Confidential Asymmetric</b>
                        <div className="small text-muted">for clients authenticating with signed JWT</div>
                    </label>
                </div>
            </div>
        );
    }

    function renderValidationWidget() {
        return (
            <div className="form-group pt-1 pb-2" style={{ borderBottom: "1px dashed #DDD" }}>
                <div className="row">
                    <div className="col-xs-7">
                        <label className="text-primary form-control-static">Client Identity Validation</label>
                    </div>
                    <div className="col-xs-5 text-right">
                        <div className="btn-group">
                            <div className="btn-group">
                                <button type="button" className={ "btn" + (validation === "0" ? " btn-danger info" : " btn-default")} onClick={() => setValidation("0")}>Loose</button>
                            </div>
                            <div className="btn-group">
                                <button type="button" className={ "btn" + (validation === "1" ? " btn-success active" : " btn-default")} onClick={() => setValidation("1")}>Strict</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    function renderPKCEWidget() {
        return (
            <div className="form-group pt-1">
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
                { query.validation === "1" && (
                    <div className="text-muted small">
                        { launch.pkce === "none" && <span>Do not require or validate PKCE</span> }
                        { launch.pkce === "auto" && <span>Require PKCE if <code>code_challenge_method</code> parameter is sent</span> }
                        { launch.pkce === "always" && <span>Require apps to use valid PKCE</span> }
                    </div>
                )}
            </div>
        )
    }

    function renderJWKSWidget() {
        return (
            <div className="form-group">
                <label htmlFor="jwks" className="text-primary">JWKS</label>
                <textarea
                    placeholder="JWKS as json"
                    id="jwks"
                    className={ "form-control" + (jwksError ? " invalid" : "")}
                    value={ validation === "1" ? launch.jwks : jwks }
                    spellCheck={ false }
                    ref={ jwksTextarea }
                    style={{ whiteSpace: "pre", fontFamily: "monospace", fontSize: "small" }}
                    rows={ 4 }
                    onChange={ e => validation === "1" ? setQuery({ jwks: e.target.value }) : setJwks(e.target.value) }
                />
                <span className="help-block small">
                    Enter a valid JSON object listing your public JWK keys.
                    Example: <code dangerouslySetInnerHTML={{ __html: '{"keys":[JWK(s)...]}' }} />.
                    If provided, your client assertion must be signed with a public key from this set.
                </span>
            </div>
        )
    }

    function renderInfoWidget() {
        return (
            <div className="form-group radio text-muted mb-0" style={{
                padding: "10px 15px",
                background: "#e7f4ff",
                borderRadius: 5
            }}>   
                <div>
                    <label>
                        <i className="fa-regular fa-circle-check text-primary" style={{ marginLeft: -20 }} /> Your
                        app can use any <b className="text-primary">client_id</b>
                    </label>
                </div>
                <div>
                    <label>
                        <i className="fa-regular fa-circle-check text-primary" style={{ marginLeft: -20 }} /> Your
                        app can request any { launch.launch_type === "backend-service" ? <b className="text-primary">system</b> : "" } <b className="text-primary">scope</b>
                    </label>
                </div>
                { launch.launch_type !== "backend-service" && (
                    <div>
                        <label>
                            <i className="fa-regular fa-circle-check text-primary" style={{ marginLeft: -20 }} /> Your
                            app can use any <b className="text-primary">redirect_uri</b>
                        </label>
                    </div>
                )}
                { (launch.launch_type === "backend-service" || launch.client_type === "confidential-asymmetric") && (
                    <div>
                        <label>
                            <i className="fa-regular fa-circle-check text-primary" style={{ marginLeft: -20 }} /> Your
                            app can use any structurally valid JWT assertion
                        </label>
                    </div>
                )}
                { launch.launch_type !== "backend-service" && launch.client_type === "confidential-symmetric" && (
                    <div>
                        <label>
                            <i className="fa-regular fa-circle-check text-primary" style={{ marginLeft: -20 }} /> Your
                            app can use any <b className="text-primary">client_secret</b>
                        </label>
                    </div>
                )}
                { launch.launch_type !== "backend-service" && launch.pkce === "none" && (
                    <div>
                        <label>
                            <i className="fa-regular fa-circle-check text-primary" style={{ marginLeft: -20 }} /> Your
                            app is not required to use PKCE
                        </label>
                    </div>
                )}
                { launch.launch_type !== "backend-service" && launch.pkce === "auto" && (
                    <div>
                        <label>
                            <i className="fa-regular fa-circle-check text-primary" style={{ marginLeft: -20 }} /> PKCE
                            is validated if <b className="text-primary">code_challenge_method</b> parameter is sent
                        </label>
                    </div>
                )}
                { launch.launch_type !== "backend-service" && launch.pkce === "always" && (
                    <div>
                        <label>
                            <i className="fa-regular fa-circle-check text-primary" style={{ marginLeft: -20 }} /> Your
                            app is required to use valid PKCE
                        </label>
                    </div> 
                )}
            </div>
        )
    }

    function renderClientIdWidget() {
        return (
            <div className="form-group">
                <label htmlFor="client_id" className="text-primary">Client ID</label>
                <input
                    type="text"
                    name="client_id"
                    id="client_id"
                    placeholder="client_id"
                    className="form-control"
                    value={ validation === "1" ? launch.client_id : clientID }
                    onChange={
                        e => validation === "1" ?
                            setQuery({ client_id: e.target.value }) :
                            setStateClientId(e.target.value)
                    }
                    disabled={ validation === "0" }
                />
                <span className="help-block small">
                    If you provide a <b>Client ID</b>, your <code>client_id</code> at runtime must match
                </span>
            </div>
        )
    }

    function renderScopeWidget() {
        return (
            <div className="form-group">
                <label htmlFor="scope" className="text-primary">Allowed Scopes</label>
                <input
                    type="text"
                    name="scope"
                    id="scope"
                    placeholder="scopes"
                    className="form-control"
                    value={ validation === "1" ? launch.scope : scope }
                    onChange={
                        e => validation === "1" ?
                            setQuery({ scope: e.target.value }) :
                            setScope(e.target.value)
                    }
                    disabled={ validation === "0" }
                />
                <span className="help-block small">
                    Space-separated list of scopes that your app is allowed to request.
                    If provided, your <code>scope</code> at runtime
                    must be covered by this set. { launch.launch_type === "backend-service" && (
                        <span>Only <code>system</code> scopes are supported for backend services.</span>
                    )}
                </span>
            </div>
        )
    }

    function renderRedirectUriWidget() {
        return (
            <div className="form-group">
                <label htmlFor="redirect_uris" className="text-primary">Allowed Redirect URIs</label>
                <input
                    type="text"
                    name="redirect_uris"
                    id="redirect_uris"
                    placeholder="redirect_uris"
                    className="form-control"
                    value={ validation === "1" ? launch.redirect_uris : redirect_uris }
                    onChange={
                        e => validation === "1" ?
                            setQuery({ redirect_uris: e.target.value }) :
                            setRedirectUris(e.target.value)
                    }
                    disabled={ validation === "0" }
                />

                <span className="help-block small">
                    Comma-separated list of redirect URIs. If provided, your <code>redirect_uri</code> must
                    be included in this set.
                </span>
            </div>
        )
    }

    function renderClientSecretWidget() {
        return (
            <div className="form-group">
                <label htmlFor="client_secret" className="text-primary">Client Secret</label>
                <input
                    type="text"
                    name="client_secret"
                    id="client_secret"
                    placeholder="client_secret"
                    className="form-control"
                    value={ validation === "1" ? launch.client_secret : client_secret }
                    onChange={ 
                        e => validation === "1" ?
                        setQuery({ client_secret: e.target.value }) :
                        setClientSecret(e.target.value)
                    }
                    disabled={ validation === "0" }
                />
                <span className="help-block small">
                    If provided, apps will be expected to authenticate with this secret.
                </span>
            </div>
        )
    }

    function renderJwksUrlWidget() {
        return (
            <div className="form-group">
                <label htmlFor="jwks_url" className="text-primary">JWKS URL</label>
                <input
                    type="url"
                    id="jwks_url"
                    placeholder="URL to JWKS"
                    className="form-control"
                    value={ launch.jwks_url }
                    onChange={ e => setQuery({ jwks_url: e.target.value }) }
                    disabled={ validation === "0" }
                />
                <span className="help-block small">
                    Enter the URL where the JWKS with your public keys can be found.
                    If provided, your client assertion must be signed with a public key from this set.
                </span>
            </div>
        )
    }

    return (
        <>
            { launch.launch_type === "backend-service" ?
                (
                    <div className="row">
                        <div className="col-sm-12">
                            { renderValidationWidget() }        
                        </div>
                    </div>
                ) :
                (
                    <div className="row">
                        <div className="col-sm-6">
                            { renderClientTypeWidget() }
                        </div>
                        <div className="col-sm-6">
                            { renderValidationWidget() }
                            { renderPKCEWidget() }
                        </div>
                    </div>
                )
            }

            { validation === "0" ? renderInfoWidget() : <>
                { launch.launch_type !== "backend-service" && <hr/> }
                <div className="row">
                    <div className="col-sm-6">{ renderClientIdWidget() }</div>
                    <div className="col-sm-6">{ renderScopeWidget() }</div>
                </div>
                <div className="row">
                    { launch.launch_type === "backend-service" ?
                        <>
                            <div className="col-sm-6">{ renderJwksUrlWidget() }</div>
                            <div className="col-sm-6">{ renderJWKSWidget() }</div>
                        </> :
                        <>
                            <div className={launch.client_type === "public" ? "col-sm-12 mb-1" : "col-sm-6" }>{ renderRedirectUriWidget() }</div>
                            {launch.client_type === "confidential-symmetric"  && <div className="col-sm-6">{ renderClientSecretWidget() }</div> }
                            {launch.client_type === "confidential-asymmetric" && <div className="col-sm-6">{ renderJwksUrlWidget() }</div> }
                            {launch.client_type === "confidential-asymmetric" && <div className="col-sm-12 mb-1">{ renderJWKSWidget() }</div> }
                        </>
                        }
                </div>
            </> }

        </>
    )
}