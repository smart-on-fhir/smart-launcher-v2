import { useEffect, useState } from "react"
import SyntaxHighlighter       from "react-syntax-highlighter"
import { xcode }               from "react-syntax-highlighter/dist/esm/styles/hljs"
import Client                  from "fhirclient/lib/Client"


export default function Encounter({ client }: { client: Client }) {
    const [record , setRecord ] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error  , setError  ] = useState()

    useEffect(() => {
        client.encounter.read()
            .then(rec => setRecord(rec))
            .catch(er => setError(er))
            .finally(() => setLoading(false))
    }, [client])

    return (
        <div className="panel">
            <h4>Encounter FHIR Resource</h4>
            {
                loading ?
                    "Loading..." :
                    error ? error + "" :
                    <SyntaxHighlighter language="json" style={xcode}>{
                        JSON.stringify(record || null, null, 4)
                    }</SyntaxHighlighter>
            }
        </div>
    )
}