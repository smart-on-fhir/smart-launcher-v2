import { useState } from "react";
import ScopeSet from "../../isomorphic/ScopeSet";

const SCOPES = [
    {
        value: "openid",
        description: <>Combine this with <code>fhirUser</code> or <code>profile</code> to
            get an ID Token and to be able to query information about the
            current user.</>
    },
    {
        value: "fhirUser",
        description: <>Combine this with <code>openid</code> to get an ID Token and to be
            able to query information about the current user.</>
    },
    {
        value: "profile",
        description: <>Combine this with <code>openid</code> to get an ID Token and to be
            able to query information about the current user.</>
    },
    {
        value: "offline_access",
        description: <>Use this to get a Refresh Token and to be able to use the app for
                long periods of time without having to re-launch it.</>
    },
    {
        value: "online_access",
        description: <>Use this to get a Refresh Token and to be able to use the app for
            long periods of time without having to re-launch it, as long as the
            app is not closed.</>
    },
    {
        value: "smart/orchestrate_launch",
        description: <>Use this if your app needs to be able to launch other SMART apps.</>
    },
    {
        value: "launch/patient",
        description: <>Use this to obtain patient context in apps that use a standalone
            launch sequence.</>
    },
    {
        value: "launch/encounter",
        description: <>Use this to obtain encounter context in apps that use a standalone
            launch sequence.</>
    },
    {    
        value: "patient/*.*",
        description: <>Use this to get full access to patient information.</>
    },
    {
        value: "user/*.*",
        description: <>Use this to get full access to information that the user can access.</>
    }
];

export default function ScopeEditor({ value = "", onChange }: { value?: string, onChange: (scope: string) => void })
{
    const initialScopes = value.trim().split(/\s+/)

    const wellKnownScopeSet = new ScopeSet()
    const customScopeSet = new ScopeSet()

    initialScopes.forEach(name => {
        if (SCOPES.find(s => s.value === name)) {
            wellKnownScopeSet.add(name)
        } else {
            customScopeSet.add(name)
        }
    })

    const [customScopes, setCustomScopes] = useState(customScopeSet.toString())

    function notifyChange() {
        console.log([wellKnownScopeSet.toString(), customScopes].join(" "))
        onChange([wellKnownScopeSet.toString(), customScopes].join(" "))
    }

    return (
        <>
            { SCOPES.map((s, i) => (
                <div className="col-xs-12 col-sm-6 col-md-4 col-lg-3" key={i}>
                    <div className="checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={ wellKnownScopeSet.has(s.value) }
                                onChange={ e => {
                                    wellKnownScopeSet[e.target.checked ? "add" : "remove"](s.value);
                                    notifyChange()
                                }}
                            /> { s.value }
                            <div className="help-block small">{ s.description }</div>
                        </label>
                    </div>
                </div>    
            ))}
            
            
            <div className="col-xs-12 col-md-8 col-lg-6">
                <div className="form-group">
                    <label>Other Scopes</label> <span className="text-muted">(space separated list)</span>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Example: patient/Observation.read user/Encounter.rs"
                        value={ customScopes }
                        onChange={e => {
                            setCustomScopes(e.target.value)
                            notifyChange()
                        }}
                    />
                </div>
            </div>
        </>
    )
}