import { expect, use }      from "chai"
import crypto               from "crypto"
import jwt                  from "jsonwebtoken"
import fetch                from "cross-fetch"
import chaiAsPromised       from "chai-as-promised"
import { LAUNCHER }         from "../TestContext"
import config               from "../../backend/config"
import jose                 from "node-jose"
import MockServer, { MockOptions } from "../MockServer"
import { fetchAccessToken, createClientAssertion, getTokenURL } from "../lib"
import { SMART } from "../.."
import { jwk2pem } from "pem-jwk"

use(chaiAsPromised);


describe("token endpoint", () => {

    it ("requires application/x-www-form-urlencoded content type", async () => {
        const res = await fetchAccessToken({ requestOptions: { headers: { "content-type": "text/plain" }}});
        expect(res.status).to.equal(400)
        expect(await res.text()).to.include("Invalid request content-type header 'text/plain' (must be 'application/x-www-form-urlencoded')")
    })

    it ("rejects unsupported grant_type", async () => {
        const res = await fetchAccessToken({ grant_type: "bad_grant_type" });
        expect(res.status).to.equal(400)
        const txt = await res.text()
        expect(txt).to.include('Invalid or missing grant_type parameter ')
    })

    it ("Inject invalid authorization token error (to be thrown while requesting FHIR data)", async () => {
        const code = jwt.sign({ redirect_uri: "http://whatever", scope: "offline_access", auth_error: "request_invalid_token" }, config.jwtSecret);
        const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
        expect(res.status).to.equal(200)
        const json = await res.json()
        expect(json).to.haveOwnProperty("sim_error").that.equals("Invalid token")
    })

    it ("Inject expired authorization token error (to be thrown while requesting FHIR data)", async () => {
        const code = jwt.sign({ redirect_uri: "http://whatever", scope: "offline_access", auth_error: "request_expired_token" }, config.jwtSecret);
        const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
        expect(res.status).to.equal(200)
        const json = await res.json()
        expect(json).to.haveOwnProperty("sim_error").that.equals("Token expired")
    })

    it ("Can simulate invalid authorization token error", async () => {
        const code = jwt.sign({ redirect_uri: "http://whatever", scope: "offline_access", auth_error: "token_invalid_token" }, config.jwtSecret);
        const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
        expect(res.status).to.equal(401)
        const txt = await res.text()
        expect(txt).to.include("Simulated invalid client error")
    })

    describe("authorization_code flow", () => {

        it ("requires code parameter", async () => {
            const res = await fetchAccessToken({ code: "", redirect_uri: "http://whatever" })
            expect(res.status).to.equal(400)
            expect(await res.text()).to.include("Missing 'code' parameter")
        })

        it ("requires redirect_uri parameter", async () => {
            const res = await fetchAccessToken({ code: "whatever", redirect_uri: "" })
            expect(res.status).to.equal(400)
            expect(await res.text()).to.include("Missing 'redirect_uri' parameter")
        })

        it ("verifies that 'code' is a signed token", async () => {
            const res = await fetchAccessToken({ code: "whatever", redirect_uri: "http://whatever" })
            expect(res.status).to.equal(401)
            expect(await res.text()).to.include("Invalid token")
        })

        it ("Requires the 'code' token to include redirect_uri", async () => {
            const code = jwt.sign({ redirect_uri: "" }, config.jwtSecret, { expiresIn: "5m" })
            const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
            expect(res.status).to.equal(401)
            const txt = await res.text()
            expect(txt).to.include("The authorization token must include redirect_uri")
        })

        it ("Requires the 'code' token to have the same redirect_uri as the redirect_uri parameter", async () => {
            const code = jwt.sign({ redirect_uri: "http://whatever1" }, config.jwtSecret, { expiresIn: "5m" })
            const res = await fetchAccessToken({ code, redirect_uri: "http://whatever2" })
            expect(res.status).to.equal(401)
            const txt = await res.text()
            expect(txt).to.include("Invalid redirect_uri parameter")
        })

        // PKCE behavior is added to the token endpoint if the code token has code_challenge_method
        describe("PKCE", () => {

            it ("Requires code_challenge_method to be 'S256'", async () => {
                const code = jwt.sign({
                    redirect_uri: "http://whatever",
                    code_challenge_method: "test"
                }, config.jwtSecret, { expiresIn: "5m" })
                const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
                expect(res.status).to.equal(400)
                const txt = await res.text()
                expect(txt).to.include("Unsupported code_challenge_method 'test'. We support only 'S256'")
            })

            it ("Requires code_verifier", async () => {
                const code = jwt.sign({
                    redirect_uri: "http://whatever",
                    code_challenge_method: "S256"
                }, config.jwtSecret, { expiresIn: "5m" })
                const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
                expect(res.status).to.equal(400)
                const txt = await res.text()
                expect(txt).to.include("Missing code_verifier parameter")
            })

            it ("Verifies code_challenge", async () => {
                
                const inputBytes = crypto.randomBytes(96)
                const codeVerifier = inputBytes.toString("base64url")
                const hash = crypto.createHash("sha256").update(codeVerifier)
                const codeChallenge = Buffer.from(hash.digest()).toString("base64url")

                const code = jwt.sign({
                    redirect_uri: "http://whatever",
                    code_challenge_method: "S256",
                    code_challenge: codeChallenge
                }, config.jwtSecret, { expiresIn: "5m" })

                const res = await fetchAccessToken({ code, redirect_uri: "http://whatever", code_verifier: codeVerifier })

                expect(res.status).to.equal(200)

                const code2 = jwt.sign({
                    redirect_uri: "http://whatever",
                    code_challenge_method: "S256",
                    code_challenge: codeChallenge + "xxx"
                }, config.jwtSecret, { expiresIn: "5m" })

                const res2 = await fetchAccessToken({ code: code2, redirect_uri: "http://whatever", code_verifier: codeVerifier })

                expect(res2.status).to.equal(401)
                const txt = await res2.text()
                expect(txt).to.match(/Invalid grant or Invalid PKCE Verifier/)

            })

        })

        describe("Basic auth", () => {

            it ("Can simulate invalid client secret error", async () => {
                const code = jwt.sign({ redirect_uri: "http://whatever", auth_error: "auth_invalid_client_secret" }, config.jwtSecret, { expiresIn: "5m" })
                const res = await fetchAccessToken({ code, redirect_uri: "http://whatever", requestOptions: { headers: { authorization: "Basic" }}})
                expect(res.status).to.equal(401)
                const txt = await res.text()
                expect(txt).to.include("Simulated invalid client secret error")
            })

            it ("Rejects empty authorization header", async () => {
                const code = jwt.sign({ redirect_uri: "http://whatever" }, config.jwtSecret, { expiresIn: "5m" })
                const res = await fetchAccessToken({ code, redirect_uri: "http://whatever", requestOptions: { headers: { authorization: "Basic" }}})
                expect(res.status).to.equal(401)
                const txt = await res.text()
                expect(txt).to.include("The authorization header 'Basic' cannot be empty")
            })

            it ("Parses the authorization header", async () => {
                const code = jwt.sign({ redirect_uri: "http://whatever" }, config.jwtSecret, { expiresIn: "5m" })
                const res = await fetchAccessToken({ code, redirect_uri: "http://whatever", requestOptions: { headers: { authorization: "Basic test" }}})
                expect(res.status).to.equal(401)
                const txt = await res.text()
                expect(txt).to.include("The decoded header must contain '{client_id}:{client_secret}'")
            })

            it ("Validates the client_id", async () => {
                const code = jwt.sign({ redirect_uri: "http://whatever", client_id: "whatever" }, config.jwtSecret, { expiresIn: "5m" })
                const res = await fetchAccessToken({ code, redirect_uri: "http://whatever", requestOptions: { headers: { authorization: "Basic " + Buffer.from("test:pass").toString("base64") }}})
                expect(res.status).to.equal(401)
                const txt = await res.text()
                expect(txt).to.include("Invalid client_id in the basic auth header")
            })

            it ("Validates the client_secret", async () => {
                const code = jwt.sign({ redirect_uri: "http://whatever", client_id: "whatever", client_secret: "secret" }, config.jwtSecret, { expiresIn: "5m" })
                const res = await fetchAccessToken({ code, redirect_uri: "http://whatever", requestOptions: { headers: { authorization: "Basic " + Buffer.from("whatever:pass").toString("base64") }}})
                expect(res.status).to.equal(401)
                const txt = await res.text()
                expect(txt).to.include("Invalid client_secret in the basic auth header")
            })
        })

        it ("Includes a refresh token if 'offline_access' scope is granted", async () => {
            const code = jwt.sign({ redirect_uri: "http://whatever", scope: "offline_access" }, config.jwtSecret, { expiresIn: "5m" })
            const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
            expect(res.status).to.equal(200)
            const json = await res.json()
            expect(json).to.haveOwnProperty("refresh_token")
        })

        it ("Includes a refresh token if 'online_access' scope is granted", async () => {
            const code = jwt.sign({ redirect_uri: "http://whatever", scope: "online_access" }, config.jwtSecret, { expiresIn: "5m" })
            const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
            expect(res.status).to.equal(200)
            const json = await res.json()
            expect(json).to.haveOwnProperty("refresh_token")
        })

        it ("Includes an id_token if 'openid' and 'profile' scopes are granted", async () => {
            const code = jwt.sign({ redirect_uri: "http://whatever", scope: "openid profile", user: "user-id" }, config.jwtSecret)
            const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
            expect(res.status).to.equal(200)
            const json = await res.json()
            expect(json).to.haveOwnProperty("id_token")
        })

        it ("Includes an id_token if 'openid' and 'fhirUser' scopes are granted", async () => {
            const code = jwt.sign({ redirect_uri: "http://whatever", scope: "openid fhirUser", user: "user-id" }, config.jwtSecret)
            const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
            expect(res.status).to.equal(200)
            const json = await res.json()
            expect(json).to.haveOwnProperty("id_token")
        })

        it ("Token lifetime can be customized via accessTokensExpireIn", async () => {
            const code = jwt.sign({ redirect_uri: "http://whatever", accessTokensExpireIn: 10 }, config.jwtSecret)
            const res = await fetchAccessToken({ code, redirect_uri: "http://whatever" })
            expect(res.status).to.equal(200)
            const json = await res.json()
            expect(json).to.haveOwnProperty("expires_in").that.equals(600)
        })

        it ("rejects refresh requests with missing refresh_token", async () => {
            const res = await fetchAccessToken({ grant_type: "refresh_token" })
            expect(res.ok).to.equal(false)
            expect(res.status).to.equal(401)
            expect(res.headers.get("content-type")).to.match(/\bjson\b/)
            const json = await res.json()
            expect(json.error).to.equal("invalid_grant")
            expect(json.error_description).to.equal("Invalid refresh token")
        })

        it ("rejects refresh requests with invalid refresh_token", async () => {
            const res = await fetchAccessToken({ grant_type: "refresh_token", refresh_token: "whatever" })
            expect(res.ok).to.equal(false)
            expect(res.status).to.equal(401)
            expect(res.headers.get("content-type")).to.match(/\bjson\b/)
            const json = await res.json()
            expect(json.error).to.equal("invalid_grant")
            expect(json.error_description).to.equal("Invalid refresh token")
        })

        it ("can simulate token_expired_refresh_token errors", async () => {
            const redirect_uri = "http://whatever";
            const code = jwt.sign({
                redirect_uri,
                scope: "offline_access",
                auth_error: "token_expired_refresh_token"
            }, config.jwtSecret);
            const res = await fetchAccessToken({ code, redirect_uri })
            expect(res.status).to.equal(200)
            const json = await res.json()
            expect(json).to.haveOwnProperty("refresh_token")
            
            const formData = new URLSearchParams()
            formData.set("grant_type", "refresh_token")
            formData.set("refresh_token", json.refresh_token)

            const res2 = await fetch(LAUNCHER.baseUrl + "/v/r4/auth/token", {
                method: "POST",
                body: formData,
                headers: {
                    "content-type": "application/x-www-form-urlencoded"
                }
            });

            expect(res2.ok).to.equal(false)
            expect(res2.status).to.equal(403)
            expect(res2.headers.get("content-type")).to.match(/\bjson\b/)
            const json2 = await res2.json()
            expect(json2.error).to.equal("invalid_grant")
            expect(json2.error_description).to.equal("Expired refresh token")
        })

        it ("can refresh using refresh_token", async () => {
            const redirect_uri = "http://whatever";
            const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);
            const res = await fetchAccessToken({ code, redirect_uri })
            expect(res.status).to.equal(200)
            const json = await res.json()
            expect(json).to.haveOwnProperty("refresh_token")

            const formData = new URLSearchParams()
            formData.set("grant_type", "refresh_token")
            formData.set("refresh_token", json.refresh_token)
            
            const res2 = await fetch(LAUNCHER.baseUrl + "/v/r4/auth/token", {
                method: "POST",
                body: formData,
                headers: {
                    "content-type": "application/x-www-form-urlencoded"
                }
            });

            expect(res2.ok).to.equal(true)
            expect(res2.status).to.equal(200)
            expect(res2.headers.get("content-type")).to.match(/\bjson\b/)
            const json2 = await res2.json()
            expect(json2).to.haveOwnProperty("access_token").and.to.be.a("string")
            expect(json2.token_type).to.equal("Bearer")
            expect(json2).to.haveOwnProperty("scope").and.to.be.a("string")
            expect(json2).to.haveOwnProperty("expires_in").and.to.be.a("number")
            expect(json2).to.haveOwnProperty("refresh_token").and.to.be.a("string")
        })

        describe("Asymmetric authentication", () => {

            const ES384_JWK = {
                "kty": "EC",
                "crv": "P-384",
                "d": "WcrTiYk8jbI-Sd1sKNpqGmELWGG08bf_y9SSlnC4cpAl5GRdHHN9gKYlPvMFqiJ5",
                "x": "wcE8O55ro6aOuTf5Ty1k_IG4mTcuLiVercHouge1G5Ri-leevhev4uJzlHpi3U8r",
                "y": "mLRgz8Giu6XA_AqG8bywqbygShmd8jowflrdx0KQtM5X4s4aqDeCRfcpexykp3aI",
                "kid": "afb27c284f2d93959c18fa0320e32060",
                "alg": "ES384"
            };
            
            const RS384_JWK = {
                "kty": "RSA",
                "alg": "RS384",
                "n": "xo_gxYK3pcbczo8tSXLRaFGKBGEjQpk9tXnLEgZ3P0bAG8I26Sw4LSzMw2Mqz4aF0E73AUAkephuKMWSneGO6ZI0uAOaRXYXruHHAG68pK5dT8MZyWnXAwwNYK_QmtnC7Bc7jmqRDn9jANo6iREtkFvuNpyOv-tVk8waZoTG4zf0O4AOXSiRFp4N4_QWwyhzUX8mhjtW5hFZcg6vm_VIcDv1E5rcumbc3ga53c8G6_lNoKfRzh4Mhf8-Mnljszo7x8MdLZ7OEhMAg8DCzx66Vsm4dOassRRIFNUyBsu3fRslByLdUoXdcjMmp0hYqPVKxpukgb-WQEeVWsB-lAjZHw",
                "e": "AQAB",
                "d": "qEnfTmcYsWdXU7ZjwqGOvCSHnmiZ0uNAOuQL6a4TOU0Em0JC-eMhhaA3t83_xb2VAlU64hN0F3fDvcieGDPIxUvGZMOg6AhL0EvJNyOjvMuPiH-qBlwvAIUhfXXljqjLnP-f2XeWk7wBtAJBpFQr0vMndZ_BGQYjFM3i_krAqmgMPorxRmP5FZIeSyXAyGhuqBZ_N4s_-BitBrAm7MlEexc4FwxQg3hDoZ9gk1DcKnnpYCtZGUj3zhcxXzp2vOu9PHiBJ91GbPp9yOwWie4-bd8Q2XJT0cOfVRLbqsVQkarvS7zHWqlmIRUiJM-Ffhv8rwuWOlnM1mhC0bkDBJb8MQ",
                "p": "_blYwdk-rAX1IiKnBUGn72zALfd0gjkVMHI_0-O56zUHTthVhVZ0TS7B0SwtgZU48rnSewf2SiZyfk3jMfgvmt6M6B0HIXbE0OdPhFt_qfo8AbwdZ4cmmRiqk-k5EBqchI2Rd6hy5t6YIR24XHZeArqF7zI-x9p_XSJ41wMn0qc",
                "q": "yFfbZDxSpdHP8eSTwUmjB-FPyPYwQHdtSNE3UfqlGF0iCt_TBS2kY8DceI6F67IixOMUEbKqAEZYB_gcU5cbyDW77lEejmdNyT3QQicJYmiAicv3sIXDS5Y4zONah64stqZR3jLAXSdz1NEzIiKN8LC_3LBnleo0MNFspYaqbMk",
                "dp": "zdaAW0OTxJtQs9DJD0qko2jmwGPw8XS96__EKHKnclojA6QePX5V_Afi1X-xq18URFbcm1NqS93FJRKrLu7aMBo81lI2Zr-kDJabvBU_DPcll4K1mDfc6HdKa5TZ5mawdBkl2p2eGg6b_MHPv7OHsU8BOXzZ0elBSp2cy1KUDCE",
                "dq": "F3vE6bDwdyNq3o3Oi_-XrprIgWPqMARPuRNdCqz4oSx5ixDFaXv6Iv8-WJtMM16EGNQNTC3HI5UbSIPavimeRg-WYc78Z_DP-2DVgouU3AYn2v8fn39ubvPC4LFdsT3HW_mO6x7D0aeIOk_zUHMAdFAjjTjYS4hSac6Cj7yDSZE",
                "qi": "S0_CM6gD7_QZYM4LURTT_zpiaG5WDsGhKzw67fBNfpvS79T4Y-C9ICLc9h2SFflMXRry9SiKNDOdBm1MqYXm4R5ExHxr1DYzoBOk6q6ejlo8iImnKt-BhEU-L21NZzKxJXuS3Bu6RPYtclRfbAQP_BwxjtM4kwXnewXhZQrKb1Y",
                "kid": "5f75856796f2270469566ceb84c204f6"
            };

            it ("works with ES384", async () => {

                const redirect_uri = "http://localhost";

                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");

                const publicKey = privateKey.toJSON(false)
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    jwks: { keys: [ publicKey ] }
                }, config.jwtSecret);
                
                const assertion = createClientAssertion({
                    tokenUrl: LAUNCHER.baseUrl + "/v/r4/auth/token",
                    clientId: code,
                    privateKey,
                })
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.status).to.equal(200)
                await res.json()
            })

            it ("works with RS384", async () => {

                const redirect_uri = "http://localhost";

                const privateKey = await jose.JWK.asKey(RS384_JWK, "json");

                const publicKey = privateKey.toJSON(false)
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    jwks: { keys: [ publicKey ] }
                }, config.jwtSecret);
                
                const assertion = createClientAssertion({
                    tokenUrl: LAUNCHER.baseUrl + "/v/r4/auth/token",
                    clientId: code,
                    privateKey,
                })
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.status).to.equal(200)
                await res.json()
            })

            it ("works with string jwks", async () => {

                const redirect_uri = "http://localhost";

                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");

                const publicKey = privateKey.toJSON(false)
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    jwks: JSON.stringify({ keys: [ publicKey ] })
                }, config.jwtSecret);
                
                const assertion = createClientAssertion({
                    tokenUrl: LAUNCHER.baseUrl + "/v/r4/auth/token",
                    clientId: code,
                    privateKey,
                })
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.status).to.equal(200)
                await res.json()
            })

            it ("fails with bad client_assertion token", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: "bad-token"
                })

                expect(res.ok).to.equal(false)
                await res.json()
            })

            it ("throws on missing 'iss' claim", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);
                
                const assertion = jwt.sign({}, privateKey.toPEM(true), {
                    algorithm: privateKey.alg as jwt.Algorithm,
                    keyid    : privateKey.kid
                });

                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Missing token 'iss' claim")
            })

            it ("throws on missing 'sub' claim", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: code
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm,
                        keyid    : privateKey.kid
                    }
                );

                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Missing token 'sub' claim")
            })

            it ("throws on missing 'aud' claim", async () => {
                const redirect_uri = "http://localhost";
                const privateKey   = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey    = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: code,
                        sub: code
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm,
                        keyid    : privateKey.kid
                    }
                );

                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Missing token 'aud' claim")
            })

            it ("throws on missing 'exp' claim", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: code,
                        sub: code,
                        aud: LAUNCHER.baseUrl + "/v/r4/auth/token"
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm,
                        keyid    : privateKey.kid
                    }
                );

                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Missing token 'exp' claim")
            })

            it ("throws on missing 'jti' claim", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: "x",
                        sub: "x",
                        aud: "x",
                        exp: 1
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm,
                        keyid    : privateKey.kid
                    }
                );

                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Missing token 'jti' claim")
            })

            it ("throws if jwtHeaders.typ !== 'JWT'", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false)
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);
                
                const assertion = "eyJhbGciOiJIUzI1NiIsInR5cCI6IngifQ.eyJpc3MiOiJ4Iiwic3ViIjoieCIsImF1ZCI6IngiLCJleHAiOjEsImp0aSI6IngiLCJpYXQiOjE2NjU0MDczNTZ9.LXMcMfceSYp3YMQU8Wan4Kly-laQ6_2UI3rDWrPagjA";

                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Invalid token 'typ' header. Must be 'JWT'.")
            })

            it ("throws on missing 'kid' header", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]
    
                const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: "x",
                        sub: "x",
                        aud: "x",
                        exp: 1,
                        jti: "x"
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm
                    }
                );
    
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })
    
                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Missing token 'kid' header")
            })

            it ("throws on missing 'alg' header", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]
    
                const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);
                
                const assertion = "eyJ0eXAiOiJKV1QiLCJraWQiOiJ4In0.eyJpc3MiOiJ4Iiwic3ViIjoieCIsImF1ZCI6IngiLCJleHAiOjEsImp0aSI6IngiLCJpYXQiOjE2NjU0MDczNTZ9.LXMcMfceSYp3YMQU8Wan4Kly-laQ6_2UI3rDWrPagjA";
    
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })
    
                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Missing token 'alg' header")
            })

            // it ("fails if token.sub is not a JWT", async () => {
            //     const redirect_uri = "http://localhost";
            //     const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
            //     const publicKey = privateKey.toJSON(false);
                
            //     // @ts-ignore
            //     publicKey.key_ops = [ "verify" ]

            //     const code = jwt.sign({ redirect_uri, scope: "offline_access" }, config.jwtSecret);

            //     const assertion = jwt.sign(
            //         {
            //             iss: "x",
            //             sub: "x",
            //             aud: "x",
            //             exp: 1,
            //             jti: "x"
            //         },
            //         privateKey.toPEM(true),
            //         {
            //             algorithm: privateKey.alg as jwt.Algorithm,
            //             keyid    : privateKey.kid
            //         }
            //     );
                
            //     const res = await fetchAccessToken({
            //         code,
            //         redirect_uri,
            //         client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            //         client_assertion: assertion
            //     })

            //     expect(res.ok).to.equal(false)
            //     const json = await res.json()
            //     expect(json.error).to.equal("invalid_client")
            //     expect(json.error_description).to.equal("Invalid client details token: jwt malformed")
            // })

            it ("can simulate token_expired_registration_token", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false)
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    auth_error: "token_expired_registration_token"
                }, config.jwtSecret);
                
                const assertion = createClientAssertion({
                    tokenUrl: LAUNCHER.baseUrl + "/v/r4/auth/token",
                    clientId: code,
                    privateKey,
                })
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Simulated expired token error")
            })

            it ("can simulate token_invalid_jti", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false)
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    auth_error: "token_invalid_jti"
                }, config.jwtSecret);
                
                const assertion = createClientAssertion({
                    tokenUrl: LAUNCHER.baseUrl + "/v/r4/auth/token",
                    clientId: code,
                    privateKey,
                })
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Simulated invalid 'jti' value")
            })

            it ("throws if iss !== sub", async () => {

                const redirect_uri = "http://localhost";

                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");

                const publicKey = privateKey.toJSON(false)
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    jwks: { keys: [ publicKey ] }
                }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: "x",
                        sub: code,
                        aud: "x",
                        exp: 1,
                        jti: "x"
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm,
                        keyid    : privateKey.kid
                    }
                );
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("The token sub does not match the token iss claim")
            })

            it ("validates aud", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false)
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    jwks: { keys: [ publicKey ] }
                }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: code,
                        sub: code,
                        aud: "x",
                        exp: 1,
                        jti: "x"
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm,
                        keyid    : privateKey.kid
                    }
                );
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal(`Invalid token 'aud' value (x). Must be '${LAUNCHER.baseUrl + "/v/r4/auth/token"}'.`)
            })

            it ("throws if jku is not whitelisted", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false)
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    // jwks: { keys: [ publicKey ] },
                    jwks_url: "a"
                }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: code,
                        sub: code,
                        aud: LAUNCHER.baseUrl + "/v/r4/auth/token",
                        exp: 1,
                        jti: "x"
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm,
                        keyid    : privateKey.kid,
                        header: {
                            alg: privateKey.alg as jwt.Algorithm,
                            jku: "b"
                        }
                    }
                );
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("jku 'b' not whitelisted. Allowed: 'a'")
            })

            it ("throws if no jwks or jwks_url is specified", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access"
                }, config.jwtSecret);
                
                const assertion = createClientAssertion({
                    tokenUrl: LAUNCHER.baseUrl + "/v/r4/auth/token",
                    clientId: code,
                    privateKey,
                })
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("No JWKS or JWKS URL found for this launch")
            })

            it ("throws if jku is not a valid URL", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    jwks_url: "b"
                }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: code,
                        sub: code,
                        aud: LAUNCHER.baseUrl + "/v/r4/auth/token",
                        exp: 1,
                        jti: "x"
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm,
                        keyid    : privateKey.kid,
                        header: {
                            alg: privateKey.alg as jwt.Algorithm,
                            jku: "b"
                        }
                    }
                );
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Failed to fetch JWKS from b. Only absolute URLs are supported")
            })

            it ("throws if jwks_url is not a valid URL", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    jwks_url: "b"
                }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: code,
                        sub: code,
                        aud: LAUNCHER.baseUrl + "/v/r4/auth/token",
                        exp: 1,
                        jti: "x"
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm,
                        keyid    : privateKey.kid
                    }
                );
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Failed to fetch JWKS from b. Only absolute URLs are supported")
            })

            it ("throws if jwks string is not a valid json", async () => {
                const redirect_uri = "http://localhost";
                const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                const publicKey = privateKey.toJSON(false);
                
                // @ts-ignore
                publicKey.key_ops = [ "verify" ]

                const code = jwt.sign({
                    redirect_uri,
                    scope: "offline_access",
                    jwks: "whatever"
                }, config.jwtSecret);
                
                const assertion = jwt.sign(
                    {
                        iss: code,
                        sub: code,
                        aud: LAUNCHER.baseUrl + "/v/r4/auth/token",
                        exp: 1,
                        jti: "x"
                    },
                    privateKey.toPEM(true),
                    {
                        algorithm: privateKey.alg as jwt.Algorithm,
                        keyid    : privateKey.kid
                    }
                );
                
                const res = await fetchAccessToken({
                    code,
                    redirect_uri,
                    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    client_assertion: assertion
                })

                expect(res.ok).to.equal(false)
                const json = await res.json()
                expect(json.error).to.equal("invalid_client")
                expect(json.error_description).to.equal("Invalid JWKS json")
            })

            describe("Remote JWKS validation", () => {

                const JWKS_MOCK_SERVER = new MockServer("JWKS Mock Server", true);

                before(async () => await JWKS_MOCK_SERVER.start());
                
                after(async () => await JWKS_MOCK_SERVER.stop());
                
                beforeEach(() => JWKS_MOCK_SERVER.clear());

                async function test(mockOptions: MockOptions) {
                    JWKS_MOCK_SERVER.mock("/jwks", mockOptions)
                    const redirect_uri = "http://localhost";
                    const privateKey = await jose.JWK.asKey(ES384_JWK, "json");
                    const publicKey = privateKey.toJSON(false);
                    
                    // @ts-ignore
                    publicKey.key_ops = [ "verify" ]

                    const code = jwt.sign({
                        redirect_uri,
                        scope: "offline_access",
                        jwks_url: JWKS_MOCK_SERVER.baseUrl + "/jwks"
                    }, config.jwtSecret);
                    
                    const assertion = jwt.sign(
                        {
                            iss: code,
                            sub: code,
                            aud: LAUNCHER.baseUrl + "/v/r4/auth/token",
                            exp: 1,
                            jti: "x"
                        },
                        privateKey.toPEM(true),
                        {
                            algorithm: privateKey.alg as jwt.Algorithm,
                            keyid    : privateKey.kid
                        }
                    );
                    
                    return await fetchAccessToken({
                        code,
                        redirect_uri,
                        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                        client_assertion: assertion
                    })
                }

                it ("fails if the jwks url is not found", async () => {
                    const res = await test({ status: 404 })
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.equal(`Failed to fetch JWKS from ${JWKS_MOCK_SERVER.baseUrl}/jwks. 404 Not Found`)
                })

                it ("fails if the jwks url does not reply with json", async () => {
                    const res = await test({ body: "test" })
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.include(`Failed to fetch JWKS from ${JWKS_MOCK_SERVER.baseUrl}/jwks. invalid json response body`)
                })

                it ("fails if the fetched jwks is not an object", async () => {
                    const res = await test({ body: [] })
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.equal(`JWKS is not an object`)
                })

                it ("fails if the fetched jwks has no keys property", async () => {
                    const res = await test({ body: {} })
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.equal(`JWKS does not have a "keys" property`)
                })

                it ("fails if the fetched jwks keys property is not an array", async () => {
                    const res = await test({ body: { keys: 4 } })
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.equal(`jwks.keys must be an array`)
                })

                it ("fails if the fetched jwks keys property is not an empty array", async () => {
                    const res = await test({ body: { keys: [] } })
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.equal(`No usable keys found`)
                })

                // it ("fails if the none of the keys have a key_ops array", async () => {
                //     const res = await test({ body: { keys: [ {}, {} ] } })
                //     expect(res.ok).to.equal(false)
                //     const json = await res.json()
                //     expect(json.error).to.equal("invalid_client")
                //     expect(json.error_description).to.equal(`None of the keys found in the JWKS have the key_ops array property`)
                // })

                it ("fails if the none of the keys have an alg property", async () => {
                    const res = await test({ body: { keys: [ { key_ops: [] }, { key_ops: [] } ] } })
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.equal(`None of the keys found in the JWKS alg equal to ES384`)
                })

                it ("fails if the none of the keys have the needed kid", async () => {
                    const res = await test({ body: { keys: [ { key_ops: [], alg: "ES384" }, { key_ops: [] } ] } })
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.equal(`None of the keys found in the JWKS kid equal to ${ES384_JWK.kid}`)
                })

                // it ("fails if the none of the keys have 'verify' in their key_ops", async () => {
                //     const res = await test({ body: { keys: [ { key_ops: [], alg: "ES384", kid: ES384_JWK.kid } ]}})
                //     expect(res.ok).to.equal(false)
                //     const json = await res.json()
                //     expect(json.error).to.equal("invalid_client")
                //     expect(json.error_description).to.equal(`No usable public keys found in the JWKS`)
                // })

                it ("fails if multiple keys match all requirements", async () => {
                    const res = await test({ body: { keys: [
                        { key_ops: [ "verify" ], alg: "ES384", kid: ES384_JWK.kid },
                        { key_ops: [ "verify" ], alg: "ES384", kid: ES384_JWK.kid }
                    ]}})
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.equal(`Multiple usable public keys found in the JWKS`)
                })

                it ("fails if the found key is not valid JWK", async () => {
                    const res = await test({ body: { keys: [{ key_ops: [ "verify" ], alg: "ES384", kid: ES384_JWK.kid }]}})
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.include(`No usable public key found in the JWKS.`)
                })

                it ("fails with bad jwk JWK", async () => {
                    const res = await test({ body: { keys: [{ ...ES384_JWK, key_ops: [ "verify" ], "d": "whatever" }]}})
                    expect(res.ok).to.equal(false)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_client")
                    expect(json.error_description).to.include(`Invalid token`)
                })
            })
        })

        
    })

    it ("rejects token requests with invalid redirect_uri param", async () => {
        const code = jwt.sign({
            scope: "offline_access",
            redirect_uri: "http://whatever"
        }, config.jwtSecret, { expiresIn: "5m" })
        const codeObject = jwt.decode(code);
        expect(codeObject).to.haveOwnProperty("redirect_uri");
        expect(fetchAccessToken({ code, redirect_uri: "http://something.else" })).to.eventually.be.rejected;
    })

    describe('Backend Services', () => {

        const JWKS_MOCK_SERVER = new MockServer("JWKS Mock Server", true);

        before(async () => await JWKS_MOCK_SERVER.start());
        
        after(async () => await JWKS_MOCK_SERVER.stop());
        
        beforeEach(() => JWKS_MOCK_SERVER.clear());

        const PRIVATE_KEY = {
            "kty": "RSA",
            "alg": "RS384",
            "n": "xo_gxYK3pcbczo8tSXLRaFGKBGEjQpk9tXnLEgZ3P0bAG8I26Sw4LSzMw2Mqz4aF0E73AUAkephuKMWSneGO6ZI0uAOaRXYXruHHAG68pK5dT8MZyWnXAwwNYK_QmtnC7Bc7jmqRDn9jANo6iREtkFvuNpyOv-tVk8waZoTG4zf0O4AOXSiRFp4N4_QWwyhzUX8mhjtW5hFZcg6vm_VIcDv1E5rcumbc3ga53c8G6_lNoKfRzh4Mhf8-Mnljszo7x8MdLZ7OEhMAg8DCzx66Vsm4dOassRRIFNUyBsu3fRslByLdUoXdcjMmp0hYqPVKxpukgb-WQEeVWsB-lAjZHw",
            "e": "AQAB",
            "d": "qEnfTmcYsWdXU7ZjwqGOvCSHnmiZ0uNAOuQL6a4TOU0Em0JC-eMhhaA3t83_xb2VAlU64hN0F3fDvcieGDPIxUvGZMOg6AhL0EvJNyOjvMuPiH-qBlwvAIUhfXXljqjLnP-f2XeWk7wBtAJBpFQr0vMndZ_BGQYjFM3i_krAqmgMPorxRmP5FZIeSyXAyGhuqBZ_N4s_-BitBrAm7MlEexc4FwxQg3hDoZ9gk1DcKnnpYCtZGUj3zhcxXzp2vOu9PHiBJ91GbPp9yOwWie4-bd8Q2XJT0cOfVRLbqsVQkarvS7zHWqlmIRUiJM-Ffhv8rwuWOlnM1mhC0bkDBJb8MQ",
            "p": "_blYwdk-rAX1IiKnBUGn72zALfd0gjkVMHI_0-O56zUHTthVhVZ0TS7B0SwtgZU48rnSewf2SiZyfk3jMfgvmt6M6B0HIXbE0OdPhFt_qfo8AbwdZ4cmmRiqk-k5EBqchI2Rd6hy5t6YIR24XHZeArqF7zI-x9p_XSJ41wMn0qc",
            "q": "yFfbZDxSpdHP8eSTwUmjB-FPyPYwQHdtSNE3UfqlGF0iCt_TBS2kY8DceI6F67IixOMUEbKqAEZYB_gcU5cbyDW77lEejmdNyT3QQicJYmiAicv3sIXDS5Y4zONah64stqZR3jLAXSdz1NEzIiKN8LC_3LBnleo0MNFspYaqbMk",
            "dp": "zdaAW0OTxJtQs9DJD0qko2jmwGPw8XS96__EKHKnclojA6QePX5V_Afi1X-xq18URFbcm1NqS93FJRKrLu7aMBo81lI2Zr-kDJabvBU_DPcll4K1mDfc6HdKa5TZ5mawdBkl2p2eGg6b_MHPv7OHsU8BOXzZ0elBSp2cy1KUDCE",
            "dq": "F3vE6bDwdyNq3o3Oi_-XrprIgWPqMARPuRNdCqz4oSx5ixDFaXv6Iv8-WJtMM16EGNQNTC3HI5UbSIPavimeRg-WYc78Z_DP-2DVgouU3AYn2v8fn39ubvPC4LFdsT3HW_mO6x7D0aeIOk_zUHMAdFAjjTjYS4hSac6Cj7yDSZE",
            "qi": "S0_CM6gD7_QZYM4LURTT_zpiaG5WDsGhKzw67fBNfpvS79T4Y-C9ICLc9h2SFflMXRry9SiKNDOdBm1MqYXm4R5ExHxr1DYzoBOk6q6ejlo8iImnKt-BhEU-L21NZzKxJXuS3Bu6RPYtclRfbAQP_BwxjtM4kwXnewXhZQrKb1Y",
            "kid": "5f75856796f2270469566ceb84c204f6"
        };

        it ("rejects missing sim segment", async () => {
            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                sim: ""
            })
            expect(res.status).to.equal(400)
            const json = await res.json()
            expect(json.error).to.equal("invalid_request")
            expect(json.error_description).to.match(/^Invalid launch options/)
        })

        it ("rejects invalid sim segment", async () => {
            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                sim: "x"
            })
            expect(res.status).to.equal(400)
            const json = await res.json()
            expect(json.error).to.equal("invalid_request")
            expect(json.error_description).to.match(/^Invalid launch options/)
        })

        it ("requires scope param", async () => {
            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                sim: { launch_type: "backend-service" }
            })
            expect(res.status).to.equal(400)
            const json = await res.json()
            expect(json.error).to.equal("invalid_client")
            expect(json.error_description).to.equal("Missing 'scope' parameter")
        })

        it ("requires client_assertion_type param", async () => {
            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/*.read",
                sim: { launch_type: "backend-service" }
            })
            expect(res.status).to.equal(400)
            const json = await res.json()
            expect(json.error).to.equal("invalid_client")
            expect(json.error_description).to.equal("Missing 'client_assertion_type' parameter")
        })

        it ("requires client_assertion param", async () => {
            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/*.read",
                client_assertion_type: "x",
                sim: { launch_type: "backend-service" }
            })
            expect(res.status).to.equal(400)
            const json = await res.json()
            expect(json.error).to.equal("invalid_client")
            expect(json.error_description).to.equal("Missing 'client_assertion' parameter")
        })

        it ("validates client_assertion_type", async () => {
            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/*.read",
                client_assertion_type: "x",
                client_assertion: "x",
                sim: { launch_type: "backend-service" }
            })
            expect(res.status).to.equal(400)
            const json = await res.json()
            expect(json.error).to.equal("invalid_client")
            expect(json.error_description).to.equal("Invalid 'client_assertion_type' parameter. Must be 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'.")
        })

        it ("validates client_assertion", async () => {
            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/*.read",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: "x",
                sim: { launch_type: "backend-service" }
            })
            expect(res.status).to.equal(401)
            const json = await res.json()
            expect(json.error).to.equal("invalid_request")
            expect(json.error_description).to.equal('Could not decode the "client_assertion" parameter')
        })

        it ("can simulate invalid jti", async () => {
            
            const sim: SMART.LaunchParams = {
                launch_type: "backend-service",
                auth_error: "token_invalid_jti"
            };

            const tokenUrl = getTokenURL({ sim });
            
            const assertion = jwt.sign({
                iss: "whatever",
                sub: "whatever",
                aud: tokenUrl.href,
                jti: "random-non-reusable-jwt-id-123"
            }, config.jwtSecret, {
                expiresIn: "10m",
                keyid: "whatever"
            });

            // console.log(tokenUrl, assertion)

            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/*.read",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: assertion,
                sim
            })

            expect(res.status).to.equal(401)
            const json = await res.json()
            expect(json.error).to.equal("invalid_client")
            expect(json.error_description).to.equal("Simulated invalid 'jti' value")
        })

        it ("can simulate invalid token", async () => {
            
            const sim: SMART.LaunchParams = {
                launch_type: "backend-service",
                auth_error: "token_invalid_token"
            };

            const tokenUrl = getTokenURL({ sim });

            const assertion = jwt.sign({
                iss: "whatever",
                sub: "whatever",
                aud: tokenUrl.href,
                jti: "random-non-reusable-jwt-id-123"
            }, jwk2pem(PRIVATE_KEY), {
                expiresIn: "10m",
                keyid: PRIVATE_KEY.kid,
                header: {
                    alg: "RS384",
                    jku: JWKS_MOCK_SERVER.baseUrl + "/jwks"
                }
            });

            JWKS_MOCK_SERVER.mock("/jwks", {
                body: {
                    keys: [{ ...PRIVATE_KEY, key_ops: [ "verify" ] }]
                }
            })

            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/*.read",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: assertion,
                sim
            })

            expect(res.status).to.equal(401)
            const json = await res.json()
            expect(json.error).to.equal("invalid_client")
            expect(json.error_description).to.equal("Simulated invalid token error")
        })

        it ("can simulate expired token", async () => {
            
            const sim: SMART.LaunchParams = {
                launch_type: "backend-service",
                auth_error: "token_expired_registration_token"
            };

            const tokenUrl = getTokenURL({ sim });

            const assertion = jwt.sign({
                iss: "whatever",
                sub: "whatever",
                aud: tokenUrl.href,
                jti: "random-non-reusable-jwt-id-123"
            }, jwk2pem(PRIVATE_KEY), {
                expiresIn: "10m",
                keyid: PRIVATE_KEY.kid,
                header: {
                    alg: "RS384",
                    jku: JWKS_MOCK_SERVER.baseUrl + "/jwks"
                }
            });

            JWKS_MOCK_SERVER.mock("/jwks", {
                body: {
                    keys: [{ ...PRIVATE_KEY, key_ops: [ "verify" ] }]
                }
            })

            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/*.read",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: assertion,
                sim
            })

            expect(res.status).to.equal(401)
            const json = await res.json()
            expect(json.error).to.equal("invalid_client")
            expect(json.error_description).to.equal("Simulated expired token error")
        })

        it ("can simulate expired token", async () => {
            
            const sim: SMART.LaunchParams = {
                launch_type: "backend-service",
                auth_error: "token_invalid_scope"
            };

            const tokenUrl = getTokenURL({ sim });

            const assertion = jwt.sign({
                iss: "whatever",
                sub: "whatever",
                aud: tokenUrl.href,
                jti: "random-non-reusable-jwt-id-123"
            }, jwk2pem(PRIVATE_KEY), {
                expiresIn: "10m",
                keyid: PRIVATE_KEY.kid,
                header: {
                    alg: "RS384",
                    jku: JWKS_MOCK_SERVER.baseUrl + "/jwks"
                }
            });

            JWKS_MOCK_SERVER.mock("/jwks", {
                body: {
                    keys: [{ ...PRIVATE_KEY, key_ops: [ "verify" ] }]
                }
            })

            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/*.read",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: assertion,
                sim
            })

            expect(res.status).to.equal(401)
            const json = await res.json()
            expect(json.error).to.equal("invalid_scope")
            expect(json.error_description).to.equal("Simulated invalid scope error")
        })

        it ("validates client_id", async () => {
            
            const sim: SMART.LaunchParams = {
                launch_type: "backend-service",
                client_id: "some-client-id"
            };

            const tokenUrl = getTokenURL({ sim });

            const assertion = jwt.sign({
                iss: "whatever",
                sub: "whatever",
                aud: tokenUrl.href,
                jti: "random-non-reusable-jwt-id-123"
            }, jwk2pem(PRIVATE_KEY), {
                expiresIn: "10m",
                keyid: PRIVATE_KEY.kid,
                header: {
                    alg: "RS384",
                    jku: JWKS_MOCK_SERVER.baseUrl + "/jwks"
                }
            });

            JWKS_MOCK_SERVER.mock("/jwks", {
                body: {
                    keys: [{ ...PRIVATE_KEY, key_ops: [ "verify" ] }]
                }
            })

            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/*.read",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: assertion,
                sim
            })

            expect(res.status).to.equal(401)
            const json = await res.json()
            expect(json.error).to.equal("invalid_client")
            expect(json.error_description).to.equal("Invalid 'client_id' (as sub claim of the assertion JWT)")
        })

        it ("validates scopes", async () => {
            
            const sim: SMART.LaunchParams = {
                launch_type: "backend-service"
            };

            const tokenUrl = getTokenURL({ sim });

            const assertion = jwt.sign({
                iss: "whatever",
                sub: "whatever",
                aud: tokenUrl.href,
                jti: "random-non-reusable-jwt-id-123"
            }, jwk2pem(PRIVATE_KEY), {
                expiresIn: "10m",
                keyid: PRIVATE_KEY.kid,
                header: {
                    alg: "RS384",
                    jku: JWKS_MOCK_SERVER.baseUrl + "/jwks"
                }
            });

            JWKS_MOCK_SERVER.mock("/jwks", {
                body: {
                    keys: [{ ...PRIVATE_KEY, key_ops: [ "verify" ] }]
                }
            })

            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/*.read x",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: assertion,
                sim
            })

            expect(res.status).to.equal(401)
            const json = await res.json()
            expect(json.error).to.equal("invalid_scope")
            expect(json.error_description).to.equal('Invalid scope(s) "x" requested. Only system scopes are allowed.')
        })

        it ("does scope negotiation", async () => {
            
            const sim: SMART.LaunchParams = {
                launch_type: "backend-service",
                scope: "system/Patient.read"
            };

            const tokenUrl = getTokenURL({ sim });

            const assertion = jwt.sign({
                iss: "whatever",
                sub: "whatever",
                aud: tokenUrl.href,
                jti: "random-non-reusable-jwt-id-123"
            }, jwk2pem(PRIVATE_KEY), {
                expiresIn: "10m",
                keyid: PRIVATE_KEY.kid,
                header: {
                    alg: "RS384",
                    jku: JWKS_MOCK_SERVER.baseUrl + "/jwks"
                }
            });

            JWKS_MOCK_SERVER.mock("/jwks", {
                body: {
                    keys: [{ ...PRIVATE_KEY, key_ops: [ "verify" ] }]
                }
            })

            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/Slot.write",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: assertion,
                sim
            })

            expect(res.status).to.equal(401)
            const json = await res.json()
            expect(json.error).to.equal("invalid_scope")
            expect(json.error_description).to.equal('None of the requested scope(s) could be granted.')
        })

        it ("passes request_invalid_token to the access token", async () => {
            
            const sim: SMART.LaunchParams = {
                launch_type: "backend-service",
                auth_error: "request_invalid_token"
            };

            const tokenUrl = getTokenURL({ sim });

            const assertion = jwt.sign({
                iss: "whatever",
                sub: "whatever",
                aud: tokenUrl.href,
                jti: "random-non-reusable-jwt-id-123"
            }, jwk2pem(PRIVATE_KEY), {
                expiresIn: "10m",
                keyid: PRIVATE_KEY.kid,
                header: {
                    alg: "RS384",
                    jku: JWKS_MOCK_SERVER.baseUrl + "/jwks"
                }
            });

            JWKS_MOCK_SERVER.mock("/jwks", {
                body: {
                    keys: [{ ...PRIVATE_KEY, key_ops: [ "verify" ] }]
                }
            })

            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/Slot.write",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: assertion,
                sim
            })

            expect(res.status).to.equal(200)
            const json = await res.json()
            const token = jwt.decode(json.access_token, { json: true })
            expect(token!.sim_error).to.equal("Invalid token (simulated error)")
        })

        it ("passes request_expired_token to the access token", async () => {
            
            const sim: SMART.LaunchParams = {
                launch_type: "backend-service",
                auth_error: "request_expired_token"
            };

            const tokenUrl = getTokenURL({ sim });

            const assertion = jwt.sign({
                iss: "whatever",
                sub: "whatever",
                aud: tokenUrl.href,
                jti: "random-non-reusable-jwt-id-123"
            }, jwk2pem(PRIVATE_KEY), {
                expiresIn: "10m",
                keyid: PRIVATE_KEY.kid,
                header: {
                    alg: "RS384",
                    jku: JWKS_MOCK_SERVER.baseUrl + "/jwks"
                }
            });

            JWKS_MOCK_SERVER.mock("/jwks", {
                body: {
                    keys: [{ ...PRIVATE_KEY, key_ops: [ "verify" ] }]
                }
            })

            const res = await fetchAccessToken({
                grant_type: "client_credentials",
                scope: "system/Slot.write",
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                client_assertion: assertion,
                sim
            })

            expect(res.status).to.equal(200)
            const json = await res.json()
            const token = jwt.decode(json.access_token, { json: true })
            expect(token!.sim_error).to.equal("Token expired (simulated error)")
        })
    });
})

it ("The revoke endpoint is N/A for this server", async () => {
    const res = await fetch(LAUNCHER.baseUrl + "/v/r4/auth/revoke", { method: "POST" })
    expect(res.ok).to.equal(false)
    expect(await res.text()).to.equal("POST /v/r4/auth/revoke is not supported by this server")
})

it ("The manage endpoint is N/A for this server", async () => {
    const res = await fetch(LAUNCHER.baseUrl + "/v/r4/auth/manage", { method: "POST" })
    expect(res.ok).to.equal(false)
    expect(await res.text()).to.equal("POST /v/r4/auth/manage is not supported by this server")
})
