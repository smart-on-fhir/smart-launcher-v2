import { oauth2 } from "fhirclient"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom";
import { decode } from "../../isomorphic/codec";


export default function SampleAppLaunch() {

    const [searchParams] = useSearchParams()

    const [error, setError] = useState()

    const launch = decode(searchParams.get("launch") || "")

    useEffect(() => {
        oauth2.authorize({
            clientId: launch.client_id || "whatever",
            redirectUri: "/sample-app",
            scope: "patient/*.* user/*.* launch launch/patient launch/encounter openid fhirUser profile offline_access",
            clientSecret: launch.client_secret,
            // clientPublicKeySetUrl: "https://bulk-data.smarthealthit.org/keys/ES384.public.json",
            // clientPrivateJwk: {
            //     "kty": "EC",
            //     "crv": "P-384",
            //     "d": "tb7pcRThbZ8gHMFLZXJLMG48U0euuiPqSHBsOYPR2Bqsdq9rEq4Pi6LiOo890Qm8",
            //     "x": "3K1Lw7Qkjj5LWSk5NnIwWmkb5Yo2GkcwVtnM8xhhGdM0bI3B632QMZmqtRHQ5APJ",
            //     "y": "CBqiq5QwE8EyUxw2_oDJzVHrY5j22ny9KbRCK5vABppaGO4x8MxnTWfQMtGIbVQN",
            //     "key_ops": [
            //     "sign"
            //     ],
            //     "ext": true,
            //     "kid": "b37fcf0b5801fde3af48bd55fd95117e",
            //     "alg": "ES384"
            // }
        }).catch(setError)
    }, [launch])

    if (error) {
        console.dir(error)
    }

    return error ? 
        <div className="container">
            <br/>
            <h2 className="text-center">Error Launching Sample App</h2>
            <br/>
            <pre className="alert alert-danger">{ error + "" }</pre>
        </div> :
        <h2 className="text-center">Redirecting...</h2>
}