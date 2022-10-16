import { useState }      from "react"
import SyntaxHighlighter from "react-syntax-highlighter"
import { xcode }         from "react-syntax-highlighter/dist/esm/styles/hljs"
import Clip              from "../Clip"
import {
    pick,
    renderCodeList
}  from "../../lib"


export default function ClientInfo({ params }: { params: Record<string, any> }) {

    const [mode, setMode] = useState<"html" | "json">("html")

    return (
        <div className="panel" style={{ display: "block" }}>
            <div className="row">
                <div className="col-xs-6">
                    <h4>SMART Client &amp; Launch Parameters</h4>
                </div>
                <div className="col-xs-6">
                    <div className="btn-group pull-right">
                        <button className={ "btn btn-sm btn-default" + (mode === "json" ? " active" : "")} onClick={() => setMode("json")}>JSON</button>
                        <button className={ "btn btn-sm btn-default" + (mode === "html" ? " active" : "")} onClick={() => setMode("html")}>HTML</button>
                    </div>
                </div>
            </div>
            
            <p className="alert alert-info mt-1">
                <i className="glyphicon glyphicon-info-sign text-primary" /> The SMART Client
                registered with the EHR for this app. Note that in this sandbox no registration
                is needed. Instead we simply infer some properties at launch time, pretending that
                there is a client registered already.
            </p>
            { mode === "json" ?
                <>
                    <h5 className="text-primary mt-0 mb-0">SMART Client</h5>
                    <SyntaxHighlighter language="json" style={xcode}>{
                        JSON.stringify(pick(params, [
                            "client_id",
                            "scope",
                            "client_secret",
                            "redirect_uris",
                            "auth_error",
                            "jwks_url",
                            "jwks"
                        ]), null, 4)
                    }</SyntaxHighlighter>
                    <h5 className="text-primary mt-0 mb-0">Launch Parameters</h5>
                    <SyntaxHighlighter language="json" style={xcode}>{
                        JSON.stringify(pick(params, [
                            "context",
                            "user",
                            "redirect_uri"
                        ]), null, 4)
                    }</SyntaxHighlighter>
                </> : (
                <div className="table-responsive">
                    <table className="table table-condensed table-fixed">
                        <thead>
                            <tr>
                                <th className="text-center text-info">SMART Client</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <b>client_id:</b>&nbsp;{
                                        params.client_id === undefined ?
                                            <code>undefined</code> :
                                            <span className="text-success">{ JSON.stringify(params.client_id) }</span>
                                    }
                                    <div className="text-muted small">
                                        The ID of the registered client
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>scope:</b>&nbsp;{
                                        params.scope === undefined ?
                                            <code>undefined</code> :
                                            <span className="text-success">{ renderCodeList(params.scope + "") }</span>
                                    }
                                    <div className="text-muted small">
                                        All the scopes that this app is allowed to request. This can be
                                        customized on the launcher page. If not specified, the app will
                                        be able to get any scope.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>redirect_uris:</b>&nbsp;{
                                        params.redirect_uris === undefined ?
                                            <code>undefined</code> :
                                            <span className="text-success"><Clip txt={ JSON.stringify(params.redirect_uris) }/></span>
                                    }
                                    <div className="text-muted small">
                                        Comma-separated list of redirect URIs. These can be customized on the launcher
                                        page. If not specified there, we "inherit" this from the app redirect_uri at
                                        launch time, meaning that any redirect url will be accepted.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>client_secret:</b>&nbsp;{
                                        params.client_secret === undefined ?
                                            <code>undefined</code> :
                                            <span className="text-success"><Clip txt={ JSON.stringify(params.client_secret) }/></span>
                                    }
                                    <div className="text-muted small">
                                        Confidential clients using symmetric authentication register with a
                                        client secret and are expected to provide it at launch time.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>auth_error:</b>&nbsp;{
                                            <span className="text-success">{ JSON.stringify(params.auth_error) }</span>
                                    }
                                    <div className="text-muted small">
                                        Proprietary field indicating that apps using this client should simulate some kind of error.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>jwks_url:</b>&nbsp;{
                                        <span className="text-success">{ JSON.stringify(params.jwks_url) }</span>
                                    }
                                    <div className="text-muted small">
                                        URL to JWKS where the client's public key can be located. Used in case of asymmetric authentication.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>jwks:</b>&nbsp;{
                                        <span className="text-success">{ JSON.stringify(params.jwks, null, 4) }</span>
                                    }
                                    <div className="text-muted small">
                                        JWKS that contains the client's public key. Used in case of asymmetric authentication.
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                        <thead>
                            <tr>
                                <th className="text-center text-info"><br />Launch Parameters</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <b>need_patient_banner:</b>&nbsp;<b className="text-primary">{ !!params.context?.need_patient_banner + "" }</b>
                                    <div className="text-muted small">
                                        Will be <code>true</code> if the app is launched within a simulated EHR iFrame, and <code>false</code> otherwise.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>smart_style_url:</b>&nbsp;<span className="text-info">{ params.context?.smart_style_url + "" }</span>
                                    <div className="text-muted small">
                                        An URL on which the EHR's style settings can be found (for apps that support styling)
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>patient:</b>&nbsp;<span className="text-success">{ params.context.patient + "" }</span>
                                    <div className="text-muted small">
                                        The ID(s) of the patient(s) to launch with. If multiple IDs are listed, a patient picker is shown at launch timer
                                        to select one of them. The patient will only be provided for apps requesting <code>launch</code> or <code>launch/patient</code> scope.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>encounter:</b>&nbsp;<span className="text-success">{ params.context.encounter + "" }</span>
                                    <div className="text-muted small">
                                        The ID of the encounter to launch with. The encounter will only be provided for apps
                                        requesting <code>launch</code> or <code>launch/encounter</code> scope.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>user:</b>&nbsp;<span className="text-success">{ params.user + "" }</span>
                                    <div className="text-muted small">
                                        The user identifier. For apps using the <b>patient-standalone</b> or <b>patient-portal</b> launch the user will be
                                        the <code>Patient</code> who logged in. For apps using the <b>provider-standalone</b> launch the user will be
                                        the <code>Practitioner</code> who logged in.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>redirect_uri:</b>&nbsp;<span className="text-info">{ params.redirect_uri + "" }</span>
                                    <div className="text-muted small">
                                        Where should the Auth server redirect to once the authorization is complete.
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}