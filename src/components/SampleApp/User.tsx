import { useEffect, useState } from "react"
import SyntaxHighlighter       from "react-syntax-highlighter"
import { xcode }               from "react-syntax-highlighter/dist/esm/styles/hljs"
import Client                  from "fhirclient/lib/Client"


export default function User({ client }: { client: Client }) {
    const [record , setRecord ] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error  , setError  ] = useState()

    useEffect(() => {
        if (client.user.fhirUser) {
            client.request({ url: client.user.fhirUser, includeResponse: true })
                .then(res => setRecord(res.body))
                .catch(er => setError(er))
                .finally(() => setLoading(false))
        } else {
            setRecord(null)
            setLoading(false)
        }
    }, [client])

    let content = <></>;

    if (loading) {
        content = <>Loading...</>
    }

    else if (error) {
        content = <div className="alert alert-danger">{ error + "" }</div>
    }

    else if (!record) {
        content = <div>
            <h5 className="alert alert-danger">
                <i className="glyphicon glyphicon-exclamation-sign text-danger" /> No user in context
            </h5>
            <p className="text-muted" style={{ marginLeft: 20 }}>
                <i className="glyphicon glyphicon-info-sign text-primary" style={{ marginLeft: -20 }} /> The <b>user</b> is
                only provided for apps using the <b>standalone</b> or <b>patient portal</b> launch types.
            </p>
            <p className="text-muted" style={{ marginLeft: 20 }}>
                <i className="glyphicon glyphicon-info-sign text-primary" style={{ marginLeft: -20 }} /> The <b>user</b> is
                only provided for apps requesting <code>openid</code> and <code>fhirUser</code> or <code>profile</code> scopes.
            </p>
        </div>
    }

    else {
        content = <SyntaxHighlighter language="json" style={xcode}>{JSON.stringify(record || null, null, 4)}</SyntaxHighlighter>
    }

    return (
        <div className="panel">
            <h4>User FHIR Resource</h4>
            {content}
        </div>
    )
}
