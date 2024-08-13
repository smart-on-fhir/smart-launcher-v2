import { Request, Response } from "express"
import { fetch, Headers }    from "cross-fetch"
import { getRequestBaseURL, getFhirServerBaseUrl, validateToken } from "../../lib"


export default async function proxy(req: Request, res: Response) {

    // Validate FHIR Version -----------------------------------------------
    const fhirVersion      = req.params.fhir_release.toUpperCase();
    const fhirVersionLower = fhirVersion.toLowerCase();
    const fhirServer       = getFhirServerBaseUrl(req);

    // Anything other than /metadata requires authentication
    validateToken(req, false);

    // Build the FHIR request options --------------------------------------
    let fhirRequestOptions: RequestInit = {
        method: req.method,
        mode: "same-origin"
    };

    const isBinary = req.url.indexOf("/Binary/") === 0;

    // Add the body in case of POST or PUT ---------------------------------
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        fhirRequestOptions.body = req.body + "";
    }

    // Build request headers -----------------------------------------------
    fhirRequestOptions.headers = new Headers()

    const headersToIgnore = ["host", "authorization", "connection"];
    
    for (const name in req.headers) {
        if (!name.match(/^x-/i) && !headersToIgnore.includes(name)) {
            fhirRequestOptions.headers.set(name, req.headers[name] + "")
        }
    }
    
    if (!isBinary) {
        if (!fhirRequestOptions.headers.has("content-type")) {
            fhirRequestOptions.headers.set("content-type", "application/json")
        }
        
        fhirRequestOptions.headers.set(
            "accept",
            fhirVersion === "R2" ? "application/json+fhir" : "application/fhir+json"
        );
    }

    // Proxy ---------------------------------------------------------------
    const _url = new URL(fhirServer + req.url).href.replace(/\/\s*\//g, "/")
    const response = await fetch(_url, fhirRequestOptions);

    res.status(response.status);

    ["content-type", 'etag', 'location'].forEach(name => {
        if (response.headers.has(name)) {
            res.set(name, response.headers.get(name) + "")
        }
    })

    let body = await response.text()

    if (!isBinary) {
        body = body.replaceAll(fhirServer + "", `${getRequestBaseURL(req)}${req.baseUrl}`);
    }

    res.end(body);
}
