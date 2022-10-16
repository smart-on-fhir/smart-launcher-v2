import { oauth2 }              from "fhirclient"
import { useSearchParams }     from "react-router-dom"
import { useEffect, useState } from "react"
import Client                  from "fhirclient/lib/Client"
import ServerInfo              from "./ServerInfo"
import { TokenResponse }       from "./TokenResponse"
import IDToken                 from "./IDToken"
import SMARTInfo               from "./SMARTInfo"
import ClientInfo              from "./Client"
import RefreshToken            from "./RefreshToken"
import LaunchPanel             from "./LaunchPanel"
import Patient                 from "./Patient"
import Encounter               from "./Encounter"
import User                    from "./User"
import { decode }              from "../../isomorphic/codec"
import "./style.css"


export default function SampleApp()
{
    // We may get different URL params depending on the launch type
    const [searchParams] = useSearchParams();

    // oAuth error code
    const oauthError = searchParams.get("error")
    
    // oAuth error description
    const error_description = searchParams.get("error_description")

    // Auth code
    const code = searchParams.get("code")

    // Auth state
    const state = searchParams.get("state")

    // For standalone launches
    const aud = searchParams.get("aud")

    // UI error message
    const [error, setError] = useState<Error | string>("")

    // The SMART client instance
    const [client, setClient] = useState<Client|undefined>()

    // Flag indication that we are currently fetching data
    const [loading, setLoading] = useState(true)

    // The code from EHR launch or the launch from standalone launch
    const [launchParams, setLaunchParams] = useState(
        JSON.parse(sessionStorage.launchParams || "{}")
    )

    // After render get the client instance
    useEffect(() => {

        // EHR LAUNCH ----------------------------------------------------------
        if (code && state) {
            const params = JSON.parse(window.atob(code.split(".")[1]))
            sessionStorage.launchParams = JSON.stringify(params) // Remember launch params
            setLaunchParams(params)
            oauth2.ready().then(setClient, setError).finally(() => setLoading(false))
        }

        // Case 3: STANDALONE LAUNCH -------------------------------------------
        else if (aud) {
            const sim = aud.match(/\/sim\/(.+)\//)?.[1]
            if (!sim) {
                setError("Invalid aud parameter (missing sim segment)")
            } else {
                const params = decode(sim)
                sessionStorage.launchParams = JSON.stringify(params) // Remember launch params
                setLaunchParams(params)
                setLoading(false)
            }
        }

        // Case 1: REFRESH -----------------------------------------------------
        else {
            oauth2.ready().then(setClient, setError).finally(() => setLoading(false))
        }

    }, [code, state, aud])

    // Loading takes precedence over errors and content
    if (loading) {
        return (
            <div className="container text-center">
                <br/>
                Loading...
            </div>
        )
    }

    // Authorization failed
    if (oauthError) {
        return (
            <div className="container">
                <br/>
                <pre className="alert alert-danger"><b>OAuth Error:</b> {
                    oauthError
                }{ error_description ?
                    <><br />{error_description}</> :
                    "Authorization failed"
                }</pre>
            </div>
        )
    }

    // Other errors
    if (error) {
        return (
            <div className="container">
                <br/>
                <pre className="alert alert-danger">{ error + "" }</pre>
            </div>
        )
    }

    // No errors, yet no client
    if (!client) {
        if (launchParams.launch_type && launchParams.launch_type.includes("standalone")) {
            return (
                <div className="container">
                    <div className="content sample-app">
                        <br/>
                        <div className="alert alert-info">
                            <i className="glyphicon glyphicon-info-sign text-primary" /> The
                            sample app is about to perform a {launchParams.launch_type} launch.
                            You can customize some options below and click "Authorize".
                        </div>
                        <LaunchPanel
                            isOpen
                            aud={ aud! }
                            client_id="whatever"
                            scope="patient/*.* user/*.* launch/patient launch/encounter openid fhirUser profile offline_access"
                        />
                    </div>
                </div>
            )
        }
        return (
            <div className="container">
                <br/>
                <div className="alert alert-danger">
                    Failed initializing a SMART client
                </div>
            </div>
        )
    }

    return (
        <div className="flex-row content sample-app" style={{ flex: "1 1 0px" }}>
            { launchParams.launch_type && launchParams.launch_type.includes("standalone") && (
                <div className="panel" style={{ flex: "1 1 100%" }}>
                    <LaunchPanel
                        aud={ client.state.serverUrl }
                        scope={ client.state.scope }
                        client_id={ client.state.clientId }
                        pkce={ client.state.codeChallenge ? "ifSupported" : "disabled" }
                    />
                </div>
            )}
            <ServerInfo    client={client} />
            <SMARTInfo     client={client} />
            <ClientInfo    params={ launchParams } />
            <TokenResponse client={client} />
            <IDToken       client={client} />
            <RefreshToken  client={client} />
            <User          client={client} />
            <Patient       client={client} />
            <Encounter     client={client} />
        </div>
    )
}
