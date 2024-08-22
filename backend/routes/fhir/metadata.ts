import { Request, Response } from "express"
import { fetch }             from "cross-fetch"
import { getFhirServerBaseUrl, getRequestBaseURL } from "../../lib"


/**
 * The `/metadata` endpoint is an exception in the proxy behavior. For every
 * other path we are sending the response back to the client and replacing
 * URLs. In case of `/metadata` more complex replacements are needed,
 * thus we download the `CapabilityStatement`, parse it, modify it and then
 * we are sending it to the client.
 * @param req 
 * @param res 
 * @param fhirServer The base URL of the upstream FHIR server
 */
async function getCapabilityStatement(req: Request, res: Response, fhirServer: string) {
    const response = await fetch(fhirServer + req.url);

    const baseUrl = getRequestBaseURL(req) + req.baseUrl.replace("/fhir", "")

    // pass through the statusCode
    res.status(response.status)

    const body = await response.json()

    // Inject the SMART information
    augmentConformance(body, baseUrl);

    res.set("content-type", "application/json; charset=utf-8");
    res.send(JSON.stringify(body, null, 4).replaceAll(fhirServer + "", `${baseUrl}/fhir`));
}

/**
 * Given a conformance statement (as JSON object), replaces the auth URIs with
 * new ones that point to our proxy server. Also adds the rest.security.service
 * field.
 * @param json A conformance statement as JSON
 * @param baseUrl  The baseUrl of our server
 */
function augmentConformance(json: fhir4.CapabilityStatement, baseUrl: string) {
    if (json?.rest?.[0]?.security) {
        json.rest[0].security.extension = [{
            url: "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris",
            extension: [
                {
                    url: "authorize",
                    valueUri: baseUrl + "/auth/authorize"
                },
                {
                    url: "token",
                    valueUri: baseUrl + "/auth/token"
                },
                {
                    url: "introspect",
                    valueUri: baseUrl + "/auth/introspect"
                }
            ]
        }];

        json.rest[0].security.service = [
            {
                coding: [
                    {
                        system: "http://hl7.org/fhir/restful-security-service",
                        code: "SMART-on-FHIR",
                        display: "SMART-on-FHIR"
                    }
                ],
                text: "OAuth2 using SMART-on-FHIR profile (see http://docs.smarthealthit.org)"
            }
        ];

        // There is a bug in our current sandbox causing the definition of the
        // Location.near parameter to not have a type property. If so - fix it here!
        const Location = json.rest[0].resource?.find(r => r.type === "Location")
        const nearDef  = Location?.searchParam?.find(p => p.name === "near")
        if (nearDef && !nearDef.type) {
            nearDef.type = "special"
        }
    }

    return json;
}

export default function proxyRequest(req: Request, res: Response) {
    const fhirServer = getFhirServerBaseUrl(req);
    return getCapabilityStatement(req, res, fhirServer);
}
