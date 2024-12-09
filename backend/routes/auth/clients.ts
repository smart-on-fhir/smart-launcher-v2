import { Request, Response } from "express"
import LaunchOptions from "../../../src/isomorphic/LaunchOptions"
import { InvalidRequestError } from "../../errors"

function formatClientName(clientId: string): string {
    return clientId
        .split(/[-_.]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
}

export default function getClientRegistration(req: Request, res: Response) {
    try {
        const launchOptions = new LaunchOptions(req.params.sim || "")
        const requestedClientId = req.params.clientId

        // Validate client_id matches if specified in launch options
        if (launchOptions.client_id && launchOptions.client_id !== requestedClientId) {
            return res.status(404).json({
                error: "not_found",
                error_description: "Client not found"
            })
        }

        // Build response following OAuth 2.0 Dynamic Client Registration spec
        const clientMetadata: Record<string, any> = {
            client_id: requestedClientId,
            client_id_issued_at: Math.floor(Date.now() / 1000),
            
            // Client identity
            client_name: formatClientName(requestedClientId),
            client_uri: `https://example.com/apps/${requestedClientId}`,
            logo_uri: `https://via.placeholder.com/150?text=${encodeURIComponent(formatClientName(requestedClientId))}`,
            tos_uri: `https://example.com/apps/${requestedClientId}/tos`,
            policy_uri: `https://example.com/apps/${requestedClientId}/privacy`,
            contacts: [`support@${requestedClientId}.example.com`],

            // OAuth capabilities
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none", // default for public clients
            scope: launchOptions.scope || "launch/patient offline_access openid fhirUser"
        }

        // Add redirect URIs if specified
        if (launchOptions.redirect_uris) {
            clientMetadata.redirect_uris = launchOptions.redirect_uris.split(/\s*,\s*/)
        }

        // Add asymmetric auth properties
        if (launchOptions.client_type === "confidential-asymmetric") {
            clientMetadata.token_endpoint_auth_method = "private_key_jwt"
            if (launchOptions.jwks_url) {
                clientMetadata.jwks_uri = launchOptions.jwks_url
            }
            if (launchOptions.jwks) {
                clientMetadata.jwks = JSON.parse(launchOptions.jwks)
            }
        }

        // Add backend service properties 
        if (launchOptions.client_type === "backend-service") {
            clientMetadata.grant_types = ["client_credentials"]
            clientMetadata.token_endpoint_auth_method = "private_key_jwt"
        }

        // Pretty print the response
        res.setHeader('Content-Type', 'application/json')
        res.send(JSON.stringify(clientMetadata, null, 2))

    } catch (error) {
        throw new InvalidRequestError("Invalid launch options: " + error)
    }
}