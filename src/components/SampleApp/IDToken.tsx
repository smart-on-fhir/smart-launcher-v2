import Client                  from "fhirclient/lib/Client"
import moment                  from "moment"
import { useEffect, useState } from "react"
import SyntaxHighlighter       from "react-syntax-highlighter"
import { xcode }               from "react-syntax-highlighter/dist/esm/styles/hljs"
import Clip                    from "../Clip"

let timer: any;

function CountDown({ exp }: { exp: number }) {
    const [ now, setNow ] = useState(Date.now() / 1000)

    useEffect(() => {
        if (timer) {
            window.clearTimeout(timer)
        }
        
        timer = setTimeout(() => setNow(Date.now() / 1000), 10000)

        return () => {
            window.clearTimeout(timer)
        }
    }, [now])

    return <>{ moment.duration(exp - now, "seconds").humanize(true, { s: 60, m:60 }) }</>
}

export default function IDToken({ client }: { client: Client }) {

    const token = client.state.tokenResponse?.id_token

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
                    <h4>ID Token</h4> { code && <span className="label label-warning">
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
                <i className="glyphicon glyphicon-info-sign text-primary" /> The <b>id_token</b> is
                a JWT that comes with the token response and contains information about the current
                user.
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
                                    <th className="text-center">ID Token Claims</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>
                                        <b>profile:</b>&nbsp;<span className="text-success">{ code.profile }</span>
                                        <div className="text-muted small">
                                            User identifier (same as <code>fhirUser</code> for backwards compatibility)
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <b>fhirUser:</b>&nbsp;<span className="text-success">{ code.fhirUser }</span>
                                        <div className="text-muted small">
                                            User identifier (same as <code>profile</code> for backwards compatibility)
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <b>iss:</b>&nbsp;<span className="text-success">{ code.iss }</span>
                                        <div className="text-muted small">
                                            Issuer Identifier for the Issuer of the response. The iss value is a case
                                            sensitive URL using the https scheme that contains scheme, host, and optionally,
                                            port number and path components and no query or fragment components.
                                        </div>
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
                                        new Date(code.exp * 1000).toLocaleString()}</span>)</span>
                                        <div className="text-muted small">
                                            <Clip txt="Expiration time on or after which the ID Token MUST NOT be
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
                                        <b>aud:</b>&nbsp;<span className="text-success">{ code.aud }</span>
                                        <div className="text-muted small">
                                            Audience(s) that this ID Token is intended for. It MUST contain the
                                            OAuth 2.0 client_id of the Relying Party as an audience value. In 
                                            this case aud is the <code>client_id</code> of the app.
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <b>sub:</b>&nbsp;<span className="text-success">{ code.sub }</span>
                                        <div className="text-muted small">
                                            Subject Identifier. A locally unique and never reassigned identifier
                                            within the Issuer for the End-User, which is intended to be consumed
                                            by the Client. It MUST NOT exceed 255 ASCII characters in length.
                                            The sub value is a case sensitive string.
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <b>nonce:</b>&nbsp;{ code.nonce ?
                                            <span className="text-success">{ code.nonce + "" }</span> :
                                            <span className="text-warning">{ code.nonce + "" }</span> }
                                        <div className="text-muted small">
                                            <Clip txt="String value used to associate a Client session with an ID
                                            Token, and to mitigate replay attacks. The value is passed through
                                            unmodified from the Authentication Request to the ID Token. If present
                                            in the ID Token, Clients MUST verify that the nonce Claim Value is equal
                                            to the value of the nonce parameter sent in the Authentication Request.
                                            If present in the Authentication Request, Authorization Servers MUST
                                            include a nonce Claim in the ID Token with the Claim Value being the
                                            nonce value sent in the Authentication Request. Authorization Servers
                                            SHOULD perform no other processing on nonce values used. The nonce
                                            value is a case sensitive string." />
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                            <thead>
                                <tr>
                                    <th className="text-center">
                                        <br />
                                        ID Token Headers
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
                        <i className="glyphicon glyphicon-exclamation-sign text-danger" /> No id_token obtained
                    </h5>
                    <p className="text-muted" style={{ marginLeft: 20 }}>
                        <i className="glyphicon glyphicon-info-sign text-primary" style={{ marginLeft: -20 }} /> The <code>id_token</code> is
                        only provided to apps using the <b>standalone</b> or <b>patient portal</b> launch types.
                    </p>
                    <p className="text-muted" style={{ marginLeft: 20 }}>
                        <i className="glyphicon glyphicon-info-sign text-primary" style={{ marginLeft: -20 }} /> The <code>id_token</code> is
                        only to apps requesting <code>openid</code> and <code>fhirUser</code> or <code>profile</code> scopes.
                    </p>
                </div>
            }
        </div>
    )
}