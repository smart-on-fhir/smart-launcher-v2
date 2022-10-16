import { expect }   from "chai"
import fetch        from "cross-fetch"
import { LAUNCHER } from "../TestContext"

describe("renders html pages", () => {
    it ('index', async () => {
        const res = await fetch(LAUNCHER.baseUrl)
        expect(res.headers.get('content-type')).to.match(/html/);
    });

    it ('provider-login', async () => {
        const res = await fetch(LAUNCHER.baseUrl + "/provider-login")
        expect(res.headers.get('content-type')).to.match(/html/);
    });

    it ('patient-login', async () => {
        const res = await fetch(LAUNCHER.baseUrl + "/patient-login")
        expect(res.headers.get('content-type')).to.match(/html/);
    });

    it ('select-encounter', async () => {
        const res = await fetch(LAUNCHER.baseUrl + "/select-encounter")
        expect(res.headers.get('content-type')).to.match(/html/);
    });

    it ('select-patient', async () => {
        const res = await fetch(LAUNCHER.baseUrl + "/select-patient")
        expect(res.headers.get('content-type')).to.match(/html/);
    });

    it ('authorize-app', async () => {
        const res = await fetch(LAUNCHER.baseUrl + "/authorize-app")
        expect(res.headers.get('content-type')).to.match(/html/);
    });

})

it ('/keys hosts the public keys', async () => {
    const res = await fetch(LAUNCHER.baseUrl + '/keys')
    expect(res.headers.get('Content-Type')).to.match(/json/)
    expect(res.status).to.equal(200)
    const body = await res.json()
    expect(body).to.have.property("keys")
    expect(body.keys).to.be.an("Array")
    expect(body.keys).to.haveOwnProperty("length").greaterThan(0)
});

it ('/public_key hosts the public key as pem', async() => {
    const res = await fetch(LAUNCHER.baseUrl + '/public_key')
    expect(res.headers.get('Content-Type')).to.match(/text/)
    expect(res.status).to.equal(200)
    const body = await res.text()
    expect(body).to.match(/-----BEGIN PUBLIC KEY-----/)
});

it ("/env.js", async () => {
    const res = await fetch(LAUNCHER.baseUrl + '/env.js')
    expect(res.headers.get('Content-Type')).to.match(/javascript/)
    expect(res.status).to.equal(200)
    const body = await res.text()
    expect(body).to.match(/var ENV = \{/)
})

// it ("rejects xml", async () => {
//     const res = await fetch(LAUNCHER.baseUrl + "/", {
//         headers: {
//             "content-type": "application/xml"
//         }
//     })
//     expect(res.status).to.equal(400)
//     const body = await res.text()
//     expect(body).to.match(/XML format is not supported/)
// })

describe("/launcher", () => {
    it ("requires launch_uri", async () => {
        const res = await fetch(LAUNCHER.baseUrl + '/launcher')
        expect(res.status).to.equal(400)
        const body = await res.text()
        expect(body).to.equal("launch_uri is required")
    })

    it ("requires absolute launch_uri", async () => {
        const res = await fetch(LAUNCHER.baseUrl + '/launcher?launch_uri=./test')
        expect(res.status).to.equal(400)
        const body = await res.text()
        expect(body).to.match(/^Invalid launch_uri: /)
    })

    it ("validates the fhir_ver param", async () => {
        const res = await fetch(LAUNCHER.baseUrl + '/launcher?launch_uri=http://test.dev&fhir_ver=33')
        expect(res.status).to.equal(400)
        const body = await res.text()
        expect(body).to.equal("Invalid or missing fhir_ver parameter. It can only be '2', '3' or '4'.")
    })

    it ("works", async () => {
        const url = new URL(LAUNCHER.baseUrl + '/launcher')
        url.searchParams.set("launch_uri", 'http://test.dev/')
        url.searchParams.set("fhir_ver", '3')
        const res = await fetch(url, { redirect: "manual" })
        expect(res.status).to.equal(302)
        expect(res.headers.get("location")).to.match(/^http\:\/\/test\.dev\/\?iss=.+/)
    })
})
