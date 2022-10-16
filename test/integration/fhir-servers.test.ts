import { expect }         from "chai"
import jwt                from "jsonwebtoken"
import fetch              from "cross-fetch"
import config             from "../../backend/config"
import { getAccessToken } from "../lib";
import { LAUNCHER, FHIR_VERSIONS } from "../TestContext"


for (const [FHIR_VERSION] of FHIR_VERSIONS) {

    describe(`FHIR server ${FHIR_VERSION}`, () => {

        describe('Introspection', () => {

            it ("requires authorization", async () => {
                const url = new URL(`/v/${FHIR_VERSION}/auth/introspect`, LAUNCHER.baseUrl)
                const res = await fetch(url, { method: "POST" })
                expect(res.status).to.equal(401)
                expect(res.statusText).to.equal("Unauthorized")
                expect(await res.text()).to.equal("Authorization is required")
            });

            it ("rejects invalid token", async () => {
                const url = new URL(`/v/${FHIR_VERSION}/auth/introspect`, LAUNCHER.baseUrl)
                const res = await fetch(url, { method: "POST", headers: { Authorization: "Bearer invalidToken" }})
                expect(res.status).to.equal(401)
            });

            it ("requires token in the payload", async () => {
                
                const { access_token } = await getAccessToken({
                    scope        : "offline_access",
                    response_type: "code",
                    redirect_uri : "http://localhost",
                    fhirVersion  : FHIR_VERSION,
                    launchParams: {
                        launch_type: "patient-standalone",
                        skip_login : true,
                        skip_auth  : true,
                        patient    : "abc",
                        encounter  : "bcd"
                    }
                });

                const url = new URL(`/v/${FHIR_VERSION}/auth/introspect`, LAUNCHER.baseUrl);

                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'Accept'       : 'application/json',
                        'Content-Type' : 'application/x-www-form-urlencoded'
                    }
                });

                expect(res.status).to.equal(400)
                expect(await res.text()).to.equal("No token provided")
            });

            it ("can introspect an access token", async () => {

                const { access_token } = await getAccessToken({
                    scope        : "offline_access launch launch/patient openid fhirUser",
                    client_id    : "example-client",
                    response_type: "code",
                    redirect_uri : "http://localhost",
                    fhirVersion  : FHIR_VERSION,
                    launchParams: {
                        launch_type: "patient-standalone",
                        client_id  : "example-client",
                        skip_login : true,
                        skip_auth  : true,
                        patient    : "abc",
                        encounter  : "bcd"
                    }
                });

                const url = new URL(`/v/${FHIR_VERSION}/auth/introspect`, LAUNCHER.baseUrl);

                const payload = new URLSearchParams()
                payload.set("token", access_token)

                const res = await fetch(url, {
                    method: "POST",
                    body: payload,
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'Accept'       : 'application/json',
                        'Content-Type' : 'application/x-www-form-urlencoded'
                    }
                });

                expect(res.status).to.equal(200)

                const body = await res.json();

                expect(body.active).to.be.true;
                expect(body.exp).to.exist;
                expect(body.scope).to.exist;
            });

            it ("can introspect a refresh token", async () => {

                const { access_token, refresh_token } = await getAccessToken({
                    scope        : "offline_access launch launch/patient openid fhirUser",
                    client_id    : "example-client",
                    response_type: "code",
                    redirect_uri : "http://localhost",
                    fhirVersion  : FHIR_VERSION,
                    launchParams: {
                        launch_type: "patient-standalone",
                        client_id  : "example-client",
                        skip_login : true,
                        skip_auth  : true,
                        patient    : "abc",
                        encounter  : "bcd"
                    }
                });

                const payload = new URLSearchParams()
                payload.set("token", refresh_token)

                const url = new URL(`/v/${FHIR_VERSION}/auth/introspect`, LAUNCHER.baseUrl);

                const res = await fetch(url, {
                    method: "POST",
                    body: payload,
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'Accept'       : 'application/json',
                        'Content-Type' : 'application/x-www-form-urlencoded'
                    }
                });

                expect(res.status).to.equal(200)

                const body = await res.json();

                if(body.active !== true) throw new Error("Token is not active.");
            });

            it ("gets active: false for authorized request with invalid token", async () => {

                const { access_token } = await getAccessToken({
                    scope        : "offline_access launch launch/patient openid fhirUser",
                    client_id    : "example-client",
                    response_type: "code",
                    redirect_uri : "http://localhost",
                    fhirVersion  : FHIR_VERSION,
                    launchParams: {
                        launch_type: "patient-standalone",
                        client_id  : "example-client",
                        skip_login : true,
                        skip_auth  : true,
                        patient    : "abc",
                        encounter  : "bcd"
                    }
                });

                const payload = new URLSearchParams()
                payload.set("token", "invalid token")

                const url = new URL(`/v/${FHIR_VERSION}/auth/introspect`, LAUNCHER.baseUrl);

                const res = await fetch(url, {
                    method: "POST",
                    body: payload,
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'Accept'       : 'application/json',
                        'Content-Type' : 'application/x-www-form-urlencoded'
                    }
                });

                expect(res.status).to.equal(200)
                expect(res.headers.get('content-type')).to.match(/json/)

                const body = await res.json();

                expect(body.active).to.equal(false)
                expect(body.error.name).to.equal("JsonWebTokenError")
            });

            it ("gets active: false for authorized request with expired token", async () => {

                const expiredTokenPayload = {
                    client_id: "mocked",
                    scope: "Patient/*.read",
                    exp: Math.floor(Date.now() / 1000) - (60 * 60) // token expired one hour ago
                }

                const expiredToken = jwt.sign(expiredTokenPayload, config.jwtSecret)

                const { access_token } = await getAccessToken({
                    scope        : "offline_access launch launch/patient openid fhirUser",
                    client_id    : "example-client",
                    response_type: "code",
                    redirect_uri : "http://localhost",
                    fhirVersion  : FHIR_VERSION,
                    launchParams: {
                        launch_type: "patient-standalone",
                        client_id  : "example-client",
                        skip_login : true,
                        skip_auth  : true,
                        patient    : "abc",
                        encounter  : "bcd"
                    }
                });

                const payload = new URLSearchParams()
                payload.set("token", expiredToken)

                const url = new URL(`/v/${FHIR_VERSION}/auth/introspect`, LAUNCHER.baseUrl)

                const res = await fetch(url, {
                    method: "POST",
                    body: payload,
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'Accept'       : 'application/json',
                        'Content-Type' : 'application/x-www-form-urlencoded'
                    }
                });

                expect(res.status).to.equal(200)
                expect(res.headers.get('content-type')).to.match(/json/)

                const body = await res.json();

                expect(body.active).to.equal(false)
                expect(body.error.name).to.equal("TokenExpiredError")
            });

        });
    });
}
