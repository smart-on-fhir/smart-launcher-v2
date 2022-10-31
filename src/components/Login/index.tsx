import { FormEvent, useEffect, useRef, useState } from "react"
import { Helmet, HelmetProvider }                 from "react-helmet-async"
import { useSearchParams }                        from "react-router-dom"
import useFetch                                   from "../../hooks/useFetch"
import { ACCESS_TOKEN, humanName }                from "../../lib"


export default function Login() {

    const [searchParams] = useSearchParams();
    const [id, setId]    = useState("")

    const loginType = String(searchParams.get("login_type") || "")
    const aud       = String(searchParams.get("aud") || "")
    const patient   = String(searchParams.get("patient" ) || "").trim().split(/\s*,\s*/).filter(Boolean)
    const provider  = String(searchParams.get("provider") || "").trim().split(/\s*,\s*/).filter(Boolean)

    
    const submitButton = useRef<HTMLButtonElement>(null);

    let url;
    if (loginType === "provider") {
        url = new URL(aud + "/Practitioner?_count=10&_summary=true&_sort=given")
        if (provider.length) url.searchParams.set("_id", provider.join(","))
    }
    else {
        url = new URL(aud + "/Patient?_count=10&_summary=true&_sort=given")
        if (patient.length) url.searchParams.set("_id", patient.join(","))
    }

    const fetchUrl = url.href

    function submit(e: FormEvent) {
        e.preventDefault()
        const url = new URL(searchParams.get("aud")!.replace(/\/fhir/, "/auth/authorize"))
        url.search = window.location.search
        url.searchParams.set("login_success", "1")
        if (loginType === "provider") {
            url.searchParams.set("provider", id)
        } else {
            url.searchParams.set("patient", id)
        }
        
        window.top?.postMessage({
            type: "setUser",
            payload: recs.find(rec => rec.id === id)
        }, window.location.origin);
        
        window.location.href = url.href;
    }

    
    const { data: bundle, loading } = useFetch<fhir4.Bundle<fhir4.Patient|fhir4.Practitioner>>(fetchUrl, {
        headers: {
            authorization: `Bearer ${ACCESS_TOKEN}`
        }
    })
    const recs    = bundle?.entry?.map(e => e.resource!) || []
    const noData  = (!loading && !recs.length)
    const firstID = recs[0]?.id
    
    useEffect(() => {
        if (firstID) {
            setId(firstID)
            setTimeout(() => submitButton.current!.focus(), 0);
        }
    }, [firstID])

    return (
        <HelmetProvider>
            <Helmet>
                <title>SMART Launcher - { loginType === "provider" ? "Practitioner" : "Patient" } Login</title>
            </Helmet>
            <div className="container-fluid" style={{
                maxWidth: "40em",
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center"
            }}>
                <div className="row">
                    <div className="col-sm-12">
                        <h2 className="mt-0">
                            <img src="/logo.png" alt="SMART Logo" height={28} style={{ margin: "-6px 10px 0 0" }} />
                            { loginType === "provider" ? "Practitioner " : "Patient " } Login
                        </h2>
                        <hr/>
                    </div>
                </div>


                <div className="row">
                    <div className="col-sm-12">
                        { noData && <div className="alert alert-danger">
                            <h5><i className="glyphicon glyphicon-exclamation-sign" /> No { loginType === "provider" ? "Providers" : "Patients"} Found!</h5>
                            <small>Continue without a user, or return to the launch screen to include additional data.</small>
                        </div> }
                        {
                            loginType === "provider" ?
                                <div className="form-group">
                                    <label>Practitioner</label>
                                    <select className="form-control" value={id} onChange={e => setId(e.target.value)}>
                                        <option value="">Please Select</option>
                                        { recs.map((rec, i) => (
                                            <option value={rec.id} key={i}>{ humanName(rec) }</option>
                                        )) }
                                    </select>
                                </div> :
                                <div className="form-group">
                                    <label>Patient</label>
                                    <select className="form-control" value={id} onChange={e => setId(e.target.value)}>
                                        <option value="">Please Select</option>
                                        { recs.map((rec, i) => (
                                            <option value={rec.id} key={i}>{ humanName(rec) }</option>
                                        )) }
                                    </select>
                                </div>
                        }
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input type="password" defaultValue="demo-password" className="form-control" disabled />
                            <div className="help-text text-muted">
                                This login is for demonstration purposes only. ANY password will be accepted.
                            </div>
                        </div>

                        <hr/>
                        <div className="form-group">
                            <div className="col-xs-12 text-center">
                                <button
                                    type="button"
                                    className="btn btn-success"
                                    style={{ minWidth: "6em" }}
                                    onClick={submit}
                                    disabled={!id}
                                    ref={submitButton}
                                >
                                    { noData ? "Continue Without User" : "Login" }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </HelmetProvider>
    )
}