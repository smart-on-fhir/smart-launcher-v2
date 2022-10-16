import { useEffect, useReducer }           from "react"
import { useSearchParams }                 from "react-router-dom"
import { formatAge, highlight, humanName } from "../../lib"
import "./patient-picker.css"


interface PatientPickerState {
    sortParam     : string 
    sortDir       : "asc" | "desc"
    data          : fhir4.Bundle<fhir4.Patient> | null
    error         : Error | null
    loading       : boolean
    skip          : number
    searchText    : string
    pageSize      : number
    baseUrl       : string
    patient       : string     
}

interface PatientPickerAction {
    type: string
    payload: any
}

const initialState: PatientPickerState = {
    sortParam     : "name", 
    sortDir       : "desc",
    data          : null,
    error         : null,
    loading       : true,
    pageSize      : 10,
    skip          : 0,
    searchText    : "",
    patient       : "",
    baseUrl       : "http://r4.smarthealthit.org/Patient"
}

function reducer(state: PatientPickerState, action: PatientPickerAction): PatientPickerState {
    switch (action.type) {
        case "setSort":
            if (state.sortParam !== action.payload) {
                return { ...state, sortParam: action.payload, sortDir: "asc" };
            }
            if (state.sortDir === "asc") {
                return { ...state, sortDir: "desc" };
            }
            return { ...state, sortParam: "", sortDir: "asc" };

        case "setData":
            return { ...state, data: action.payload };

        case "setError":
            return { ...state, error: action.payload };
        
        case "setLoading":
            return { ...state, loading: action.payload };

        case "search":
            return { ...state, searchText: action.payload };

        case "setBaseUrl":
            return { ...state, baseUrl: action.payload };

        case "setStartRec":
            return { ...state, skip: action.payload };

        default:
            throw new Error();
    }
}

function Gender({ patient }: { patient: fhir4.Patient }) {
    var gender = String(patient.gender || "-").charAt(0).toUpperCase();
    if (gender === "M")
        return <span className="male">M</span>
    if (gender === "F")
        return <span className="female">F</span>
    return <span style={{ color: "#666" }} title={ patient.gender }>{ gender }</span>
}

export default function PatientPicker() {

    let [searchParams] = useSearchParams();
    
    const [state, dispatch] = useReducer(reducer, {
        ...initialState,
        baseUrl: searchParams.get("aud") + "/Patient", // || window.location.href.split("?")[0].replace(/\/select-patient$/, "/fhir"),
        patient: (searchParams.get("patient") || "").split(/\s*,\s*/).map(s => s.trim()).join(",")
    });

    const {
        sortParam,
        sortDir,
        error,
        data,
        loading,
        pageSize,
        searchText,
        skip,
        baseUrl,
        patient
    } = state;

    useEffect(() => {
        dispatch({ type: "setLoading", payload: true })

        const url = new URL(baseUrl)
        if (searchText) {
            url.searchParams.set("name:contains", searchText);
        }
        
        url.searchParams.set("_format" , "application/json+fhir")
        url.searchParams.set("_summary", "true")
        url.searchParams.set("_count"  , pageSize + "")

        if (sortParam === "age") {
            url.searchParams.set("_sort:" + (sortDir === "asc" ? "desc" : "asc"), "birthdate")
        } else if (sortParam === "name") {
            url.searchParams.set("_sort:" + (sortDir === "asc" ? "desc" : "asc"), "family")
        } else {
            url.searchParams.set("_sort:" + (sortDir === "asc" ? "desc" : "asc"), sortParam)
        }

        if (patient) {
            url.searchParams.set("_id", patient)
        }

        // console.log("=====>", url.href)

        fetch(url, { mode: "cors" })
        .then(res => res.json())
        .then((data: fhir4.Bundle<fhir4.Patient>) => dispatch({ type: "setData", payload: data }))
        .catch(error => dispatch({ type: "setError", payload: error }))
        .finally(() => dispatch({ type: "setLoading", payload: false }))
    }, [ sortParam, sortDir, pageSize, searchText, baseUrl, patient ])

    const next = data?.link?.find(l => l.relation === "next")?.url
    const prev = data?.link?.find(l => l.relation === "previous")?.url

    const totalRecs = data?.total;
    const endRec = totalRecs ? Math.min(skip + pageSize, totalRecs) : skip + pageSize;

    function launchApp(patientId: string) {
        const url = new URL(searchParams.get("aud")!.replace(/\/fhir$/, "/auth/authorize"))
        url.search = window.location.search
        url.searchParams.set("patient", patientId);

        window.top?.postMessage({
            type: "setPatient",
            payload: data?.entry?.find(rec => rec.resource?.id === patientId)?.resource
        }, window.location.origin);

        window.location.href = url.href
    }

    function sort(name: string) {
        const _baseUrl = new URL(baseUrl);
        _baseUrl.pathname = new URL(searchParams.get("aud") + "/Patient").pathname
        _baseUrl.searchParams.delete("_getpagesoffset")
        _baseUrl.searchParams.delete("_getpages")
        dispatch({ type: "setBaseUrl", payload: _baseUrl.href })
        dispatch({ type: "setStartRec", payload: 0 });
        dispatch({ type: "setSort", payload: name })
    }

    function prevPage() {
        dispatch({ type: "setStartRec", payload: skip - pageSize });
        dispatch({ type: "setBaseUrl", payload: prev })
    }

    function nextPage() {
        dispatch({ type: "setStartRec", payload: skip + pageSize });
        dispatch({ type: "setBaseUrl", payload: next })
    }

    const sortKeys = ["ArrowUp", "ArrowDown", "Enter", " "];
    const selectKeys = ["Enter", " "];

    const pureBaseUrl = new URL(baseUrl);
    pureBaseUrl.pathname = pureBaseUrl.pathname.replace(/\/Patient.*$/, "")
    pureBaseUrl.search = ""

    return (
        <>
            <div className="container-fluid patient-picker" style={{ maxWidth: "80em" }}>
                { error && <div className="row">
                    <br />
                    <div className="col-sm-12">
                        <div className="alert alert-danger">
                            <span className="glyphicon glyphicon-exclamation-sign"/> <span>
                            { String(error || "An error occurred loading patients, please try again later.") }</span>
                        </div>
                    </div>
                </div> }

                <div className="row">
                    <div className="col-sm-12">
                        <h2 className="mt-1">
                            <img src="/logo.png" alt="SMART Logo" height={28} style={{ margin: "-6px 10px 0 0" }} />
                            Select Patient
                        </h2>
                        {/* <div className="text-muted">
                            FHIR Server: <a target="_blank" rel="noreferrer noopener" href={ pureBaseUrl.href }>{ pureBaseUrl.href }</a>
                        </div> */}
                    </div>
                </div>
                <br/>

                <div className="row">
                    <div className="col-sm-12">
                        <form onSubmit={e => {
                            e.preventDefault()
                            dispatch({
                                type: "search",
                                payload: (document.getElementById("search-input") as HTMLInputElement).value
                            })
                        }}>
                            <div className="input-group">
                                <input
                                    type="search"
                                    className="form-control"
                                    id="search-input"
                                    placeholder="Search by name..."
                                    defaultValue={ searchText }
                                />
                                <span className="input-group-btn">
                                    <button className="btn btn-default" type="submit">
                                        <i className="glyphicon glyphicon-search" /> Search
                                    </button>
                                </span>
                            </div>
                        </form>
                    </div>
                </div>
                <br/>

                <div className="row">
                    <div className="col-sm-12">
                        <table className="table">
                            <thead>
                                <tr className="no-hover">
                                    <th
                                        tabIndex={0}
                                        className="col-md-4 col-sm-6"
                                        title="Click to sort by family name"
                                        onClick={() => sort("name")}
                                        onKeyDown={e => { if (sortKeys.includes(e.key)) sort("name") }}>
                                        <span className="col-title">Name&nbsp;</span>
                                        { sortParam === "name" ?
                                            sortDir === "asc" ?
                                                <span className="text-muted glyphicon glyphicon-sort-by-attributes-alt"></span> :
                                                <span className="text-muted glyphicon glyphicon-sort-by-attributes"></span> :
                                            null
                                        }
                                    </th>
                                    <th
                                        tabIndex={0}
                                        className="col-md-2 col-sm-3 text-center"
                                        title="Click to sort by gender"
                                        onClick={() => sort("gender")}
                                        onKeyDown={e => { if (sortKeys.includes(e.key)) sort("gender") }}
                                    >
                                        <span className="col-title">Gender&nbsp;</span>
                                        { sortParam === "gender" ?
                                            sortDir === "asc" ?
                                                <span className="text-muted glyphicon glyphicon-sort-by-attributes-alt"></span> :
                                                <span className="text-muted glyphicon glyphicon-sort-by-attributes"></span> :
                                            null
                                        }
                                    </th>
                                    <th 
                                        tabIndex={0}
                                        className="col-md-2 col-sm-3 text-left"
                                        title="Click to sort by age"
                                        onClick={() => sort("age")}
                                        onKeyDown={e => { if (sortKeys.includes(e.key)) sort("age") }}
                                    >
                                        <span className="col-title">Age&nbsp;</span>
                                        { sortParam === "age" ?
                                            sortDir === "asc" ?
                                                <span className="text-muted glyphicon glyphicon-sort-by-attributes"></span> :
                                                <span className="text-muted glyphicon glyphicon-sort-by-attributes-alt"></span> :
                                            null
                                        }
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                { loading && !data && <tr id="message-loading" className="no-hover">
                                    <td colSpan={3} style={{ textAlign: "center", padding: 40 }}>
                                        Loading...
                                    </td>
                                </tr> }
                                { data && !data.entry?.length && <tr id="message-no-patients" className="no-hover">
                                    <td colSpan={3} style={{ textAlign: "center", padding: 40 }}>
                                        <b className="text-danger">No patients found</b>
                                    </td>
                                </tr> }
                                
                                { data?.entry?.map((p: fhir4.BundleEntry<fhir4.Patient>, i) => (
                                    <tr
                                        key={i}
                                        tabIndex={0}
                                        onClick={() => launchApp(p.resource!.id!)}
                                        onKeyDown={ e => { if (selectKeys.includes(e.key)) launchApp(p.resource!.id!) }}
                                        title={ `Click to select patient with ID ${p.resource!.id}` }
                                    >
                                        <td>
                                            <>
                                                <input type="radio" style={{ marginRight: "1ex" }} disabled/>
                                                <span dangerouslySetInnerHTML={{
                                                    __html: highlight(humanName(p.resource!), searchText)
                                                }}/>
                                            </>
                                        </td>
                                        <td className="text-center"><Gender patient={p.resource!} /></td>
                                        <td className="text-left">
                                            {formatAge(p.resource!)}
                                            {(p.resource!.deceasedDateTime || !!p.resource!.deceasedBoolean) && <>&nbsp;<span className="label label-warning">deceased</span></>}
                                        </td>
                                    </tr>
                                )) }
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={4} style={{ padding: "1em 0" }}>
                                        <br/>
                                        <div>
                                            <div className="pull-left text-muted" style={{ padding: "8px 0" }}>
                                                { data?.total ?
                                                    <>Patients { skip + 1 } to { endRec } of { totalRecs }</> :
                                                    null
                                                }
                                            </div>
                                            <div className="pull-right">
                                                <button
                                                    className="btn btn-default btn-sm"
                                                    disabled={!prev}
                                                    style={{ minWidth: "7em" }}
                                                    type="button"
                                                    onClick={ prevPage }
                                                >
                                                    <span className="glyphicon glyphicon-menu-left"></span> Previous
                                                </button>
                                                &nbsp;
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    disabled={!next}
                                                    style={{ minWidth: "7em" }}
                                                    onClick={ nextPage }
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
