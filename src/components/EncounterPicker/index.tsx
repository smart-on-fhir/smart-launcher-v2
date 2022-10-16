
import { Encounter }             from "fhir/r4"
import moment                    from "moment"
import { useEffect, useReducer } from "react"
import { useSearchParams }       from "react-router-dom"
import { humanName }             from "../../lib"
import "./encounter-picker.css"


interface EncounterPickerState {
    data          : fhir4.Bundle<fhir4.Encounter> | null
    error         : Error | null
    loading       : boolean
    skip          : number
    pageSize      : number
    baseUrl       : string
    patient       : string
    selectFirst   : boolean
    patientData  ?: fhir4.Patient
}

interface PatientPickerAction {
    type: string
    payload: any
}

const initialState: EncounterPickerState = {
    data          : null,
    error         : null,
    loading       : true,
    pageSize      : 10,
    skip          : 0,
    patient       : "",
    baseUrl       : "",
    selectFirst   : false
}

function reducer(state: EncounterPickerState, action: PatientPickerAction): EncounterPickerState {
    switch (action.type) {
        case "setData":
            return { ...state, data: action.payload };

        case "setError":
            return { ...state, error: action.payload };
        
        case "setLoading":
            return { ...state, loading: action.payload };

        case "setPatientData":
            return { ...state, patientData: action.payload };

        case "setStartRec":
            return { ...state, skip: action.payload };

        case "merge":
            return { ...state, ...action.payload };

        default:
            throw new Error(`Unknown action "${action.type}"`);
    }
}

function EncounterType({ encounter }: { encounter: fhir4.Encounter }) {
    var result = encounter.type?.[0]?.text;
    if (result) {
        return <b>{result}</b>;
    }
    
    var _class = getEncounterClass(encounter);
    if (_class) {
        return <span className="text-muted">{ _class } encounter</span>;
    }
    return <small className="text-muted">N/A</small>;
}

function getEncounterClass(encounter: fhir4.Encounter) {
    return encounter.class && typeof encounter.class == "object" ?
        encounter.class?.display :
        encounter.class;
}

function Period({ period }: { period: fhir4.Period }) {
    if (period.start && period.end) {
        const from = moment(period.start);
        const to   = moment(period.end);

        if (from.isSame(to, "day")) {
            return (
                <span>
                    { from.format("MM/DD/YYYY") }
                    { !from.isSame(to, "hour") && <span>
                        <span className="text-muted"> &nbsp; { from.format("HH:mm")
                        } to { to.format("HH:mm") }</span>
                    </span> }
                </span>
            )
        }
        else {
            return (
                <span>
                    { from.format("MM/DD/YYYY") }
                    <small className="text-muted"> to </small>
                    { to.format("MM/DD/YYYY") }
                </span>
            );
        }
    }

    else {
        if (period.start) {
            const from = moment(period.start);
            return (
                <span>
                    <small className="text-muted"> from </small>
                    { from.format("MM/DD/YYYY") }
                </span>
            )
        }
        else if (period.end) {
            const to   = moment(period.end);
            return (
                <span>
                    <small className="text-muted"> to </small>
                    { to.format("MM/DD/YYYY") }
                </span>
            )
        }
    }

    return <small className="text-muted">N/A</small>
}

async function fetchPatient(baseUrl: string, id: string): Promise<fhir4.Patient> {
    const res = await fetch(baseUrl + "/Patient/" + id, { mode: "cors" })
    const txt = await res.text()
    
    if (!res.ok) {
        let msg = txt
        try { msg = JSON.stringify(JSON.parse(txt), null, 4) } catch {}
        throw new Error(msg)
    }

    return JSON.parse(txt)
}

async function fetchEncounters(baseUrl: string, patientId: string, pageSize = 10): Promise<fhir4.Bundle<Encounter>> {
    const url = new URL(baseUrl + "/Encounter")
        
    url.searchParams.set("_count"    , pageSize + "")
    url.searchParams.set("patient"   , patientId    )
    url.searchParams.set("_sort:desc", "date"       )

    const res = await fetch(url, { mode: "cors" })
    const txt = await res.text()
    
    if (!res.ok) {
        let msg = txt
        try { msg = JSON.stringify(JSON.parse(txt), null, 4) } catch {}
        throw new Error(msg)
    }

    return JSON.parse(txt)
}

export default function EncounterPicker() {

    let [searchParams] = useSearchParams();
    
    const [state, dispatch] = useReducer(reducer, {
        ...initialState,
        baseUrl: searchParams.get("aud") + "",
        patient: (searchParams.get("patient") || "").trim()
    });

    const {
        error,
        data,
        loading,
        pageSize,
        skip,
        baseUrl,
        patient,
        patientData
    } = state;

    // Next pagination link
    const next = data?.link?.find(l => l.relation === "next")?.url

    // Prev pagination link
    const prev = data?.link?.find(l => l.relation === "previous")?.url
    
    // Total recs in pagination (if available)
    const totalRecs = data?.total;

    // End rec in pagination
    const endRec = totalRecs ? Math.min(skip + pageSize, totalRecs) : skip + pageSize;
    
    // Enter or Space clicks on focused rows
    const selectKeys = ["Enter", " "];

    // FHIR Server URL (displayed in the header)
    const cleanBaseUrl = new URL(baseUrl)
    cleanBaseUrl.search = ""

    // What happens when we click on encounter
    function launchApp(id = "-1") {

        // @ts-ignore We might be in a frame and have to call setEncounterID
        // in the parent window
        window.top?.postMessage({
            type: "setEncounterID",
            payload: id
        }, window.location.origin);

        const url = new URL(searchParams.get("aud")!.replace(/\/fhir$/, "/auth/authorize"))
        url.search = window.location.search
        url.searchParams.set("encounter", id)
        window.location.href = url.href;
    }

    useEffect(() => {

        if (!patient) {
            dispatch({ type: "setError", payload: '"patient" parameter is required!' });
            return;
        }

        if (Array.isArray(patient)) {
            dispatch({ type: "setError", payload: '"patient" parameter must be provided exactly once!' });
            return;
        }

        dispatch({ type: "setLoading", payload: true })

        Promise.all([
            fetchEncounters(baseUrl, patient, pageSize).then(encounters => {
                if (searchParams.get("select_first") === "true") {
                    const id = encounters.entry?.[0]?.resource?.id
                    if (id) {
                        // console.log("Launching: ", id)
                        launchApp(id)
                        return new Promise(() => {}); // leave it pending (we will redirect)
                    }
                }
                return encounters
            }),
            patientData || fetchPatient(baseUrl, patient)
        ])
        .then(([encounters, patient]) => {
            dispatch({
                type: "merge",
                payload: {
                    data: encounters,
                    patientData: patient
                }
            })
        })
        .catch(error => dispatch({ type: "setError", payload: error }))
        .finally(() => dispatch({ type: "setLoading", payload: false }))

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ pageSize, baseUrl, patient ])
    

    return (
        <>
            <div className="container-fluid encounter-picker" style={{ maxWidth: "80em" }}>
                { error && <div className="row">
                    <br />
                    <div className="col-sm-12">
                        <pre className="alert alert-danger">
                            <span className="glyphicon glyphicon-exclamation-sign"/> <span>
                            { String(error || "An error occurred loading patient encounters. Please try again later.") }</span>
                        </pre>
                    </div>
                </div> }

                <div className="row">
                    <div className="col-sm-12">
                        <h2 className="mt-1">
                            <img src="/logo.png" alt="SMART Logo" height={28} style={{ margin: "-6px 10px 0 0" }} />
                            Select Encounter { patientData && <span className="text-muted"> <span style={{fontWeight: "normal"}}>for</span> { humanName(patientData) }</span> }
                        </h2>
                        {/* <div className="text-muted">
                            FHIR Server: <a target="_blank" rel="noreferrer noopener" href={ cleanBaseUrl.href }>{ cleanBaseUrl.href }</a>
                        </div> */}
                    </div>
                </div>
                <br/>
                <div className="row">
                    <div className="col-sm-12">
                        <table className="table mb-0">
                            <thead>
                                <tr className="no-hover">
                                    <th style={{ width: 0 }}></th>
                                    <th>Type</th>
                                    <th>Reason</th>
                                    <th>Class</th>
                                    <th>Status</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                { loading && !data && <tr id="message-loading" className="no-hover">
                                    <td colSpan={6} style={{ textAlign: "center", padding: 40 }}>
                                        Loading...
                                    </td>
                                </tr> }
                                { data && !data.entry?.length && <tr id="message-no-patients" className="no-hover">
                                    <td colSpan={6} style={{ textAlign: "center", padding: 40 }}>
                                        <b className="text-danger">No encounters found</b>
                                    </td>
                                </tr> }
                                
                                { data?.entry?.map((p: fhir4.BundleEntry<fhir4.Encounter>, i) => (
                                    <tr
                                        key={i}
                                        tabIndex={0}
                                        onClick={() => launchApp(p.resource!.id!)}
                                        onKeyDown={ e => { if (selectKeys.includes(e.key)) launchApp(p.resource!.id!) }}
                                        title={ `Click to select encounter with ID ${p.resource!.id}` }
                                    >
                                        <td><input type="radio" style={{ marginRight: "1ex" }} disabled/></td>
                                        <td><EncounterType encounter={ p.resource! } /></td>
                                        <td>{p.resource!.reasonCode?.[0].coding?.[0].display || <span className="text-muted">-</span>}</td>
                                        <td>{getEncounterClass(p.resource!) || <span className="text-muted">-</span>}</td>
                                        <td>{p.resource?.status || <span className="text-muted">N/A</span>}</td>
                                        <td>{p.resource?.period && <Period period={p.resource.period} />}</td>
                                    </tr>
                                )) }
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={6} style={{ padding: "1em 0 0" }}>
                                        <br/>
                                        <div>
                                            <div className="pull-left text-muted" style={{ padding: "8px 0" }}>
                                                { data?.total ?
                                                    <>Encounters { skip + 1 } to { endRec } of { totalRecs }</> :
                                                    null
                                                }
                                            </div>
                                            <div className="pull-right">
                                                <button
                                                    className="btn btn-default btn-sm"
                                                    disabled={!prev}
                                                    style={{ minWidth: "7em" }}
                                                    type="button"
                                                    onClick={ () => dispatch({ type: "merge", payload: { baseUrl: prev }}) }
                                                >
                                                    <span className="glyphicon glyphicon-menu-left"></span> Previous
                                                </button>
                                                &nbsp;
                                                <button
                                                    className="btn btn-default btn-sm"
                                                    disabled={!next}
                                                    style={{ minWidth: "7em" }}
                                                    onClick={ () => dispatch({ type: "merge", payload: { baseUrl: next }}) }
                                                >
                                                    Next <span className="glyphicon glyphicon-menu-right"></span>
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </>
    )
}
