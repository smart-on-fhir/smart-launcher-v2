import { Reducer, useEffect, useReducer, useState } from "react"
import { useSearchParams }                          from "react-router-dom"
import { fhirclient }                               from "fhirclient/lib/types"
import { signCompactJws, importJWK }                from "fhirclient/lib/security/browser"
import SyntaxHighlighter                            from "react-syntax-highlighter"
import { xcode }                                    from "react-syntax-highlighter/dist/esm/styles/hljs"
import { Helmet, HelmetProvider }                   from "react-helmet-async"
import Clip                                         from "../Clip"
import { decode, encode }                           from "../../isomorphic/codec"
import useFetch                                     from "../../hooks/useFetch"
import { SMART }                                    from "../../.."


interface State {
    aud: string
    scope: string
    clientId: string
    tokenEndpoint: string
    assertion: string
    accessToken: string
    client: SMART.LaunchParams
    accessTokenExpiresAt: number
    jwksUrl?: string
}

interface StepProps {
    state: State
    dispatch: (s: Partial<State>) => void
}

// const JWKS_URL = "https://www.hl7.org/fhir/smart-app-launch/RS384.private.json"

// const PUBLIC_JWT_RS384 = {
//     "kty": "RSA",
//     "alg": "RS384",
//     "n": "wJq2RHIA-7RT6q4go7wjcbHdW7ck7Kz22A8wf-kN7Wi5CWvhFG2_Y7nQp1lDpb2IKMQr-Q4n_vgJ6d5rWPspJpSPY7iffUK4ipQCEbzID5DJ6fQMBZOfCTXyxkuMh3jYGKEF3Ziw2oxbM1H9j-eJAPtrj5stUG6kVoXowegdox-bSjWP0iI5PnkwUNzcekLMug4M3LRluEQgGR9O_BAML6-w3igZ_rZA_gunyrLAMbfmCVaceW5ohLp679kyM7U6W2gDK_NbkDKcINUakVmPeoG5h8RzgGzvGrySR0k0VDFiZv60Ua07DqHTeDGH9e4NV07AECae-oykIj5NDCs3pw",
//     "e": "AQAB",
//     "key_ops": [
//         "verify"
//     ],
//     "ext": true,
//     "kid": "eee9f17a3b598fd86417a980b591fbe6"
// };

const PRIVATE_JWT_RS384 = {
    "kty": "RSA",
    "alg": "RS384",
    "n": "wJq2RHIA-7RT6q4go7wjcbHdW7ck7Kz22A8wf-kN7Wi5CWvhFG2_Y7nQp1lDpb2IKMQr-Q4n_vgJ6d5rWPspJpSPY7iffUK4ipQCEbzID5DJ6fQMBZOfCTXyxkuMh3jYGKEF3Ziw2oxbM1H9j-eJAPtrj5stUG6kVoXowegdox-bSjWP0iI5PnkwUNzcekLMug4M3LRluEQgGR9O_BAML6-w3igZ_rZA_gunyrLAMbfmCVaceW5ohLp679kyM7U6W2gDK_NbkDKcINUakVmPeoG5h8RzgGzvGrySR0k0VDFiZv60Ua07DqHTeDGH9e4NV07AECae-oykIj5NDCs3pw",
    "e": "AQAB",
    "d": "O7k9v6eiSmq2gtUP5fXW_9BplaEK4CEaQhEjtuYrnWyVxCghmVYWvPPHkb0KTwCgkhOSlx4epN-BI3YGz4bCUeZLOF7thcgEtWQD6EAjwT_ifJtihvAppo-GAps2rmN4jtqPmRFZ9csEFLvd5pujThyoU9WIjaJhbzsC2-4AEq6WgCDsjdxJ9AXz379vUaoSFAk_ETMRnFSUP-dCJqi_yUrS5h2Tr6rosKP3I_93tt2p2wtOfIjaq7fYipXS7_daHh7hSehEcRHkHI3faaDKY0UwqJa4icHtbX8KgayP6NPUQ-Xv8GMIii3cksRqktDuODHgqGpfkOCii4loS0B-wQ",
    "p": "58yRMh3SBFkK0n9ulWDADANqXVGwozMHf9m5nh0sDFSy9v8dTCvTBbzP2wN4pP0cYhIrPYyeBm724lvp7FFzgIz7u2UUIU_Q2-x5VWPy97ZI-V5_eooC58y8DdNbi89D4TzsTJaraEhcqcFH2gI4R-RP01ViKDg2EOzYu2105xE",
    "q": "1LaQOiUsaGO7T7aIKgLxvLs7uEekqoSN3tl-ALZxO8RhUyRYjmtH51aKLq8bublqM3XoXBSA4TVm07qUBmWKfHCCz8QhorDFDVgVlEGUMcdmyBmoH5RaEMj4R19oG7C-emP3TFCfzjlnRELuP3v-HdEe6SxoADQwYzyAjduSYzc",
    "dp": "oIbQ_s4cBZrMnd5WbOil1yv-W0YZd8v9I5Nasp8tRBTcI6WlWnz3FQAfSmNrB4eqQlimzWc2gOoT28sfguMdhCcepjZn7HHkCIoJtRMUzmvUua2xxuERBgqJKWH4Aii1r6SLWLb3Wa7TTVRnOBlVdKQujAKTiZr0BmCf75zr2qE",
    "dq": "BJA-G-E8SKkLFbS2yx_xC7mAmH2A_N-HI6bK2z0OxNd7twrqk3OdwUrMACBlmeBudNgsufz-ntZEdHpmPpTjGbRYOhjdF95u-9BN9jZJ9Z9vhw912eeW3xFQskdLtnxeOcX3Qj3gj84PdxlwfxAr7XvVC--V85srBpX_tAtn4pU",
    "qi": "z24jzWhTRZ-x_zsH2wiSKmqg0wXOWO_BCnHA7lC6mMZCj-mQqY-PrZbrrii46ZoGxKWt12bnlHs5OCHtcwcuLrczXCyZPWImbG6Aqch7GVeChzBhdrnflUgt5Y1TmDLMrFmXUIZ2mSMbyN5xZZ4IwfoAq1fOLvXeQny4er2pyxo",
    "key_ops": [
        "sign"
    ],
    "ext": true,
    "kid": "eee9f17a3b598fd86417a980b591fbe6"
};

function reducer(state: State, action: Partial<State>) {
    return { ...state, ...action };
}

function WellKnownConfig({ state, dispatch }: StepProps)
{
    const url = new URL(state.aud + "/.well-known/smart-configuration");

    const { loading, error, data } = useFetch<Record<string, any>>(url.href)

    useEffect(() => {
        if (data?.token_endpoint) {
            dispatch({ tokenEndpoint: data.token_endpoint })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.token_endpoint])

    return (
        <details open={!!error}>
            <summary>
                <b>1. Retrieve .well-known/smart-configuration</b> {
                    loading && <i className="fa-solid fa-spinner fa-spin"></i>
                }
            </summary>
            <div style={{ paddingLeft: 30 }}>
                <details>
                    <summary className="text-info"><b>Request</b></summary>
                    <pre style={{ whiteSpace: "pre-wrap", padding: "2px 10px" }}>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>GET</b> <span style={{ color: "rgb(131, 108, 40)" }}>{url.pathname.replace(/\/sim\/.*?\//, "/sim/...../")} HTTP/1.1</span></div>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>Host:</b> <span style={{ color: "rgb(131, 108, 40)" }}>{url.host}</span></div>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>Accept:</b> <span style={{ color: "rgb(131, 108, 40)" }}>application/json</span></div>
                    </pre>
                    <br/>
                </details>
                <details open={!!error}>
                    <summary className={ error ? "text-danger" : "text-success" }><b>Response</b></summary>
                    { error ?
                        <div className="alert alert-danger">{ error + "" }</div> :
                        <SyntaxHighlighter language="json" style={xcode}>{
                            JSON.stringify(data || "null", null, 4)
                                .replace(/\/sim\/.*?\//g, "/sim/...../")
                        }
                        </SyntaxHighlighter> }
                </details>
            </div>
        </details>
    );
}

function LaunchForm({ state, dispatch }: StepProps) {
    const [_scope   , setScope   ] = useState(state.scope)
    const [_clientId, setClientId] = useState(state.clientId)
    const [_jwksUrl , setJwksUrl ] = useState(state.jwksUrl)

    return (
        <details>
            <summary><b>2. Customize Launch (optional)</b></summary>
            <div style={{ paddingLeft: 30 }}>
                <form onSubmit={e => {
                    e.preventDefault()
                    dispatch({
                        scope: _scope,
                        clientId: _clientId,
                        jwksUrl: state.client.jwks_url ? _jwksUrl : undefined
                    })
                }}>
                    <div className="panel mb-2" style={{ display: "block", background: "#F8F8F8" }}>
                        <div className="row">
                            <div className="col-sm-6">
                                <div className="form-group">
                                    <label className="text-primary" htmlFor="scope">Scope</label>
                                    <input
                                        id="scope"
                                        className="form-control"
                                        type="text"
                                        value={ _scope }
                                        onChange={ e => setScope(e.target.value) }
                                    />
                                    <span className="help-block small">
                                        {
                                            state.client.scope ? 
                                            <>
                                                Your client is currently allowed to request <code>{ state.client.scope }</code>. You can
                                                try requesting a different scope here to test the "invalid scope" errors.
                                            </> :
                                            <>
                                                You have not specified any scopes in the registration options of the launcher.
                                                In this case we grant any scope as if it has been allowed at registration time.
                                            </>
                                        }
                                    </span>
                                </div>
                            </div>
                            <div className="col-sm-6">
                                <div className="form-group">
                                    <label className="text-primary" htmlFor="client_id">Client ID</label>
                                    <input
                                        id="client_id"
                                        className="form-control"
                                        type="text"
                                        value={ _clientId }
                                        onChange={ e => setClientId(e.target.value) }
                                    />
                                    <span className="help-block small">
                                        {
                                            state.client.client_id ? 
                                            <>
                                                Your registered client_id is <code>{ state.client.client_id }</code>. You can try using a
                                                different one here to test the "invalid client_id" error.
                                            </> :
                                            <>
                                                You have not specified any client ID in the registration options of the launcher.
                                                In this case we accept any client ID as if it has been registered.
                                            </>
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>
                        { state.client.jwks_url && (
                            <div className="row">
                                <div className="col-xs-12">
                                    <div className="form-group">
                                        <label className="text-primary" htmlFor="jwks_url">JWKS URL</label>
                                        <input
                                            id="jwks_url"
                                            className="form-control"
                                            type="text"
                                            value={ _jwksUrl }
                                            onChange={ e => setJwksUrl(e.target.value) }
                                        />
                                        <span className="help-block small">
                                            Your registered client states that your public keys are at <code>{ state.client.jwks_url }</code>. You
                                            can try using different URL here to see what error is received.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <hr/>
                        <button className="btn btn-primary pl-2 pr-2" type="submit">Launch</button>
                    </div>
                </form>
            </div>
        </details>
    )
}

function CreateAssertion({ state, dispatch }: StepProps)
{
    const exp = Math.round(Date.now()/1000) + 600;

    const [error, setError] = useState("")

    const jwt_headers = {
        typ: "JWT",
        alg: PRIVATE_JWT_RS384.alg,
        kid: PRIVATE_JWT_RS384.kid,
        jku: state.jwksUrl
    };

    if (state.jwksUrl) {
        jwt_headers.jku = state.jwksUrl
    }

    const jwt_claims = {
        iss: state.clientId,
        sub: state.clientId,
        aud: state.tokenEndpoint,
        exp,
        jti: "random-non-reusable-jwt-id-123"
    };

    useEffect(() => {
        importJWK(PRIVATE_JWT_RS384 as fhirclient.JWK)
        .then(privateKey => signCompactJws("RS384", privateKey, jwt_headers, jwt_claims))
        .then(assertion => dispatch({ assertion, accessToken: "" }))
        .catch(e => setError(e + ""))

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        state.clientId,
        state.tokenEndpoint,
        state.jwksUrl
    ]);


    return (
        <details open={!!error}>
            <summary><b>3. Create Client Assertion Token</b></summary>
            <div style={{ paddingLeft: 30 }}>
                <br/>
                <b className="text-danger">Pseudo Code:</b><br/><br/>

                <SyntaxHighlighter language="javascript" style={xcode} wrapLongLines>{
                `jwt_headers = ${ JSON.stringify(jwt_headers, null, 4)}\n\n` +
                `jwt_claims = ${ JSON.stringify({ ...jwt_claims, aud: jwt_claims.aud.replace(/\/sim\/.*?\//g, "/sim/...../") }, null, 4)}\n\n` +
                `private_key = ${ JSON.stringify(PRIVATE_JWT_RS384, null, 4) }\n\n` +
                `client_assertion = sign(jwt_claims, jwt_headers, private_key)\n`
                }</SyntaxHighlighter>

                <br/>

                { error && <b className="text-danger">{error}</b> }
            </div>
        </details>
    );
}

function GetAccessToken({ state, dispatch }: StepProps)
{
    const url = new URL(state.tokenEndpoint)

    const body = new URLSearchParams()

    body.set("scope", state.scope)
    body.set("client_assertion", state.assertion)
    body.set("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer")
    body.set("grant_type", "client_credentials")
    
    const { loading, error, data } = useFetch<Record<string, any>>(url.href, {
        method: "POST",
        body,
        headers: {
            accept: "application/json"
        }
    }, [state.scope, state.assertion])

    const expired = state.accessTokenExpiresAt <= Date.now() + 10000

    useEffect(() => {
        if (data?.access_token) {
            dispatch({
                accessToken: data.access_token,
                accessTokenExpiresAt: Date.now() + data.expires_in * 1000
            })
        } else if (error) {
            dispatch({ accessToken: "" })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error, data?.access_token, data?.expires_in, expired])

    return (
        <details open={!!error}>
            <summary><b>4. Retrieve Access Token</b> {
                loading && <i className="fa-solid fa-spinner fa-spin"></i>
            }</summary>
            <div style={{ paddingLeft: 30 }}>
                <details open>
                    <summary className="text-info"><b>Request</b></summary>
                    <pre style={{ whiteSpace: "pre-wrap", padding: "2px 10px" }}>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>POST</b> <span style={{ color: "rgb(131, 108, 40)" }}>{url.pathname.replace(/\/sim\/.*?\//, "/sim/...../")} HTTP/1.1</span></div>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>Host:</b> <span style={{ color: "rgb(131, 108, 40)" }}>{url.host}</span></div>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>Accept:</b> <span style={{ color: "rgb(131, 108, 40)" }}>application/json</span></div>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>Content-Type:</b> <span style={{ color: "rgb(131, 108, 40)" }}>application/x-www-form-urlencoded;charset=UTF-8</span></div>
                        <br/>
                        <div>
                            <b style={{ color: "rgb(170, 13, 145)" }}>scope</b>=<span style={{ color: "rgb(131, 108, 40)" }}>{encodeURIComponent(state.scope)}</span><br/>
                            <b style={{ color: "rgb(170, 13, 145)" }}>client_assertion</b>=<span style={{ color: "rgb(131, 108, 40)" }}><Clip txt={encodeURIComponent(state.assertion!)} max={40} /></span><br/>
                            <b style={{ color: "rgb(170, 13, 145)" }}>client_assertion_type</b>=<span style={{ color: "rgb(131, 108, 40)" }}>{encodeURIComponent("urn:ietf:params:oauth:client-assertion-type:jwt-bearer")}</span><br />
                            <b style={{ color: "rgb(170, 13, 145)" }}>grant_type</b>=<span style={{ color: "rgb(131, 108, 40)" }}>client_credentials</span>
                        </div>
                    </pre>
                    <br/>
                </details>
                <details open>
                    <summary className={ error ? "text-danger" : "text-success" }><b>Response</b></summary>
                    { error ?
                        <div className="alert alert-danger">{ error + "" }</div> :
                        <SyntaxHighlighter language="json" style={xcode} wrapLongLines>
                            { JSON.stringify(data, null, 4)}
                        </SyntaxHighlighter>
                    }
                </details>
            </div>
        </details>
    );
}

function FetchPatients({ state }: { state: State })
{
    const url = new URL(state.aud + "/Patient");
    
    const { loading, error, data } = useFetch(url.href, {
        headers: {
            accept: "application/json",
            authorization: `Bearer ${state.accessToken}`
        }
    }, [state.accessToken]);

    return (
        <details open>
            <summary><b>5. Access FHIR API</b> to get a list of Patients {
                loading && <i className="fa-solid fa-spinner fa-spin"></i>
            }</summary>
            <div style={{ paddingLeft: 30 }}>
                <details>
                    <summary className="text-info"><b>Request</b></summary>
                    <pre style={{ whiteSpace: "pre-wrap", padding: "2px 10px" }}>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>GET</b> <span style={{ color: "rgb(131, 108, 40)" }}>{url.pathname.replace(/\/sim\/.*?\//, "/sim/...../")} HTTP/1.1</span></div>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>Host:</b> <span style={{ color: "rgb(131, 108, 40)" }}>{url.host}</span></div>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>Accept:</b> <span style={{ color: "rgb(131, 108, 40)" }}>application/json</span></div>
                        <div><b style={{ color: "rgb(170, 13, 145)" }}>Authorization:</b> <span style={{ color: "rgb(131, 108, 40)" }}>Bearer <Clip txt={state.accessToken} max={20} /></span></div>
                    </pre>
                    <br/>
                </details>
                <details open>
                    <summary className={ error ? "text-danger" : "text-success" }><b>Response</b></summary>
                    { error ?
                        <div className="alert alert-danger">{ error + "" }</div> :
                        <SyntaxHighlighter language="json" style={xcode} wrapLongLines>{ JSON.stringify(data, null, 4)}</SyntaxHighlighter> }
                </details>
            </div>
        </details>
    );
}

export default function LaunchBS() {

    const [searchParams] = useSearchParams()

    const audParam = searchParams.get("aud") || ""

    const sim = audParam.match(/\/sim\/(.*?)\/fhir/)?.[1]

    const client = decode(sim || encode({ launch_type: "backend-service", client_type: "backend-service", pkce: "none" }))

    const [state, dispatch] = useReducer<Reducer<State, Partial<State>>>(
        reducer,
        {
            aud          : audParam || "",
            clientId     : client.client_id || "whatever",
            scope        : client.scope || "system/*.read",
            tokenEndpoint: "",
            accessToken  : "",
            assertion    : "",
            jwksUrl      : client.jwks_url || undefined,
            accessTokenExpiresAt: Date.now(),
            client
        }
    );

    if (!audParam) {
        return (
            <div className="container">
                <br/>
                <div className="alert alert-danger">An 'aud' URL parameter is required</div>
            </div>
        )
    }

    return (
        <HelmetProvider>
            <Helmet>
                <title>SMART Launcher - Sample Backend Service App</title>
            </Helmet>
            <div className="container">
                <h3>SMART Backend Service <span className="text-muted">Sample App</span></h3>
                <hr/>
                { !client.jwks && !client.jwks_url && (
                    <p className="alert alert-warning" style={{ flex: "1 1 100%" }}>
                        <i className="glyphicon glyphicon-info-sign" /> This
                        app can be authorized using the public keys found
                        at <a href="https://www.hl7.org/fhir/smart-app-launch/RS384.public.json" target="_blank" rel="noreferrer noopener">
                            https://www.hl7.org/fhir/smart-app-launch/RS384.public.json
                        </a>
                    </p>
                )}
                <WellKnownConfig state={state} dispatch={dispatch} />
                <LaunchForm state={state} dispatch={dispatch} />
                { state.tokenEndpoint && <CreateAssertion state={state} dispatch={dispatch} /> }
                { state.assertion && <GetAccessToken state={state} dispatch={dispatch} /> }
                { state.accessToken && <FetchPatients state={state} /> }
            </div>
        </HelmetProvider>
    )
}