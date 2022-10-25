import { SMART }    from "../"
import fetch        from "cross-fetch"
import { expect }   from "chai"
import jwt          from "jsonwebtoken"
import jose         from "node-jose"
import { LAUNCHER } from "./TestContext"
import { encode }   from "../src/isomorphic/codec"


interface AuthorizeParams {
    redirect_uri ?: string
    response_type?: string
    aud          ?: string
    scope        ?: string
    [key: string] : any
}

interface LaunchOptions extends AuthorizeParams {
    launchParams   : SMART.LaunchParams
    ignoreErrors  ?: boolean
    requestOptions?: RequestInit
    fhirVersion   ?: string
}

export const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzY29wZSI" +
    "6InBhdGllbnQvKi4qIHVzZXIvKi4qIGxhdW5jaCBsYXVuY2gvcGF0aWVudCBsYXVuY2gvZW5" +
    "jb3VudGVyIG9wZW5pZCBmaGlyVXNlciBwcm9maWxlIG9mZmxpbmVfYWNjZXNzIiwiY29kZV9" +
    "jaGFsbGVuZ2VfbWV0aG9kIjoiUzI1NiIsImNvZGVfY2hhbGxlbmdlIjoiejJnZVU1VVFGV3V" +
    "ERzdZUW1OWTNFSmtSWW5KaXJ5VkdVaXRLRl9KNE1PSSIsImlhdCI6MTY2NjcwMzI3MiwiZXh" +
    "wIjoyNjY2NzA2ODcyfQ.W7iQZgOqHi7S2mb-PEfuWu2AJvK3jbP2RrErevUYg-s";

export function launch({
    launchParams,
    ignoreErrors,
    requestOptions = {},
    fhirVersion,
    ...query
} : LaunchOptions)
{
    const searchParams = new URLSearchParams(query)

    const launch = encode(launchParams, ignoreErrors)

    // In standalone launch the launch params are in URL segment
    if (launchParams.launch_type === "patient-standalone" || launchParams.launch_type === "provider-standalone") {
        var url = new URL(`/v/${fhirVersion}/sim/${launch}/auth/authorize`, LAUNCHER.baseUrl)
        if ("aud" in query && query.aud === undefined) {
            searchParams.delete("aud")
        } else {
            searchParams.set("aud", query.aud ?? `${LAUNCHER.baseUrl}/v/${fhirVersion}/sim/${launch}/fhir`)
        }
    }
    
    // In EHR launch the launch params are in launch query parameter
    else {
        var url = new URL(`/v/${fhirVersion}/auth/authorize`, LAUNCHER.baseUrl)
        searchParams.set("launch", encode(launchParams, ignoreErrors))
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

    return fetch(url, { ...requestOptions, redirect: "manual" })
}

export async function fetchAccessToken({
    fhirVersion = "r4",
    grant_type = "authorization_code",
    requestOptions = {},
    ...params
}: {
    code                 ?: string, // The code obtained from the authorize request
    redirect_uri         ?: string,
    code_verifier        ?: string,
    fhirVersion          ?: string, // "r2" | "r3" | "r4"
    grant_type           ?: string,
    refresh_token        ?: string,
    client_assertion_type?: string,
    client_assertion     ?: string
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

    const url = new URL(`/v/${fhirVersion}/auth/token`, LAUNCHER.baseUrl)

    return fetch(url, {
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
