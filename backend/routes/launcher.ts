import { Request, Response }       from "express"
import { SMART }                   from "../.."
import { bool, getRequestBaseURL } from "../lib"
import LaunchOptions               from "../../src/isomorphic/LaunchOptions"

export default (req: Request, res: Response) => {

    let {
        launch_uri,
        fhir_ver,
        patient,
        auth_error,
        provider,
        sim_ehr,
        select_encounter,
    } = req.query;
    
    // launch_uri --------------------------------------------------------------
    launch_uri = String(launch_uri || "").trim();
    if (!launch_uri) {
        return res.status(400).send("launch_uri is required");
    }

    try {
        var url = new URL(launch_uri)
    } catch (ex) {
        return res.status(400).send("Invalid launch_uri: " + ex);
    }

    // fhir_ver ----------------------------------------------------------------
    const ver = parseInt(fhir_ver + "", 10);
    if (ver !== 2 && ver !== 3 && ver !== 4) {
        return res.status(400).send(
            "Invalid or missing fhir_ver parameter. It can only be '2', '3' or '4'."
        );
    }

    // iss ---------------------------------------------------------------------
    const iss = new URL("/v/r" + ver + "/fhir", getRequestBaseURL(req))
    
    // Make sure we use the correct iss protocol, depending on the launch_uri
    iss.protocol = url.protocol;

    url.searchParams.set("iss", iss.href)

    const launchOptions = new LaunchOptions({
        launch_type: "provider-ehr",
        sim_ehr    : bool(sim_ehr),
        patient    : patient  + "",
        provider   : provider + "",
        auth_error : auth_error as SMART.SimulatedError,
        encounter  : bool(select_encounter) ? "MANUAL" : "AUTO",
        validation : 0,
        pkce       : "auto",
        client_type: "public",
    })

    url.searchParams.set("launch", launchOptions.toString())

    res.redirect(url.href);
};
