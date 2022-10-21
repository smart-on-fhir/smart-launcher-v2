import { InputHTMLAttributes, useState } from "react"
import Modal from "../Modal"

declare global {
    var ENV: {
        NODE_ENV                : string
        PICKER_ORIGIN           : string
        DISABLE_BACKEND_SERVICES: boolean
        GOOGLE_ANALYTICS_ID     : string
        CDS_SANDBOX_URL         : string
        FHIR_SERVER_R2          : string
        FHIR_SERVER_R3          : string
        FHIR_SERVER_R4          : string
    }

    var patientPicker: Window | null
}

interface PatientBrowserConfig {
    /**
     * - "automatic" - Submit on change and defer that in some cases (DEFAULT)
     * - "manual"    - Render a submit button
     */
    submitStrategy?: "automatic" | "manual"

    /**
     * How to return the selection. Defaults to id-list. Options are:
     * - "id-list"  - return the selection as comma-separated list of patient IDs.
     * - "id-array" - return the selection as an array of patient IDs.
     * - "patients" - return the selection as an array of patient JSON objects.
     */
    outputMode?: "id-list" | "id-array" | "patients"

    /**
     * Only the selected patients are rendered?. Should be `false` or the
     * preselected patient IDs should be passed to the window. Otherwise It will
     * result in rendering no patients at all. Defaults to `false`.
     */
    renderSelectedOnly?: boolean

    /**
     * AJAX requests timeout in milliseconds. Defaults to `20000`.
     */
    timeout?: number

    /**
     * Patients per page. Defaults to `10`.
     */
    patientsPerPage?: number

    /**
     * If fhirViewer.enabled is true (then fhirViewer.url and fhirViewer.param
     * MUST be set), then clicking on the patient-related resources in detail
     * view will open their source in that external viewer. Otherwise they will
     * just be opened in new browser tab. Defaults to:
     * ```
     * {
     *     enabled: false,
     *     url    : "http://docs.smarthealthit.org/fhir-viewer/index.html",
     *     param  : "url"
     * }
     * ```
     */
    fhirViewer?: {
        enabled: true
        url    : string
        param  : string
    } | {
        enabled: false
        url   ?: string
        param ?: string
    }

    /**
     * an object describing the FHIR API server
     */
    server?: {
        /**
         * The base URL of the FHIR API server to use. Note that the picker will
         * only work with open servers that do not require authorization.
         */
        url: string

        /**
         * The FHIR version
         */
        type: "DSTU-2" | "STU-3" | "R4"

        /**
         * An array of tag objects to be rendered in the tags auto-complete menu.
         * This defaults to an empty array and in that case the tag selection
         * widget will not have a drop-down menu options, but it will still
         * allow you to search by typing some tag manually. In other words,
         * using an empty array is like saying that we just don't know what tags
         * (if any) are available on that server.
         * 
         * The list of tags might look like this:
         * ```
         *  [
         *      {
         *          // The actual tag
         *          key  : "pro-5-2017",
         *
         *          // The label to render in the tags auto-complete menu
         *          label: "PROm sample patients 5/2017"
         *      },
         *      {
         *          key  : "smart-5-2017",
         *          label: "SMART sample patients 5/2017"
         *      },
         *      {
         *          key  : "synthea-5-2017",
         *          label: "Synthea sample patients 5/2017"
         *      },
         *      // ...
         *  ]
         * ```
         *
         * If your server does not have any tags then the tag selector widget
         * will be useless and it is better if you hide it - see the
         * `hideTagSelector` option below.
         */
        tags?: { key: string, label: string }[]

        /**
         * If there are no tags in the server the tag selector will not be
         * useful. You can hide the Tags tab by passing `true` here.
         */
        hideTagSelector?: boolean
    }
}

type FhirVersion = "r2" | "r3" | "r4"

interface PatientInputProps {
    value?: string
    fhirVersion: FhirVersion
    onChange: (list: string) => void
    inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value"|"onChange"|"className"|"type">
}

export default function PatientInput({
    value,
    onChange,
    inputProps,
    fhirVersion
} : PatientInputProps)
{
    const [pickerOpen, setPickerOpen] = useState(false)
    return (
        <div className="dropdown">
            { pickerOpen && <PatientPicker onClose={() => setPickerOpen(false)} fhirVersion={fhirVersion} onChange={onChange} selection={value || ""} /> }
            <div className="input-group">
                <input
                    {...inputProps}
                    type="text"
                    className="form-control"
                    value={ value }
                    onChange={ e => onChange(e.target.value) }
                />
                <span className="input-group-btn">
                    <button
                        className="btn btn-default"
                        type="button"
                        title="Open patient browser"
                        onClick={() => setPickerOpen(true)}
                    >
                        <i className="glyphicon glyphicon-new-window text-primary"/>
                    </button>
                </span>
            </div>
        </div>
    )
}

function PatientPicker({
    selection,
    onChange,
    fhirVersion,
    onClose
} : {
    selection: string
    fhirVersion: FhirVersion
    onClose: () => void
    onChange: (sel: string) => void
})
{
    return (
        <Modal onClose={onClose}>
            <div className="modal-dialog full">
                <div className="modal-content">
                    <div className="modal-header color-danger">
                        <button type="button" className="close" onClick={onClose}>
                            <span aria-hidden="true">×</span>
                        </button>
                        <b className="text-primary">Select Patient(s)</b>
                    </div>
                    <div className="modal-body">
                        <iframe
                            id="patient-picker-frame"
                            title="Patient Picker Frame"
                            src={ getPickerUrl({ selection, fhirVersion }) }
                            onLoad={
                                e => {
                                    connectToPickerWindow(
                                        getPickerOrigin(),
                                        fhirVersion,
                                        // @ts-ignore
                                        e.target.contentWindow,
                                        sel => {
                                            if (sel || sel === "") onChange(sel)
                                            onClose()
                                        }
                                    )
                                }
                            }
                        />
                    </div>
                </div>
            </div>
        </Modal>
    )
}

function getPickerOrigin() {
    let o = ENV.PICKER_ORIGIN;
    if (window.location.protocol === "https:") {
        o = o.replace(/^https?:/, "https:");
    }
    return o
}

function getPickerUrl({
    fhirVersion,
    selection
}: {
    selection: string
    fhirVersion: FhirVersion
})
{
    // Compute the PICKER_ORIGIN -----------------------------------------------
    let PICKER_ORIGIN = getPickerOrigin()

    // Build the picker URL ----------------------------------------------------
    let path = PICKER_ORIGIN + "/index.html?_=" + Date.now();

    path += "&config=" + fhirVersion;

    if (selection) {
        path += "#/?_selection=" + encodeURIComponent(selection);
    }

    return path
}

function getPickerConfig(fhirVersion: FhirVersion): PatientBrowserConfig
{
    const pickerConfig: PatientBrowserConfig = {
        submitStrategy: "automatic",
        outputMode    : "id-list",
        timeout       : 30000
    };

    switch (fhirVersion) {
        case "r2":
            pickerConfig.server = {
                type: "DSTU-2",
                url : ENV.FHIR_SERVER_R2
            }
        break;
        case "r3":
            pickerConfig.server = {
                type: "STU-3",
                url : ENV.FHIR_SERVER_R3
            }
        break;
        case "r4":
            pickerConfig.server = {
                type: "R4",
                url : ENV.FHIR_SERVER_R4
            }
        break;
    }

    return pickerConfig
}

function connectToPickerWindow(pickerOrigin: string, fhirVersion: FhirVersion, win: Window, onClose: (data: any) => void)
{
    const pickerConfig = getPickerConfig(fhirVersion)

    // The function that handles incoming messages
    function onMessage(e: MessageEvent) {

        // only if the message is coming from the patient picker
        if (e.origin === pickerOrigin) {

            // Send our custom configuration options if when the patient browser
            // says it is ready to handle it
            if (e.data.type === 'ready') {
                win.postMessage({ type: 'config', data: pickerConfig }, '*');
            }

            // When the picker requests to be closed:
            // 1. Stop listening for messages
            // 2. Close the popup window
            // 3. Resolve the promise with the new selection (if any)
            if (e.data.type === 'result' || e.data.type === 'close') {
                window.removeEventListener('message', onMessage);
                onClose(e.data.data);
            }
        }
    }

    // Now just wait for the user to interact with the patient picker
    window.addEventListener('message', onMessage);
}

