import Client                  from "fhirclient/lib/Client"
import moment                  from "moment"
import { useEffect, useState } from "react"
import SyntaxHighlighter       from "react-syntax-highlighter"
import { xcode }               from "react-syntax-highlighter/dist/esm/styles/hljs"
import { renderCodeList }      from "../../lib";
import Clip                    from "../Clip";

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

export default function RefreshToken({ client }: { client: Client }) {

    const token = client.state.tokenResponse?.refresh_token

    const code: Record<string, any> | null = token ?
        JSON.parse(window.atob(token.split(".")[1])) :
        null;

    const headers: Record<string, any> | null = token ?
        JSON.parse(window.atob(token.split(".")[0])) :
        null;
    
    const [mode, setMode] = useState<"html" | "json">("html")

    return (
        <div className="panel">
            <div className="row">
                <div className="col-xs-6">
                    <h4>Refresh Token</h4> { code && <span className="label label-warning">
                        Expires: <CountDown exp={code.exp} />
                    </span> }
                </div>
                <div className="col-xs-6">
                    <div className="btn-group pull-right">
                        <button className={ "btn btn-sm btn-default" + (mode === "json" ? " active" : "")} onClick={() => setMode("json")}>JSON</button>
                        <button className={ "btn btn-sm btn-default" + (mode === "html" ? " active" : "")} onClick={() => setMode("html")}>HTML</button>
                    </div>
                </div>
            </div>
            <p className="alert alert-info mt-1">
                <i className="glyphicon glyphicon-info-sign text-primary" /> In our case
                the <b>refresh_token</b> is a JWT, but it can be opaque string on other servers.
            </p>
            { code ? 
                mode === "json" ?
                <SyntaxHighlighter language="json" style={xcode}>{
                    JSON.stringify(code, null, 4)
                }</SyntaxHighlighter> :
                <div className="table-responsive">
                    <table className="table table-condensed table-fixed">
                        <thead>
                            <tr>
                                <th className="text-center">Refresh Token Claims</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <b>scope:</b>&nbsp;{ renderCodeList(code.scope) }
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>user:</b>&nbsp;<span className="text-success">{ code.user || "" }</span>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>iat:</b>&nbsp;<span className="text-danger">{ code.iat
                                    }</span>&nbsp;<span className="text-muted">(<span className="text-info">{
                                    new Date(code.iat * 1000).toLocaleString()}</span>)</span>
                                    <div className="text-muted small">
                                        Time at which the JWT was issued. Its value is a JSON number
                                        representing the number of seconds from 1970-01-01T0:0:0Z as
                                        measured in UTC until the date/time.
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>exp:</b>&nbsp;<span className="text-danger">{ code.exp
                                    }</span>&nbsp;<span className="text-muted">(<span className="text-info">{
                                    new Date(code.exp * 1000).toLocaleString()}</span>)</span>                                <div className="text-muted small">
                                        <Clip txt="Expiration time on or after which the Token MUST NOT be
                                        accepted for processing. The processing of this parameter requires that
                                        the current date/time MUST be before the expiration date/time listed in
                                        the value. Implementers MAY provide for some small leeway, usually
                                        no more than a few minutes, to account for clock skew. Its value is
                                        a JSON number representing the number of seconds from 1970-01-01T0:0:0Z
                                        as measured in UTC until the date/time." />
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <b>context:</b>
                                    <table>
                                        <tbody>
                                            { Object.keys(code.context).map((k, i) => (
                                                <tr key={i}>
                                                    <td className="text-right text-muted" style={{ verticalAlign: "top" }}>{k}:&nbsp;</td>
                                                    <td><code>{JSON.stringify(code.context[k])}</code></td>
                                                </tr>    
                                            )) }
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                        <thead>
                            <tr>
                                <th className="text-center">
                                    <br />
                                    Refresh Token Headers
                                </th>
                            </tr>
                            { Object.keys(headers!).map((key, i) => (
                                <tr key={i}>
                                    <td>
                                        <b>{key}:</b>&nbsp;<span className="text-success">{ headers![key] }</span>
                                    </td>
                                </tr>
                            )) }
                        </thead>
                    </table>
                </div> :
            <div>
                <h5 className="alert alert-danger">
                    <i className="glyphicon glyphicon-exclamation-sign text-danger" /> No refresh_token obtained
                </h5>
                <p className="text-muted" style={{ marginLeft: 20 }}>
                    <i className="glyphicon glyphicon-info-sign text-primary" style={{ marginLeft: -20 }} /> The <code>refresh_token</code> is
                    only provided to apps using the <code>offline_access</code> or <code>online_access</code> scope.
                </p>
            </div>}
        </div>
    )
}