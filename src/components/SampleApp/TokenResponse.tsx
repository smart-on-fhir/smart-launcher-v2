import Client                  from "fhirclient/lib/Client"
import moment                  from "moment";
import { useEffect, useState } from "react";
import SyntaxHighlighter       from "react-syntax-highlighter"
import { xcode }               from "react-syntax-highlighter/dist/esm/styles/hljs"
import {
    renderCodeList,
    renderNumber,
    renderString,
    renderUrl
} from "../../lib"


const KNOWN_PROPS = {
    need_patient_banner: {
        type: "boolean",
        render: (x: any) => <code>{ x + "" }</code>,
        desc: <>If <code>false</code>, the app can omit some patient information
            (like name, DOB and age) because that is already displayed within
            the EHR UI.</>
    },
    smart_style_url: {
        type: "url",
        render: renderUrl,
        desc: <>Apps can use these style settings to make sure they
            blend well with the appearance of the hosting EHR.</>
    },
    patient: {
        type: "string",
        render: renderString,
        desc: <>The ID of currently active patient within the EHR session.</>
    },    
    encounter: {
        type: "string",
        render: renderString,
        desc: <>The ID of currently active encounter within the EHR session.</>
    },
    token_type: {
        type: "string",
        render: renderString,
        desc: <>This should always have the fixed value <code>Bearer</code>.</>
    },
    expires_in: {
        type: "number",
        render: renderNumber,
        desc: <>The lifetime of the access token in seconds.</>
    },    
    scope: {
        type: "string",
        render: renderCodeList,
        desc: <>All the scopes granted after successful authorization.</>
    },
    access_token: {
        type: "string",
        render: (s: any) => renderString(s, 80),
        desc: <>The access token which is part of the token response.
            In this server this is a JWT but it can be any string elsewhere.</>
    },
    refresh_token: {
        type: "string",
        render: (s: any) => renderString(s, 80),
        desc: <>The refresh token (if any).</>
    },
    id_token: {
        type: "string",
        render: (s: any) => renderString(s, 80),
        desc: <>The ID token (if any).</>
    },
}

let timer: any;

function CountDown({ exp, interval = 10000 }: { exp: number, interval?: number }) {
    const [ now, setNow ] = useState(Date.now() / 1000)

    useEffect(() => {
        if (timer) {
            window.clearTimeout(timer)
        }
        
        timer = setTimeout(() => setNow(Date.now() / 1000), interval)

        return () => {
            window.clearTimeout(timer)
        }
    }, [now, interval])

    return <>{ moment.duration(exp - now, "seconds").humanize(true, { s: 60, m:60 }) }</>
}

export function TokenResponse({ client }: { client: Client }) {
    let expires = 0;
    const accessToken = client.state.tokenResponse?.access_token
    if (accessToken) {
        expires = JSON.parse(window.atob(accessToken.split(".")[1]))?.exp
    }

    const [mode, setMode] = useState<"html" | "json">("html")

    return (
        <div className="panel">
            <div className="row">
                <div className="col-xs-6">
                    <h4>Access Token Response</h4> <span className="label label-warning">
                        Access token expires: <CountDown exp={expires} />
                    </span>
                </div>
                <div className="col-xs-6">
                    <div className="btn-group pull-right">
                        <button className={ "btn btn-sm btn-default" + (mode === "json" ? " active" : "")} onClick={() => setMode("json")}>JSON</button>
                        <button className={ "btn btn-sm btn-default" + (mode === "html" ? " active" : "")} onClick={() => setMode("html")}>HTML</button>
                    </div>
                </div>
            </div>
            { mode === "json" ?
                <SyntaxHighlighter language="json" style={xcode}>{
                    JSON.stringify(client.state.tokenResponse, null, 4)
                }</SyntaxHighlighter> : 
                <>
                    <p className="alert alert-info mt-1">
                        <i className="glyphicon glyphicon-info-sign text-primary" /> Information extracted from the response of the Token Request
                    </p>
                    <div className="table-responsive">
                        <table className="table table-condensed table-fixed">
                            <tbody>
                                { Object.keys(client.state.tokenResponse || {}).map((k, i) => {
                                    const value = client.state.tokenResponse![k]
                                    return (
                                        <tr key={i}>
                                            <td>
                                                <b>{k}:</b>&nbsp;{ value === undefined ?
                                                    <b className="text-warning">undefined</b> :
                                                    k in KNOWN_PROPS ?
                                                        KNOWN_PROPS[k as keyof typeof KNOWN_PROPS].render(value) :
                                                        JSON.stringify(value, null, 4)
                                                }
                                                { k in KNOWN_PROPS && <div className="text-muted small">
                                                    { KNOWN_PROPS[k as keyof typeof KNOWN_PROPS].desc }
                                                </div> }
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            }
        </div>
    )
}
