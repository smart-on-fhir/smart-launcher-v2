import { useSearchParams }        from "react-router-dom"
import { useEffect, useState }    from "react"
import { Helmet, HelmetProvider } from "react-helmet-async"
import { formatAge, humanName }   from "../../lib"
import "./style.css"


export default function EHR() {
    const [searchParams] = useSearchParams()
    const [user, setUser] = useState<fhir4.Patient | fhir4.Practitioner | null>(null)
    const [patient, setPatient] = useState<fhir4.Patient | null>(null)
    const [encounterID, setEncounterID] = useState<string>("Unknown")

    useEffect(() => {
        function onMessage(event: MessageEvent) {
            if (event.origin === window.location.origin) {
                switch (event.data.type) {
                    case "setUser":
                        setUser(event.data.payload);
                    break;
                    case "setPatient":
                        setPatient(event.data.payload);
                    break;
                    case "setEncounterID":
                        setEncounterID(event.data.payload);
                    break;
                    default:
                        console.warn("Invalid post message:", event);
                    break;
                }
            }
        }

        window.addEventListener("message", onMessage, false);

        return () => window.removeEventListener("message", onMessage, false);
    }, [])

    const launchUrl = searchParams.get("app")

    if (!launchUrl) {
        return (
            <div className="ehr">
                <div className="alert alert-danger">
                    An "app" URL parameter is required
                </div>
            </div>
        )
    }

    let patientID   = patient?.id ?? "Unknown"
    let userID      = user?.id ?? "Unknown"
    let patientName = patient ? humanName(patient) : "Unknown"
    let patientAge  = patient && patient.birthDate ? formatAge(patient) || "Unknown" : "Unknown"
    let patientSex  = patient?.gender || "Unknown"
    let userName    = user ? humanName(user) : "Unknown"

    return (
        <HelmetProvider>
            <Helmet>
                <title>SMART Launcher - EHR View</title>
            </Helmet>
            <div className="ehr">
                <div className="ehr-header">
                    <div className="flex-row">
                        <div className="logo">
                            <img src="/logo.png" alt="SMART Logo" /> Simulated EHR
                        </div>
                        <div>
                            <i className="glyphicon glyphicon-user"/>&nbsp;
                            patient: <b>{ patientName }</b>,
                            age: <b>{ patientAge }</b>{patient?.deceasedBoolean || patient?.deceasedDateTime ? " (deceased)" : ""},
                            sex: <b>{ patientSex }</b>
                        </div>
                        <div>
                            <i className="glyphicon glyphicon-user"/>&nbsp;
                            user: <b>{ userName }</b>
                        </div>
                    </div>
                </div>
                <div className="ehr-main-row">
                    <div className="ehr-sidebar">
                        <h3>EHR Sidebar</h3>
                    </div>
                    <iframe
                        name="iframe"
                        id="frame"
                        title="EHR Frame"
                        src={launchUrl + ""}
                        sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-downloads"
                        allow="microphone *; camera *">
                    </iframe>
                    <div className="ehr-sidebar">
                        <h3>EHR Sidebar</h3>
                    </div>
                </div>
                <div className="ehr-status-bar">
                    <div className="flex-row">
                        <div className="text-muted" style={{ flex: "0 1 auto" }}>EHR Status bar</div>
                        <div>Patient ID: { patientID }</div>
                        <div>User ID: { userID }</div>
                        <div>Encounter ID: { encounterID }</div>
                    </div>
                </div>
            </div>
        </HelmetProvider>
    )
}