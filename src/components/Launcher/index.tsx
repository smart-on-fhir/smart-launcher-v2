import { SMART }        from "../../../"
import { encode }       from "../../isomorphic/codec"
import pkg              from "../../../package.json"
import useLauncherQuery from "../../hooks/useLauncherQuery"
import UserPicker       from "../UserPicker"
import PatientInput     from "../PatientInput"
import { copyElement }  from "../../lib"


export default function Launcher() {

    const { query, launch, setQuery } = useLauncherQuery()

    const { launch_type, sim_ehr } = launch
    const { fhir_version, launch_url, tab } = query

    // console.log("launch:", launch, query)

    const launchCode = createLaunchCode({
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
    })

    const isStandaloneLaunch = launch_type.includes("standalone");

    const { origin } = window.location;

    const backendOrigin = process.env.NODE_ENV === "development" ? pkg.proxy : origin;

    // FHIR baseUrl for standalone launches
    const aud = `${backendOrigin}/v/${fhir_version}/sim/${launchCode}/fhir`;

    // FHIR baseUrl for EHR launches
    const iss = `${backendOrigin}/v/${fhir_version}/fhir`;

    // The URL to launch the sample app
    let sampleLaunchUrl = new URL(isStandaloneLaunch ? "/sample-app" : "/sample-app/launch", origin);
    
    // The URL to launch the user-specified app
    let userLaunchUrl = new URL(launch_url || "", origin);

    if (!isStandaloneLaunch) {
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
        
        userLaunchUrl.searchParams.set("app", userLaunchUrl.href);
        userLaunchUrl.searchParams.delete("iss");
        userLaunchUrl.searchParams.delete("launch");
        userLaunchUrl.pathname = "/ehr";
    }


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
                <li role="presentation" className={ tab === "1" ? "active" : undefined } onClick={ () => setQuery({ tab: "1" }) }>
                    <b role="tab">App Registration Options</b>
                </li>
            </ul>
            <br/>
            { tab === "0" && <LaunchUI /> }
            { tab === "1" && <ClientRegistrationUI /> }
            <h3>Launch</h3>
            <div className="form-group">
                <div style={{ display: "flex" }}>
                    <div style={{ flex: "10 1 0" }}>
                        <div className="input-group">
                            <input
                                id="launch-url"
                                type="url"
                                placeholder="App Launch URL"
                                className="form-control"
                                value={ isStandaloneLaunch ? aud : launch_url }
                                onChange={ e => !isStandaloneLaunch && setQuery({ launch_url: e.target.value }) }
                                readOnly={ isStandaloneLaunch }
                            />
                            <span className="input-group-btn">
                                { isStandaloneLaunch ? 
                                    <button className="btn btn-success" onClick={() => copyElement("#launch-url")}>Copy</button> :
                                    <a
                                        id="ehr-launch-url"
                                        href={userLaunchUrl.href}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                        className={"btn btn-success" + (userLaunchUrl ? "" : " disabled")}>Launch</a>
                                }
                            </span>
                        </div>
                    </div>
                    <div style={{ flex: "1 1 0", marginLeft: 5 }}>
                        <a
                            href={sampleLaunchUrl.href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="btn btn-primary">Launch Sample App</a>
                    </div>
                </div>
                { isStandaloneLaunch ?
                    <span className="help-block small">
                        Your app should use this url to connect to the sandbox FHIR server
                    </span> :
                    <span className="help-block small">
                        Full url of the page in your app that will initialize the
                        SMART session (often the path to a launch.html file or endpoint)
                    </span>
                }
            </div>

            <br/>
            <hr/>
            <p className="text-center">
                Please report any issues you encounter to the <a
                href="https://groups.google.com/forum/#!forum/smart-on-fhir"
                rel="noreferrer noopener"
                target="_blank">
                    SMART Community Forum
                </a> or submit an issue or PR at <a
                href="https://github.com/smart-on-fhir/smart-launcher-v2"
                rel="noreferrer noopener"
                target="_blank">GitHub</a>.
            </p>
            <br/>
        </div>
    );
}

function ClientRegistrationUI() {

    const { launch, setQuery, query } = useLauncherQuery()

    return (
        <>
            <div className="alert alert-info">
                <i className="glyphicon glyphicon-info-sign" /> <b>All off these
                settings are optional!</b> Their only purpose is to simulate how
                the app has been registered with the EHR, and by doing so, to
                enforce some additional validation. Use these to test how your
                app handles errors.
            </div>
            <div className="row">
                <div className="col-sm-6">
                    <div className="form-group">
                        <label htmlFor="client_id">Client ID</label>
                        <input
                            type="text"
                            name="client_id"
                            id="client_id"
                            placeholder="client_id"
                            className="form-control"
                            value={ launch.client_id }
                            onChange={ e => setQuery({ client_id: e.target.value }) }
                        />
                        <span className="help-block small">
                            This sandbox accepts any client ID as if it has been
                            registered already. You can also enter a client ID 
                            here for testing purposes. For example, enter a
                            client_id which is different than the used by the
                            launched app to get an error and test how your app
                            handles that.
                        </span>
                    </div>
                </div>

                <div className="col-sm-6">
                    <div className="form-group">
                        <label htmlFor="redirect_uris">Redirect URIs</label>
                        <input
                            type="text"
                            name="redirect_uris"
                            id="redirect_uris"
                            placeholder="redirect_uris"
                            className="form-control"
                            value={ launch.redirect_uris }
                            onChange={ e => setQuery({ redirect_uris: e.target.value }) }
                        />
                        <span className="help-block small">
                            Comma-separated list of redirect URIs. Leave this empty to
                            allow any redirect URI. If URIs are specified and your
                            redirect URL does not match any of them, you will get
                            an <code>invalid redirect_uri</code> error.
                        </span>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-sm-6">
                    <div className="form-group">
                        <label htmlFor="scope">Scopes</label>
                        <input
                            type="text"
                            name="scope"
                            id="scope"
                            placeholder="scopes"
                            className="form-control"
                            value={launch.scope}
                            onChange={ e => setQuery({ scope: e.target.value }) }
                        />
                        <span className="help-block small">
                            Space-separated list of scopes that your app is allowed to
                            request. Leave this empty to allow any scopes. If scopes are
                            specified and your app requests a scope which is not
                            implicitly listed here, you will get an <code>invalid scope</code> error.
                        </span>
                    </div>
                </div>

                <div className="col-sm-6">
                    <div className="form-group">
                        <label htmlFor="client_validation_method">Client Identity Validation Method</label>
                        <select id="client_validation_method" className="form-control" value={ query.cvm } onChange={e => setQuery({ cvm: e.target.value }) }>
                            <option value="client-public">client-public</option>
                            <option value="client-confidential-symmetric">client-confidential-symmetric</option>
                            <option value="client-confidential-asymmetric">client-confidential-asymmetric</option>
                        </select>
                        <span className="help-block small">
                            <b>Public clients</b> are validated based on the redirect_uri they use (use the Redirect URIs
                            field to test that validation). <b>Symmetric confidential clients</b> use a client secret. <b>
                            Asymmetric confidential clients</b> use a JWKS, either provided inline, or as an URL to the JWKS json. 
                        </span>
                    </div>
                </div>
            </div>

            <div className="row">
                <div className="col-sm-6">
                    <label htmlFor="sim_error">Simulated Error</label>
                    <select
                        id="sim_error"
                        className="form-control"
                        value={ launch.auth_error }
                        onChange={ e => setQuery({ auth_error: e.target.value as SMART.SimulatedError }) }
                    >
                        <option value="">None</option>

                        <optgroup label="During the authorize request">
                            <option value="auth_invalid_client_id">Simulate invalid client_id</option>
                            <option value="auth_invalid_redirect_uri">Simulate invalid redirect_uri</option>
                            <option value="auth_invalid_scope">Simulate invalid scope</option>
                            <option value="auth_invalid_client_secret">Simulate invalid client_secret</option>
                        </optgroup>

                        <optgroup label="During the token request">
                            <option value="token_invalid_token">Simulate invalid client token</option>
                            <option value="token_expired_refresh_token">Simulate expired refresh token</option>
                            <option value="token_expired_registration_token">Simulate expired client token</option>
                            <option value="token_invalid_scope">Simulate invalid scope</option>
                            <option value="token_invalid_jti">Simulate invalid jti (for backend services)</option>
                        </optgroup>
                        
                        <optgroup label="During FHIR requests">
                            <option value="request_invalid_token">Simulate invalid access token</option>
                            <option value="request_expired_token">Simulate expired access token</option>
                        </optgroup>
                    </select>
                    <span className="help-block small">
                        Force the server to throw certain type of error (useful for manual testing).
                    </span>
                </div>
                <div className="col-sm-6">

                    { query.cvm === "client-confidential-symmetric" && (
                        <div className="form-group">
                            <label htmlFor="client_secret">Client Secret</label>
                            <input
                                type="text"
                                name="client_secret"
                                id="client_secret"
                                placeholder="client_secret"
                                className="form-control"
                                value={ launch.client_secret }
                                onChange={ e => setQuery({ client_secret: e.target.value }) }
                            />
                            <span className="help-block small">
                                Confidential clients using symmetric authentication
                                register with a client secret and are expected to
                                provide it at launch time. This sandbox will NOT
                                validate your client secret, unless you provide it
                                here.
                            </span>
                        </div>
                    )}

                    { query.cvm === "client-confidential-asymmetric" && (
                        <div className="form-group">
                            <ul className="nav nav-tabs" role="tablist" style={{ marginBottom: 4 }}>
                                <li role="presentation" className={ query.jwks_tab === "0" ? "active" : undefined } onClick={ () => setQuery({ jwks_tab: "0" }) }>
                                    <b role="tab">JWKS URL</b>
                                </li>
                                <li role="presentation" className={ query.jwks_tab === "1" ? "active" : undefined } onClick={ () => setQuery({ jwks_tab: "1" }) }>
                                    <b role="tab">JWKS Inline</b>
                                </li>
                            </ul>
                            {/* <label htmlFor="jwks_url">JWKS URL</label> */}
                            { query.jwks_tab === "0" && (
                                <>
                                    <input
                                        type="url"
                                        placeholder="URL to JWKS"
                                        className="form-control"
                                        value={ launch.jwks_url }
                                        onChange={ e => setQuery({ jwks_url: e.target.value }) }
                                    />
                                    <span className="help-block small">
                                        Enter the URL where the JWKS with your public keys can be found
                                    </span>
                                </>
                            )}
                            { query.jwks_tab === "1" && (
                                <>
                                    <textarea
                                        placeholder="JWKS as json"
                                        className="form-control"
                                        value={ launch.jwks }
                                        onChange={ e => setQuery({ jwks: e.target.value }) }
                                        style={{ whiteSpace: "pre", fontFamily: "monospace", fontSize: "small" }}
                                    />
                                    <span className="help-block small">
                                        Enter a valid JSON object listing your public JWK keys.
                                        Example: <code dangerouslySetInnerHTML={{
                                            __html: '{"keys":[JWK(s)...]}'
                                        }} />. Note that each JWK must have a <b>kid</b> property
                                        and a <b>key_ops</b> array that includes <code>"verify"</code>.
                                    </span>
                                </>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

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
    // {
    //     name: "Backend Service",
    //     description: "App connects to FHIR without user login",
    //     value: "backend-service"
    // }
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
    client_secret: ""
}

function createLaunchCode(params: SMART.LaunchParams) {
    return encode({
        ...DEFAULT_LAUNCH_PARAMS,
        ...params
    })
}

function LaunchUI() {
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
                <div className="col-sm-6">
                    <div className="form-group">
                        <label htmlFor="launch_type">Launch Type</label>
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

                    <div className="form-group">
                        <label htmlFor="fhir_version">FHIR Version</label>
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
                            <div>Open FHIR Server Endpoint: <a href={`https://${ query.fhir_version}.smarthealthit.org`} target="_blank" rel="noreferrer noopener">https://{ query.fhir_version }.smarthealthit.org</a></div>
                            <div>Protected FHIR Server Endpoint: <a href={`http://localhost:8443/v/${ query.fhir_version }/fhir`} target="_blank" rel="noreferrer noopener">http://localhost:8443/v/{ query.fhir_version }/fhir</a></div>
                        </span>
                    </div>

                    <div className="form-group">
                        <div style={{ borderBottom: "1px solid #EEE" }}>
                            <label htmlFor="launch_type">Misc. Options</label>
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
                    </div>
                </div>

                <div className="col-sm-6">
                    <div className="form-group">
                        <label htmlFor="patient">Patient(s)</label>
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
                            <label htmlFor="provider">Provider(s)</label>
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
                        <label htmlFor="encounter">Encounter</label>
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
                    </div>
                </div>
            </div>
        </>
    )
}
