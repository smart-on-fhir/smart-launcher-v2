import { oauth2 }     from "fhirclient"
import { useState }   from "react"
import ScopeEditor    from "./ScopeEditor"
import { fhirclient } from "fhirclient/lib/types"


export default function LaunchPanel({
    scope,
    aud,
    client_id,
    isOpen,
    pkce = "ifSupported"
}: {
    scope?: string
    aud?: string
    client_id?: string
    isOpen?: boolean
    pkce?: fhirclient.PkceMode
})
{
    const [open, setOpen] = useState(!!isOpen)

    const [clientId, setClientId] = useState(client_id)

    const [scopes, setScopes] = useState(scope)

    const [pkceMode, setPkceMode] = useState<fhirclient.PkceMode>(pkce)

    const launchParams = JSON.parse(window.sessionStorage.launchParams || "{}")

    function launch() {

        const authorizeParams = {
            clientId,
            scope: scopes,
            iss: aud
        }
        
        oauth2.authorize({
            ...authorizeParams,
            redirectUri: window.location.pathname,
            pkceMode: pkceMode as fhirclient.PkceMode,
            clientSecret: launchParams.client_secret,
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
        });
    }

    return (
        <div>
            { !isOpen && (
            <div className="row">
                <div className="col-xs-12">
                    <h4 onClick={ () => setOpen(!open) } style={{ margin: 0 }}>
                        { open ?
                            <i className="glyphicon glyphicon-chevron-down" style={{ position: "relative", top: 3 }} /> :
                            <i className="glyphicon glyphicon-chevron-right" /> } Launch App
                            { !open && <span className="text-muted small">&nbsp; Click to expand</span> }
                    </h4>
                    { open && <hr className="mt-2"/> }
                </div>
            </div>)}
            { open &&
                <>
                <div className="row">
                    <div className="col-xs-12 col-sm-4 col-lg-3">
                        <div className="form-group">
                            <label>Client ID</label>
                            <input
                                type="text"
                                className="form-control"
                                value={ clientId }
                                onChange={ e => setClientId(e.target.value) }
                            />
                        </div>
                    </div>
                    <div className="col-xs-12 col-sm-4 col-lg-6">
                        <div className="form-group">
                            <label>Aud</label>
                            <input
                                type="text"
                                className="form-control"
                                defaultValue={aud}
                                readOnly
                            />
                        </div>
                    </div>
                    <div className="col-xs-12 col-sm-4 col-lg-3">
                        <div className="form-group">
                            <label>Use PKCE</label>
                            <select className="form-control" value={pkceMode} onChange={e => setPkceMode(e.target.value as fhirclient.PkceMode)}>
                                <option value="ifSupported">If supported</option>
                                <option value="required">Yes</option>
                                <option value="disabled">No</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="row">
                    <div className="col-xs-12">
                        <b>Scopes</b>
                        <hr/>
                    </div>
                </div>
                <div className="row flex-row">
                    <ScopeEditor value={ scopes } onChange={ setScopes } />
                </div>
                <div className="row text-center">
                    <div className="col-xs-12">
                        <div className="panel-footer">
                            <button className="btn btn-success pl-2 pr-2" onClick={launch}>Authorize</button>
                        </div>
                    </div>
                </div>
                </>
            }
            
        </div>
    )
}