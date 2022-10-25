import { expect }                  from "chai"
import fetch                       from "cross-fetch"
import jwt                         from "jsonwebtoken"
import express                     from "express"
import { LAUNCHER, FHIR_VERSIONS } from "../TestContext"
import { requestMethod }           from "../MockServer"
import config                      from "../../backend/config"
import { ACCESS_TOKEN }            from "../lib"




FHIR_VERSIONS.forEach(([ver, server]) => {
    
    describe("FHIR Proxy " + ver, () => {

        it ("rejects unsupported fhir versions", async () => {
            const res = await fetch(LAUNCHER.baseUrl + "/v/r234/fhir/Patient", { headers: { authorization: `Bearer ${ACCESS_TOKEN}` }})
            expect(res.ok).to.be.false
            expect(await res.text()).to.equal('FHIR server "r234" not found')
        })

        it ("Handles upstream being down in case of metadata request", async () => {
            server.mock("/Patient", { status: 503, body: "Service unavailable" });
            const res = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient", { headers: { authorization: `Bearer ${ACCESS_TOKEN}` }})
            expect(res.status).to.equal(503)
            expect(await res.text()).to.equal("Service unavailable")
        })

        it ("Replies with proper content type", async () => {
            // Mock the upstream server to reply with JSON. Then assert
            // that the proxy overrides the content-type to fhir+json,
            // even if the client sends an html accept header
            server.mock("/Patient", { status: 200, body: { x: 1 }, headers: { "content-type": "application/fhir+json" }});

            const res = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient", {
                headers: {
                    accept: 'text/html',
                    authorization: `Bearer ${ACCESS_TOKEN}`
                }
            })

            expect(res.status).to.equal(200)
            expect(res.headers.get('content-type')).to.match(/application\/(fhir\+json|json\+fhir|json)/)
            expect(await res.json()).to.deep.equal({ "x": 1 })
        });

        it ("Works with custom headers", async () => {
                
            // Mock the upstream server so that it replies with 200 OK,
            // but also returns some custom response headers which the
            // proxy should strip
            server.mock("/Patient", { status: 200, body: {}, headers: { 'x-custom': "whatever" }});

            const res = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient", { headers: { authorization: `Bearer ${ACCESS_TOKEN}` }})
            expect(res.headers.get('x-custom')).to.not.exist
        });

        it ("Passes through the content-type, etag and location response headers", async () => {
            server.mock("/Patient", { status: 200, body: "", headers: {
                "content-type" : "application/test-custom-type",
                "etag"         : "test-custom-etag",
                "location"     : "test-custom-location",
                "authorization": `Bearer ${ACCESS_TOKEN}`
            }});
            const res = await fetch(
                LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient",
                {
                    headers: {
                        authorization: `Bearer ${ACCESS_TOKEN}`
                    }
                }
            );
            expect(res.headers.get("content-type")).to.equal("application/test-custom-type")
            expect(res.headers.get("etag")).to.equal("test-custom-etag")
            expect(res.headers.get("location")).to.equal("test-custom-location")
        })

        it ("Validates the auth token if one is sent", async () => {
            const res = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient", {
                headers: {
                    authorization: "Bearer whatever"
                }
            });
            
            expect(res.status).to.equal(401)
            expect(res.headers.get('content-type')).to.match(/text/)
            expect(await res.text()).to.match(/Invalid token\: /)
        });
        
        it ("Adjust urls in the fhir response", async () => {
            server.mock("/Patient", { status: 200, body: {
                a: server.baseUrl,
                b: server.baseUrl + "/xyz"
            }, headers: {
                "content-type": "application/json"
            }});

            const res = await fetch(
                LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient",
                {
                    headers: {
                        authorization: `Bearer ${ACCESS_TOKEN}`
                    }
                }
            );
            const json = await res.json()
            expect(json).to.deep.equal({
                a: LAUNCHER.baseUrl + "/v/" + ver + "/fhir",
                b: LAUNCHER.baseUrl + "/v/" + ver + "/fhir/xyz"
            });
        });

        it ("Adjust urls in the fhir response of the CapabilityStatement", async () => {
            server.mock("/metadata", { status: 200, body: {
                a: server.baseUrl,
                b: server.baseUrl + "/xyz"
            }, headers: {
                "content-type": "application/json"
            }});

            const res = await fetch(
                LAUNCHER.baseUrl + "/v/" + ver + "/fhir/metadata",
                {
                    headers: {
                        authorization: `Bearer ${ACCESS_TOKEN}`
                    }
                }
            );
            const json = await res.json()
            expect(json).to.deep.equal({
                a: LAUNCHER.baseUrl + "/v/" + ver + "/fhir",
                b: LAUNCHER.baseUrl + "/v/" + ver + "/fhir/xyz"
            });

            // nock(UPSTREAM_BASE_URL)
            //     .get("/metadata")
            //     .reply(200, {
            //         a: UPSTREAM_BASE_URL,
            //         b: UPSTREAM_BASE_URL + "/xyz"
            //     }, {
            //         "content-type": "application/json"
            //     });

            // const text = await fetch(`${PATH_FHIR}/metadata`).then(r => r.text())
            // expect(text.indexOf(UPSTREAM_BASE_URL)).to.equal(-1, "Not all URLs replaced");
        });

        it ("Handles pagination", async () => {

            server.mock("/Patient", {
                status: 200,
                file: "./mocks/PatientBundlePage1.json",
                headers: { "content-type": "application/json" }
            });

            const body = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient", { headers: { authorization: `Bearer ${ACCESS_TOKEN}` }}).then(r => r.json())
                
            expect(body.link).to.be.an("Array", "No links found");

            let next = body.link.find((l: any) => l.relation == "next")
            expect(next, "No next link found").to.exist;
            
            const nextURL = new URL(next.url)
            nextURL.host = ver + ".upstream.test:8000"

            server.mock( nextURL.pathname, {
                status: 200,
                file: "./mocks/PatientBundlePage2.json",
                headers: { "content-type": "application/json" }
            })

            const body2 = await fetch(
                LAUNCHER.baseUrl + "/v/" + ver + "/fhir" + nextURL.pathname + nextURL.search,
                {
                    headers: {
                        authorization: `Bearer ${ACCESS_TOKEN}`
                    }
                }
            ).then(r => r.json())
            
            expect(body2.link).to.be.an("Array", "No links found on second page");
            
            let self = body2.link.find((l: any) => l.relation == "self")
            expect(self).to.be.an("Object", "No self link found on second page");
            
            expect(self.url, "Links mismatch").to.equal(next.url)

            let next2 = body2.link.find((l: any) => l.relation == "next")

            expect(next2, "No next link found on second page").to.exist
        });

        it ("Replies with formatted JSON for bundles", async () => {
            server.mock("/Patient", { status: 200, body: JSON.stringify({ a: [1] }, null, 4), headers: { "content-type": "application/json" }});
            const txt = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient", { headers: { authorization: `Bearer ${ACCESS_TOKEN}` }}).then(r => r.text());
            expect(txt).to.match(/\n.+/);
        });

        it ("Replies with formatted JSON for single resources", async () => {
            server.mock("/Patient/1", { status: 200, body: JSON.stringify({ a: 1 }, null, 4), headers: { "content-type": "application/json" }});
            const txt = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient/1", { headers: { authorization: `Bearer ${ACCESS_TOKEN}` }}).then(r => r.text());
            expect(txt).to.match(/\n.+/);
        });

        it ('Injects the SMART information in metadata responses', async () => {
            server.mock("/metadata", {
                status: 200,
                file: "./mocks/CapabilityStatement.json",
                headers: { "content-type": "application/json" }
            })
        
            const res = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/metadata")
            expect(res.status).to.equal(200)
            expect(res.headers.get("content-type")).to.match(/\bjson\b/i)
            const body = await res.json()

            let uris: any[] = body.rest?.[0]?.security?.extension?.[0]?.extension

            expect(uris, "No SMART URIs added to the CapabilityStatement").to.exist
            
            // authorize -------------------------------------------------------
            let authorizeCfg = uris.find(o => o.url == "authorize");
            expect(authorizeCfg, "No 'authorize' endpoint found in the conformance statement").to.exist;
            expect(authorizeCfg.valueUri, "Wrong 'authorize' endpoint found in the conformance statement").to.equal(LAUNCHER.baseUrl + "/v/" + ver + "/auth/authorize")

            // token -----------------------------------------------------------
            let tokenCfg = uris.find(o => o.url == "token");
            expect(tokenCfg, "No 'token' endpoint found in the conformance statement").to.exist;
            expect(tokenCfg.valueUri, "Wrong 'token' endpoint found in the conformance statement").to.equal(LAUNCHER.baseUrl + "/v/" + ver + "/auth/token")

            // token -----------------------------------------------------------
            let introspectCfg = uris.find(o => o.url == "introspect");
            expect(introspectCfg, "No 'introspect' endpoint found in the conformance statement").to.exist;
            expect(introspectCfg.valueUri, "Wrong 'introspect' endpoint found in the conformance statement").to.equal(LAUNCHER.baseUrl + "/v/" + ver + "/auth/introspect")
        });

        it ("Can simulate custom token errors", async () => {
            const token = jwt.sign({ sim_error: "test error" }, config.jwtSecret)
            server.mock("/Patient", {
                status: 200,
                file: "./mocks/CapabilityStatement.json",
                headers: { "content-type": "application/json" }
            })
        
            const res = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient", {
                headers: {
                    authorization: "bearer " + token
                }
            });
            expect(res.status).to.equal(401)
            expect(await res.text()).to.equal("test error");
        });

        it ("Rejects string tokens even if they are properly signed", async () => {
            const token = jwt.sign("this is a test", config.jwtSecret)
            server.mock("/Patient", {
                status: 200,
                file: "./mocks/CapabilityStatement.json",
                headers: { "content-type": "application/json" }
            })
        
            const res = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient", {
                headers: {
                    authorization: "bearer " + token
                }
            });
            expect(res.status).to.equal(400)
            expect(await res.text()).to.equal("Invalid token");
        });

        ["POST", "PUT", "PATCH"].forEach(method => {
            it (`Sends the body on ${method} requests`, async () => {
                const body = '{"a":1}'
                server.mock({
                    method: method.toLowerCase() as requestMethod,
                    path: "/Patient"
                }, {
                    bodyParser: express.json(),
                    handler: (req, res) => {
                        res.json(req.body)
                    }
                });
                const json = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/Patient", {
                    method,
                    headers: {
                        "content-type": "application/json",
                        authorization: `Bearer ${ACCESS_TOKEN}`
                    },
                    body
                }).then(r => r.text());
                expect(body).to.equal(json);
            });
        });
    })

    it (ver + " provides .well-known/smart-configuration", async () => {
        const res = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/.well-known/smart-configuration")
        expect(res.status).to.equal(200)
        expect(res.headers.get("content-type")).to.match(/\bjson\b/)
        const json = await res.json()
        expect(json.authorization_endpoint).to.equal(LAUNCHER.baseUrl + "/v/" + ver + "/auth/authorize")
    })

    it (ver + " provides .well-known/openid-configuration", async () => {
        const res = await fetch(LAUNCHER.baseUrl + "/v/" + ver + "/fhir/.well-known/openid-configuration")
        expect(res.status).to.equal(200)
        expect(res.headers.get("content-type")).to.match(/\bjson\b/)
        const json = await res.json()
        expect(json.authorization_endpoint).to.equal(LAUNCHER.baseUrl + "/v/" + ver + "/auth/authorize")
        expect(json.issuer).to.equal(LAUNCHER.baseUrl + "/v/" + ver + "/fhir")
    })
})