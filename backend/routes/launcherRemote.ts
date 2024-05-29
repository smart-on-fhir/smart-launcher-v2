import { Request, Response }       from "express"
import { bool, getRequestBaseURL } from "../lib"
import LaunchOptions               from "../../src/isomorphic/LaunchOptions"


export default (req: Request, res: Response) => {

    let {
        patient,   // patient ID if needed
        provider,  // provider ID if needed
        encounter, // encounter ID if needed
        sim_ehr,   // bool - render in iframe if true
    } = req.query;

    // -------------------------------------------------------------------------
    // External FHIR Server
    // Must be provided as fhir_server parameter
    // Must be valid URL
    // Query parameters are ignored (removed)
    // -------------------------------------------------------------------------
    if (!String(req.query.fhir_server || "").trim()) {
        return res.status(400).send("A fhir_server parameter is required");
    }

    try {
        var fhir_server = new URL(String(req.query.fhir_server || "").trim());
        fhir_server.search = "";
    } catch (ex) {
        return res.status(400).send("Invalid fhir_server url: " + ex);
    }

    // -------------------------------------------------------------------------
    // App's launch url
    // Must be provided as launch_uri parameter
    // Must be valid URL
    // Query parameters are ignored (removed)
    // -------------------------------------------------------------------------
    if (!String(req.query.launch_uri || "").trim()) {
        return res.status(400).send("A launch_uri parameter is required");
    }

    try {
        var launch_uri = new URL(String(req.query.launch_uri || "").trim());
        launch_uri.search = ""
    } catch (ex) {
        return res.status(400).send("Invalid launch_uri url: " + ex);
    }

    // -------------------------------------------------------------------------
    // FHIR version of the fhir_server server
    // Must be provided as fhir_ver parameter
    // Must be one of 2, 3, 4
    // -------------------------------------------------------------------------
    const ver = parseInt(req.query.fhir_ver + "", 10);
    if (ver !== 2 && ver !== 3 && ver !== 4) {
        return res.status(400).send(
            "Invalid or missing fhir_ver parameter. It must be '2', '3' or '4'."
        );
    }

    // iss ---------------------------------------------------------------------
    const sim = new LaunchOptions({
        launch_type: "provider-ehr",
        fhir_server: fhir_server.href
    })

    const launchOptions = new LaunchOptions({
        fhir_server: fhir_server.href,
        launch_type: "provider-ehr",
        sim_ehr    : bool(sim_ehr),
        patient    : String(patient || ""),
        provider   : String(provider || ""),
        encounter  : String(encounter || "") || "NONE",
        pkce       : "auto",
        client_type: "public",
    })

    const iss = new URL("/v/r" + ver + "/sim/" + sim.toString() + "/fhir", getRequestBaseURL(req))
    
    
    // Make sure we use the correct iss protocol, depending on the launch_uri
    iss.protocol = launch_uri.protocol;

    launch_uri.searchParams.set("iss", iss.href)
    launch_uri.searchParams.set("launch", launchOptions.toString())

    console.log(launch_uri)

    res.redirect(launch_uri.href);
};
