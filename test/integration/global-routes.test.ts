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

describe('RSA Generator', () => {
    
    it ("can generate random strings", async () => {
        const res = await fetch(LAUNCHER.baseUrl + '/generator/random')
        expect(res.headers.get('Content-Type')).to.match(/text\/plain/)
        expect(res.status).to.equal(200)
        const str1 = await res.text()
        expect(str1).to.match(/^[0-9a-fA-F]{64}$/);
        const res2 = await fetch(LAUNCHER.baseUrl + '/generator/random')
        const str2 = await res2.text()
        expect(str1).to.not.equal(str2);
    });

    it ("can generate random strings with ?enc=hex param", async () => {
        const res = await fetch(LAUNCHER.baseUrl + '/generator/random?enc=hex')
        expect(res.headers.get('Content-Type')).to.match(/text\/plain/)
        expect(res.status).to.equal(200)
        expect(await res.text()).to.match(/^[0-9a-fA-F]{64}$/);
    });

    it ("random string encoding defaults to hex", async () => {
        const res = await fetch(LAUNCHER.baseUrl + '/generator/random?enc=abcd')
        expect(res.headers.get('Content-Type')).to.match(/text\/plain/)
        expect(res.status).to.equal(200)
        expect(await res.text()).to.match(/^[0-9a-fA-F]{64}$/);
    });

    it ("random strings length defaults to 32", async () => {
        const res = await fetch(LAUNCHER.baseUrl + '/generator/random?len=-5')
        expect(res.headers.get('Content-Type')).to.match(/text\/plain/)
        expect(res.status).to.equal(200)
        expect(await res.text()).to.match(/^[0-9a-fA-F]{64}$/);
    });

    it ("can generate random RSA-256 key pairs", async () => {
        const res = await fetch(LAUNCHER.baseUrl + "/generator/rsa")
        expect(res.status).to.equal(200)
        expect(res.headers.get('Content-Type')).to.match(/json/)

        let { privateKey, publicKey } = await res.json()
        
        expect(privateKey, "The generator did not create a private key")
        expect(publicKey, "The generator did not create a public key")

        // Make another request to verify that generated keys are NOT the same
        // as those from the last request 
        const res2 = await fetch(LAUNCHER.baseUrl + "/generator/rsa")
        expect(res2.status).to.equal(200)
        expect(res2.headers.get('Content-Type')).to.match(/json/)

        let { privateKey: privateKey2, publicKey: publicKey2 } = await res2.json()

        expect(privateKey2, "The generator did not create a private key").to.exist
        expect(publicKey2, "The generator did not create a public key").to.exist
        expect(privateKey2).to.not.equal(privateKey, "privateKey does not change between requests")
        expect(publicKey2).to.not.equal(publicKey, "publicKey does not change between requests")
    });
});


