import Client                  from "fhirclient/lib/Client"
import { useEffect, useState } from "react"
import SyntaxHighlighter       from "react-syntax-highlighter"
import { xcode }               from "react-syntax-highlighter/dist/esm/styles/hljs"
import { renderCodeList }      from "../../lib"
import Clip                    from "../Clip"

export default function ServerInfoWrap({ client }: { client: Client })
{
    const [mode, setMode] = useState<"html" | "json">("html")

    return (
        <div className="panel">
            <div className="row">
                <div className="col-xs-6">
                    <h4>FHIR Server</h4>
                </div>
                <div className="col-xs-6">
                    <div className="btn-group pull-right">
                        <button className={ "btn btn-sm btn-default" + (mode === "json" ? " active" : "")} onClick={() => setMode("json")}>JSON</button>
                        <button className={ "btn btn-sm btn-default" + (mode === "html" ? " active" : "")} onClick={() => setMode("html")}>HTML</button>
                    </div>
                </div>
            </div>
            <ServerInfo client={ client } mode={ mode } />
        </div>
    )
}

export function ServerInfo({ client, mode }: { client: Client, mode: "html" | "json" }) {
    
    const [meta, setMeta] = useState<fhir4.CapabilityStatement | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState()

    useEffect(() => {
        client.request("/metadata")
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
                <i className="glyphicon glyphicon-info-sign text-primary" /> Information
                extracted from the server's CapabilityStatement
            </p>
            <div className="table-responsive">
                <table className="table table-condensed table-fixed">
                    <tbody>
                        <tr>
                            <th>Software</th>
                            <td>{meta.software?.name} {meta.software?.version}</td>
                        </tr>
                        <tr>
                            <th>Implementation</th>
                            <td>{meta.implementation?.description}</td>
                        </tr>
                        <tr>
                            <th>URL</th>
                            <td className="text-info">{meta.implementation?.url}</td>
                        </tr>
                        <tr>
                            <th>FHIR Version</th>
                            <td>{meta.fhirVersion}</td>
                        </tr>
                        <tr>
                            <th>Supported Formats</th>
                            <td>{ renderCodeList(meta.format) }</td>
                        </tr>
                        <tr>
                            <th>Capability Statement</th>
                            <td className="text-info">{meta.implementation?.url}/metadata</td>
                        </tr>
                        <tr>
                            <th>authorize endpoint</th>
                            <td className="text-info">{meta.rest?.[0].security?.extension?.find(e => e.url === "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris")?.extension?.find(e => e.url === "authorize")?.valueUri}</td>
                        </tr>
                        <tr>
                            <th>token endpoint</th>
                            <td className="text-info">{meta.rest?.[0].security?.extension?.find(e => e.url === "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris")?.extension?.find(e => e.url === "token")?.valueUri}</td>
                        </tr>
                        <tr>
                            <th>introspect endpoint</th>
                            <td className="text-info">{meta.rest?.[0].security?.extension?.find(e => e.url === "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris")?.extension?.find(e => e.url === "introspect")?.valueUri}</td>
                        </tr>
                        <tr>
                            <th>Supported Resources</th>
                            <td><Clip max={500} txt={meta.rest?.[0].resource?.map(r => r.type)?.join(",\n")} /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </>
    )
}