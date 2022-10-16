import Client                  from "fhirclient/lib/Client"
import { fhirclient }          from "fhirclient/lib/types"
import SyntaxHighlighter       from "react-syntax-highlighter"
import { xcode }               from "react-syntax-highlighter/dist/esm/styles/hljs"
import { useEffect, useState } from "react"

export default function SMARTInfoWrap({ client }: { client: Client }) {
    
    const [mode, setMode] = useState<"html" | "json">("html")

    return (
        <div className="panel">
            <div className="row">
                <div className="col-xs-6">
                    <h4>SMART Configuration</h4>
                </div>
                <div className="col-xs-6">
                    <div className="btn-group pull-right">
                        <button className={ "btn btn-sm btn-default" + (mode === "json" ? " active" : "")} onClick={() => setMode("json")}>JSON</button>
                        <button className={ "btn btn-sm btn-default" + (mode === "html" ? " active" : "")} onClick={() => setMode("html")}>HTML</button>
                    </div>
                </div>
            </div>
            <SMARTInfo client={client} mode={mode} />
        </div>
    )
}

export function SMARTInfo({ client, mode }: { client: Client, mode: "html" | "json" }) {
    const [meta   , setMeta   ] = useState<fhirclient.JsonObject | null>(null)
    const [loading, setLoading] = useState(true)
    const [error  , setError  ] = useState()

    useEffect(() => {
        client.request("/.well-known/smart-configuration")
            .then(meta => setMeta(meta))
            .catch(er => setError(er))
            .finally(() => setLoading(false))
    }, [client]);

    if (loading) {
        return <div className="text-info">Loading...</div>
    }

    if (error) {
        return <div className="text-danger">{ error + "" }</div>
    }

    if (!meta) {
        return <div className="text-danger">Failed to fetch metadata from the server</div>
    }

    if (mode === "json") {
        return <SyntaxHighlighter language="json" style={xcode}>{
            JSON.stringify(meta, null, 4)
        }</SyntaxHighlighter>
    }

    return (
        <>
            <p className="alert alert-info mt-1">
                <i className="glyphicon glyphicon-info-sign text-primary" /> Information extracted from the server's .well-known/smart-configuration endpoint
            </p>
            <div className="table-responsive">
                <table className="table table-condensed table-fixed">
                    <tbody>
                        <tr>
                            <th>Authorization Endpoint</th>
                            <td className="text-info">{ meta.authorization_endpoint + "" }</td>
                        </tr>
                        <tr>
                            <th>Token Endpoint</th>
                            <td className="text-info">{ meta.token_endpoint + "" }</td>
                        </tr>
                        <tr>
                            <th>Introspection Endpoint</th>
                            <td className="text-info">{ meta.introspection_endpoint + "" }</td>
                        </tr>
                        <tr>
                            <th>Supported Code Challenge Methods</th>
                            <td className="text-info">{ (meta.code_challenge_methods_supported as string[]).map((m, i) => (
                                <span key={i}>
                                    { i > 0 ? ", " : "" }
                                    <code>{m}</code>
                                </span>
                            )) }</td>
                        </tr>
                        <tr>
                            <th>Supported Token Auth Methods</th>
                            <td className="text-info">{ (meta.token_endpoint_auth_methods_supported as string[]).map((m, i) => (
                                <span key={i}>
                                    { i > 0 ? ", " : "" }
                                    <code>{m}</code>
                                </span>
                            )) }</td>
                        </tr>
                        <tr>
                            <th>Supported Scopes</th>
                            <td className="text-info">{ (meta.scopes_supported as string[]).map((m, i) => (
                                <span key={i}>
                                    { i > 0 ? ", " : "" }
                                    <code>{m}</code>
                                </span>
                            )) }</td>
                        </tr>
                        <tr>
                            <th>Supported Response Types</th>
                            <td className="text-info">{ (meta.response_types_supported as string[]).map((m, i) => (
                                <span key={i}>
                                    { i > 0 ? ", " : "" }
                                    <code>{m}</code>
                                </span>
                            )) }</td>
                        </tr>
                        <tr>
                            <th>Capabilities</th>
                            <td className="text-info">{ (meta.capabilities as string[]).map((m, i) => (
                                <span key={i}>
                                    { i > 0 ? ", " : "" }
                                    <code>{m}</code>
                                </span>
                            )) }</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
    )
}
