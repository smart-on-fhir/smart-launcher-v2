import { useEffect, useState } from "react"
import SyntaxHighlighter       from "react-syntax-highlighter"
import { xcode }               from "react-syntax-highlighter/dist/esm/styles/hljs"
import Client                  from "fhirclient/lib/Client"


export default function Patient({ client }: { client: Client }) {
    const [patient, setPatient] = useState<fhir4.Patient | null>(null)
    const [loading, setLoading] = useState(true)
    const [error  , setError  ] = useState()

    useEffect(() => {
        client.patient.read()
            .then(pt => setPatient(pt))
            .catch(er => setError(er))
            .finally(() => setLoading(false))
    }, [client])

    return (
        <div className="panel">
            <h4>Patient FHIR Resource</h4>
            {
                loading ?
                    "Loading..." :
                    error ? error + "" :
                    <SyntaxHighlighter language="json" style={xcode}>{
                        JSON.stringify(patient || null, null, 4)
                    }</SyntaxHighlighter>
            }
        </div>
    )
}
