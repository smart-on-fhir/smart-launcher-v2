import { SMART }    from "../"
import fetch        from "cross-fetch"
import { expect }   from "chai"
import jwt          from "jsonwebtoken"
import jose         from "node-jose"
import { LAUNCHER } from "./TestContext"
import { encode }   from "../src/isomorphic/codec"
import config       from "../backend/config"


interface AuthorizeParams {
    redirect_uri ?: string
    response_type?: string
    aud          ?: string
    scope        ?: string
    [key: string] : any
}

interface LaunchOptions extends AuthorizeParams {
    launchParams   : Partial<SMART.LaunchParams>
    ignoreErrors  ?: boolean
    requestOptions?: RequestInit
    fhirVersion   ?: string
}

export const ACCESS_TOKEN = jwt.sign({ client_id: "launcherTests" }, config.jwtSecret);

export function launch({
    launchParams,
    ignoreErrors,
    requestOptions = {},
    fhirVersion,
    ...query
} : LaunchOptions)
{
    const searchParams = new URLSearchParams(query)

    const launchOptions: SMART.LaunchParams = {
        pkce       : "auto",
        client_type: "public",
        launch_type: "provider-ehr",
        ...launchParams
    }

    const launch = encode(launchOptions, ignoreErrors)
    let url: URL;

    // In standalone launch the launch params are in URL segment
    if (launchOptions.launch_type === "patient-standalone" || launchOptions.launch_type === "provider-standalone") {
        url = new URL(`/v/${fhirVersion}/sim/${launch}/auth/authorize`, LAUNCHER.baseUrl)
        if ("aud" in query && query.aud === undefined) {
            searchParams.delete("aud")
        } else {
            searchParams.set("aud", query.aud ?? `${LAUNCHER.baseUrl}/v/${fhirVersion}/sim/${launch}/fhir`)
        }
    }
    
    // In EHR launch the launch params are in launch query parameter
    else {
        url = new URL(`/v/${fhirVersion}/auth/authorize`, LAUNCHER.baseUrl)
        searchParams.set("launch", encode(launchOptions, ignoreErrors))
        if ("aud" in query && query.aud === undefined) {
            searchParams.delete("aud")
        } else {
            searchParams.set("aud", query.aud ?? `${LAUNCHER.baseUrl}/v/${fhirVersion}/fhir`)
        }
    }
    
    // In POST auth params are passed in the body
    if (requestOptions.method === "POST") {
        requestOptions.body = searchParams
        requestOptions.headers = {
            ...requestOptions.headers,
            "content-type": "application/x-www-form-urlencoded"
        }
    }
    
    // In GET auth params are passed in the query string
    else {
        url.search = searchParams.toString()
    }

    // console.log(url.href)

    return fetch(url.href, { ...requestOptions, redirect: "manual" })
}

export function getTokenURL({
    fhirVersion = "r4",
    sim
}: {
    fhirVersion?: string // "r2" | "r3" | "r4"
    sim        ?: string | SMART.LaunchParams
} = {}) {
    let path = `/v/${fhirVersion}`

    if (sim) {
        if (typeof sim === "string") {
            path += `/sim/${sim}`
        } else {
            path += `/sim/${encode(sim)}`
        }
    }

    path += `/auth/token`

    return new URL(path, LAUNCHER.baseUrl)
}

export async function fetchAccessToken({
    fhirVersion = "r4",
    grant_type = "authorization_code",
    requestOptions = {},
    sim,
    ...params
}: {
    code                 ?: string // The code obtained from the authorize request
    redirect_uri         ?: string
    code_verifier        ?: string
    fhirVersion          ?: string // "r2" | "r3" | "r4"
    grant_type           ?: string
    refresh_token        ?: string
    client_assertion_type?: string
    client_assertion     ?: string
    scope                ?: string
    sim                  ?: string | SMART.LaunchParams
    requestOptions       ?: RequestInit
}): Promise<Response>
{
    const formData = new URLSearchParams()
    
    formData.set("grant_type", grant_type)

    for (let name in params) {
        const value = params[name as keyof typeof params]
        if (value !== undefined) {
            formData.set(name, value)
        }
    }

    const url = getTokenURL({ sim, fhirVersion })

    return fetch(url.href, {
        method: "POST",
        body: formData,
        redirect: "manual",
        ...requestOptions,
        headers: {
            "content-type": "application/x-www-form-urlencoded",
            ...requestOptions.headers
        }
    })
}

export async function getAuthCode(options: LaunchOptions)
{
    const res = await launch(options);
    expect(res.status).to.equal(302)
    const redirectUrl = new URL(res.headers.get("location") || "")
    expect(redirectUrl).to.exist;
    expect(redirectUrl.href).to.match(/^https?\:\/\/.+/)
    return {
        code        : redirectUrl.searchParams.get("code"),
        state       : redirectUrl.searchParams.get("state"),
        redirect_uri: redirectUrl.href
    }
}

export async function getAccessToken(options: LaunchOptions)
{
    const { code } = await getAuthCode(options);

    expect(code, "The code param must be non-empty string").to.be.a("string").and.to.not.be.empty;
    
    return await fetchAccessToken({
        code        : code + "",
        redirect_uri: options.redirect_uri!,
        fhirVersion : options.fhirVersion!,
    }).then(res => res.json());
}

export function parseResponseCode(jwt: string) {
    const tokens = jwt.split(".");
    if (tokens.length !== 3) {
        throw new Error(`Invalid code token (does not have 3 parts)`)
    }

    return JSON.parse(Buffer.from(tokens[1], "base64").toString("utf8"));
}

export function createClientAssertion({
    tokenUrl,
    clientId,
    privateKey,
    accessTokenLifetime = 300,
    jku
}: {
    tokenUrl: string
    clientId: string
    privateKey: jose.JWK.Key
    accessTokenLifetime?: number
    jku?: string
})
{
    return jwt.sign(
        {
            iss: clientId,
            sub: clientId,
            aud: tokenUrl,
            exp: Math.round(Date.now() / 1000) + accessTokenLifetime,
            jti: jose.util.randomBytes(10).toString("hex")
        },
        privateKey.toPEM(true),
        {
            algorithm: privateKey.alg as jwt.Algorithm,
            keyid    : privateKey.kid,
            header: {
                alg: privateKey.alg as jwt.Algorithm,
                jku
            }
        }
    );
}

export async function expectOauthError(
    res: Response,
    status: number,
    type: "invalid_request" |
          "invalid_client" |
          "invalid_grant" |
          "unauthorized_client" |
          "unsupported_grant_type" |
          "invalid_scope",
    message?: string | RegExp
) {
    const text = await res.text()
    
    expect(res.status).to.equal(status, "Unexpected response status")
    // console.log(text)

    if ([301, 302, 303, 307, 308].includes(status)) {
        const loc = res.headers.get("location")
        expect(loc).to.exist
        expect(loc).to.not.be.empty
        const url = new URL(loc!)
        expect(url.searchParams.get("error")).to.equal(type)
        if (message) {
            if (typeof message === "string") {
                expect(url.searchParams.get("error_description")).to.equal(message)
            }
            else {
                expect(url.searchParams.get("error_description")).to.match(message)
            }
        }
    }
    else {
        expect(res.headers.get("content-type")).to.match(/\bjson\b/, "Expected JSON error response")
        expect(res.ok).to.equal(false, "The request should have failed")
        const json = JSON.parse(text)
        expect(json.error).to.equal(type)
        if (message) {
            if (typeof message === "string") {
                expect(json.error_description).to.equal(message)
            }
            else {
                expect(json.error_description).to.match(message)
            }
        }
    }
}
