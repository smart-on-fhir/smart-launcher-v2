import { expect }                    from "chai"
import { LAUNCHER, FHIR_VERSIONS }   from "../TestContext"
import { launch, parseResponseCode } from "../lib"


FHIR_VERSIONS.forEach(([fhirVersion]) => {
    describe(`${fhirVersion} FHIR Server`, () => {
        ["GET", "POST"].forEach(method => {
            describe(`authorize endpoint using ${method} request`, () => {

                /**
                 * If the `auth_error` property of the launch code is set to "auth_invalid_client_id",
                 * then we should get back an `invalid_client` OAuth error with descriptive message
                 */
                it (`can simulate invalid client_id error`, async () => {
                    const res = await launch({
                        launchParams: {
                            launch_type: "provider-ehr",
                            auth_error: "auth_invalid_client_id"
                        },
                        fhirVersion,
                        redirect_uri : "http://localhost",
                        response_type: "code",
                        requestOptions: {
                            method
                        }
                    })
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_client")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal("Simulated invalid client_id parameter error")
                });

                /**
                 * If a client_id is set in the launcher UI, make sure the app 
                 * launch fails, unless the app uses the same client_id
                 */
                it (`validates client_id if passed in launch options`, async () => {
                    const res = await launch({
                        launchParams: {
                            launch_type: "provider-ehr",
                            client_id: "my-client-id"
                        },
                        fhirVersion,
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        client_id     : "whatever",
                        requestOptions: { method }
                    });
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_client")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal('Invalid client_id "whatever". Expected "my-client-id".')
                });

                /**
                 * If the `auth_error` property of the launch code is set to "auth_invalid_redirect_uri",
                 * then we should get back an `invalid_request` OAuth error with descriptive message
                 */
                it (`can simulate invalid redirect_uri error`, async () => {
                    const res = await launch({
                        launchParams  : { launch_type: "provider-ehr", auth_error: "auth_invalid_redirect_uri" },
                        requestOptions: { method },
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        fhirVersion
                    })
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_request")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal("Simulated invalid redirect_uri parameter error")
                });

                /**
                 * If the `auth_error` property of the launch code is set to "auth_invalid_scope",
                 * then we should get back an `invalid_scope` OAuth error with descriptive message
                 */
                it (`can simulate invalid scope error`, async () => {
                    const res = await launch({
                        launchParams  : { launch_type: "provider-ehr", auth_error: "auth_invalid_scope" },
                        requestOptions: { method },
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        fhirVersion
                    });
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_scope")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal("Simulated invalid scope error")
                });

                it ("validates against custom scopes", async () => {
                    const res = await launch({
                        launchParams  : {
                            launch_type: "provider-ehr",
                            scope: "a c */Observation.rs patient/Observation.read"
                        },
                        requestOptions: { method },
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        scope         : "x y z c user/Observation.rs",
                        fhirVersion
                    });
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_scope")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal(
                        'Scopes "x", "y" and "z" could not be granted. Your client is allowed to request "a", "c", "*/Observation.rs" and "patient/Observation.read".'
                    )
                });

                it ("validates against custom redirect_uris", async () => {
                    const res = await launch({
                        launchParams  : {
                            launch_type: "provider-ehr",
                            redirect_uris: "http://a.b,http://c.d"
                        },
                        requestOptions: { method },
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        fhirVersion
                    });
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_request")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal("Invalid redirect_uri")
                });

                it ("accepts exactly listed redirect_uri", async () => {
                    const res = await launch({
                        launchParams  : {
                            launch_type: "provider-ehr",
                            redirect_uris: "http://a.b,http://c.d"
                        },
                        requestOptions: { method },
                        redirect_uri  : "http://c.d",
                        response_type : "code",
                        fhirVersion
                    });
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.not.exist
                    expect(redirectUrl.searchParams.get("error_description")).to.not.exist
                });

                it ("allows redirect_uri to be 'under' a white listed one", async () => {
                    const res = await launch({
                        launchParams  : {
                            launch_type: "provider-ehr",
                            redirect_uris: "http://a.b,http://c.d"
                        },
                        requestOptions: { method },
                        redirect_uri  : "http://c.d/x/y",
                        response_type : "code",
                        fhirVersion
                    });
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.not.exist
                    expect(redirectUrl.searchParams.get("error_description")).to.not.exist
                });

                it ("rejects invalid redirect_uris entries", async () => {
                    const res = await launch({
                        launchParams  : {
                            launch_type: "provider-ehr",
                            redirect_uris: "http://a.b,http://c.d,x.y"
                        },
                        requestOptions: { method },
                        redirect_uri  : "http://c.d/x/y",
                        response_type : "code",
                        fhirVersion
                    });
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_client")
                    expect(redirectUrl.searchParams.get("error_description")).to.include("Invalid redirect_uris entry x.y.")
                });

                /**
                 * If the request does not include `redirect_uri` parameter we should get back an
                 * `invalid_request` OAuth error with descriptive message
                 */
                it (`requires redirect_uri parameter`, async () => {
                    const res = await launch({
                        launchParams  : { launch_type: "provider-ehr" },
                        response_type : "code",
                        requestOptions: { method },
                        fhirVersion
                    });
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(400)
                    expect(res.headers.get("content-type")).to.match(/\bjson\b/)
                    expect(await res.json()).to.deep.equal({
                        error_description: "Missing redirect_uri parameter",
                        error: "invalid_request"
                    })
                });

                /**
                 * If the request does not include `response_type` parameter we should get back an
                 * `invalid_request` OAuth error with descriptive message
                 */
                it (`requires response_type parameter`, async () => {
                    const res = await launch({
                        launchParams: { launch_type: "provider-ehr" },
                        redirect_uri: "http://localhost",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(400)
                    const json = await res.json()
                    expect(json.error).to.equal("invalid_request")
                    expect(json.error_description).to.equal("Missing response_type parameter")
                });

                /**
                 * If the request does not include valid `response_type` parameter we should
                 * get back an `unsupported_grant_type` OAuth error with descriptive message
                 */
                it (`requires response_type parameter`, async () => {
                    const res = await launch({
                        launchParams: { launch_type: "provider-ehr" },
                        redirect_uri: "http://localhost",
                        response_type: "test",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(400)
                    const json = await res.json()
                    expect(json.error).to.equal("unsupported_grant_type")
                    expect(json.error_description).to.equal('Invalid Authorization Grant "test"')
                });

                /**
                 * If the request does not include `aud` parameter we should get back an
                 * `invalid_request` OAuth error with descriptive message
                 */
                it (`requires aud parameter`, async () => {
                    const res = await launch({
                        launchParams  : { launch_type: "provider-ehr" },
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        aud           : undefined,
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_request")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal("Missing aud parameter")
                });

                /**
                 * If the `redirect_uri` parameter is not valid URL we should get back an
                 * `invalid_request` OAuth error with descriptive message
                 */
                it (`asserts that redirect_uri param is valid URL`, async () => {
                    const res = await launch({
                        launchParams: { launch_type: "provider-ehr" },
                        redirect_uri: "whatever",
                        response_type: "code",
                        aud: "http://localhost",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(400)
                    expect(await res.json()).to.deep.equal({
                        error: "invalid_request",
                        error_description: "Bad redirect_uri: whatever. Invalid URL."
                    })
                });

                /**
                 * If the `aud` parameter is not valid URL we should get back an
                 * `invalid_request` OAuth error with descriptive message
                 */
                it (`validates that the aud param is an URL`, async () => {
                    const res = await launch({
                        launchParams: { launch_type: "provider-ehr" },
                        redirect_uri: "http://localhost",
                        response_type: "code",
                        aud: "whatever",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_request")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal('Bad audience value "whatever". Invalid URL.')
                });

                /**
                 * If the `aud` parameter does not match the FHIR server URL we should get
                 * back an `invalid_request` OAuth error with descriptive message
                 */
                it (`validates that the aud param points to the FHIR server`, async () => {
                    const res = await launch({
                        launchParams: { launch_type: "provider-ehr" },
                        redirect_uri: "http://localhost",
                        response_type: "code",
                        aud: "http://localhost",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_request")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal(
                        `Bad audience value "http://localhost". Expected "${LAUNCHER.baseUrl}/v/${fhirVersion}/fhir".`
                    )
                });

                /**
                 * If set, the `code_challenge_method` parameter must be "S256". Otherwise we
                 * should get back an `invalid_request` OAuth error with descriptive message
                 */
                it (`asserts that the code_challenge_method param equals 'S256' if set`, async () => {
                    const res = await launch({
                        launchParams         : { launch_type: "provider-ehr"},
                        redirect_uri         : "http://localhost",
                        response_type        : "code",
                        code_challenge_method: "whatever",
                        requestOptions       : { method },
                        fhirVersion
                    });
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_request")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal(
                        "Invalid code_challenge_method. Must be S256."
                    )
                });

                /**
                 * If the `code_challenge_method` is sent, then the `code_challenge` parameter
                 * is requires, or we should get back an `invalid_request` OAuth error with descriptive message
                 */
                it (`asserts that code_challenge is set if code_challenge_method param is set`, async () => {
                    const res = await launch({
                        launchParams         : { launch_type: "provider-ehr" },
                        redirect_uri         : "http://localhost",
                        response_type        : "code",
                        code_challenge_method: "S256",
                        requestOptions       : { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_request")
                    expect(redirectUrl.searchParams.get("error_description")).to.equal(
                        "Missing code_challenge parameter"
                    )
                });

                /**
                 * Even if the request and all its parameters are valid, the user can cancel the launch
                 * and we should get back an `invalid_request` OAuth error with "Unauthorized" message
                 */
                it (`replies with Unauthorized oauth error if user rejects the launch`, async () => {
                    const res = await launch({
                        launchParams: {
                            launch_type: "provider-ehr"
                        },
                        auth_success  : "0",
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        state         : "abcd",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.status).to.equal(401)
                    const json = await  res.json()
                    expect(json.error).to.equal("invalid_request")
                    expect(json.error_description).to.equal("Unauthorized")
                });

                /**
                 * If the request and all its parameters are valid requests to the redirect uri
                 */
                it (`redirects valid requests to the redirect uri`, async () => {
                    const res = await launch({
                        launchParams: {
                            launch_type: "provider-ehr"
                        },
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        state         : "abcd",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error"), "error parameter must not be present (in the redirect URL)").to.not.exist
                    expect(redirectUrl.searchParams.get("error_description"), "error_description parameter must not be present (in the redirect URL)").to.not.exist
                    expect(redirectUrl.searchParams.get("code"), "code parameter must be present (in the redirect URL)").to.exist
                    expect(redirectUrl.searchParams.get("state"), "state parameter must be 'abcd' (in the redirect URL)").to.exist
                });

                /**
                 * Pre-selected patients are set in the `patient` property of the launch sim
                 * parameter (or url segment). If `patient` is set there, and if it is not
                 * a comma-separated list of multiple IDs, then no redirect to `/select-patient`
                 * should be made.
                 */
                it (`does not ask for patient if one is pre-selected`, async () => {
                    const res = await launch({
                        launchParams  : { launch_type: "provider-ehr", patient: "some-patient-id" },
                        scope         : "launch/patient",
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        state         : "abcd",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.pathname).to.not.equal("/select-patient")
                });

                /**
                 * After a patient is selected via the patient picker we should be redirected
                 * back with a `patient` parameter set to the selected patient's ID. In this
                 * case, verify that this ID is "remembered" and we are no longer redirected
                 * to `/select-patient`.
                 */
                it (`remembers the patient selected with the patient picker`, async () => {
                    const res = await launch({
                        launchParams  : { launch_type: "provider-ehr" },
                        scope         : "launch/patient",
                        patient       : "some-patient-id",
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        state         : "abcd",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.pathname).to.not.equal("/select-patient")
                });

                /**
                 * Providers are asked to login, even if a single provider is pre-selected,
                 * unless the `skip_login` property of the launch params is set to `true`.
                 * If a single provider is pre-selected and skip_login is true, verify that
                 * we are NOT redirected to /provider-login
                 */
                it (`does not ask for provider if one is pre-selected`, async () => {
                    const res = await launch({
                            launchParams: {
                                launch_type: "provider-standalone",
                                provider   : "some-provider-id",
                                skip_login : true
                            },
                            scope         : "launch/patient openid fhirUser",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            state         : "abcd",
                            requestOptions: { method },
                            fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                    expect(redirectUrl.pathname).to.not.equal("/provider-login")
                });

                /**
                 * After a provider is selected via the provider login page we should be
                 * redirected back with a `provider` parameter set to the selected provider's ID.
                 * In this case, verify that this ID is "remembered" and we are no longer
                 * redirected to `/provider-login`.
                 */
                it (`remembers the provider after login`, async () => {
                    const res = await launch({
                        launchParams  : { launch_type: "provider-standalone", skip_login: true },
                        scope         : "launch/patient openid fhirUser",
                        provider      : "some-provider-id",
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        state         : "abcd",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                    expect(redirectUrl.pathname).to.not.equal("/provider-login")
                });

                /**
                 * If a `login_success` url parameter is passed (and single provider is pre-selected)
                 * do NOT redirect to `/provider-login`
                 */
                it (`does not ask for login if already logged`, async () => {
                    const res = await launch({
                        launchParams  : { launch_type: "provider-standalone", provider: "some-provider-id" },
                        scope         : "launch/patient openid fhirUser",
                        login_success : true,
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        state         : "abcd",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                    expect(redirectUrl.pathname).to.not.equal("/provider-login")
                });

                /**
                 * It shouldn't even be possible to make a request with invalid launch type
                 * via the UI but in case someone tries to trick us, make sure a proper error
                 * is returned.
                 */
                it ("replies with an error for unknown launch types", async () => {
                    const res = await launch({
                        launchParams: {
                            // @ts-ignore
                            launch_type: "bad-launch"
                        },
                        scope         : "launch/patient",
                        patient       : "p1",
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        requestOptions: { method },
                        ignoreErrors  : true,
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error")).to.equal("invalid_request")
                    expect(redirectUrl.searchParams.get("error_description")).to.include("Error: Invalid launch type")
                });

                /**
                 * Some errors might have to be simulated while this request is handled but
                 * others are supposed to be handled later, thus they are added to the code
                 * token so that we keep them for later.
                 */
                it (`passes through the auth_error to the auth code`, async () => {
                    const res = await launch({
                        launchParams: {
                            launch_type: "provider-standalone",
                            provider: "some-provider-id",
                            patient: "p1",
                            skip_auth: true,
                            // @ts-ignore
                            auth_error: "this is a test error id"
                        },
                        scope         : "launch/patient openid fhirUser",
                        login_success : true,
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                    expect(parseResponseCode(redirectUrl.searchParams.get("code") || "").auth_error).to.equal('this is a test error id')
                });

                /**
                 * If client_secret is set in the UI, make sure it is added to
                 * the code token so that it can be used for validation later
                 */
                it (`passes client_secret through to the auth code`, async () => {
                    
                    const res = await launch({
                        launchParams: {
                            launch_type  : "provider-standalone",
                            provider     : "some-provider-id",
                            patient      : "p1",
                            skip_auth    : true,
                            client_secret: "test-secret"
                        },
                        scope         : "launch/patient openid fhirUser",
                        login_success : true,
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                    expect(parseResponseCode(redirectUrl.searchParams.get("code") || "").client_secret).to.equal('test-secret')
                });

                /**
                 * Verify that the selected encounter is added to the context object of the
                 * code token
                 */
                it (`passes encounter through to the auth code`, async () => {
                    const res = await launch({
                        launchParams: {
                            launch_type: "provider-ehr",
                            provider: "p",
                            patient: "p",
                            encounter: "e",
                            skip_auth: true
                        },
                        scope         : "launch/patient launch/encounter openid fhirUser",
                        login_success : true,
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        requestOptions: { method },
                        fhirVersion
                    });
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(parseResponseCode(redirectUrl.searchParams.get("code") || "").context.encounter).to.equal('e')
                });

                /**
                 * Verify that the selected user is added to the code token
                 */
                it (`passes user through to the auth code`, async () => {
                    const res = await launch({
                        launchParams: {
                            launch_type: "patient-standalone",
                            patient: "p",
                            encounter: "e",
                            skip_auth: true
                        },
                        scope         : "launch/patient openid fhirUser",
                        login_success : true,
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                    expect(parseResponseCode(redirectUrl.searchParams.get("code") || "").user).to.equal('Patient/p')
                });

                /**
                 * Verify that the selected user is added to the code token
                 */
                it (`passes code_challenge_method and code_challenge through to the auth code`, async () => {
                    const res = await launch({
                        launchParams: {
                            launch_type: "patient-standalone",
                            patient    : "p",
                            encounter  : "e",
                            skip_auth  : true
                        },
                        scope         : "launch/patient openid fhirUser",
                        login_success : true,
                        code_challenge_method: "S256",
                        code_challenge: "whatever",
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                    const code = parseResponseCode(redirectUrl.searchParams.get("code") || "")
                    expect(code).to.exist
                    expect(code.user).to.equal('Patient/p')
                    expect(code.code_challenge_method).to.equal('S256')
                    expect(code.code_challenge).to.equal('whatever')
                });

                /**
                 * Verify that the jwks_url is added to the code token
                 */
                it (`passes jwks_url through to the auth code`, async () => {
                    const res = await launch({
                        launchParams: {
                            launch_type: "patient-standalone",
                            patient: "p",
                            encounter: "e",
                            skip_auth: true,
                            jwks_url: "http://whatever"
                        },
                        scope         : "launch/patient openid fhirUser",
                        login_success : true,
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                    expect(parseResponseCode(redirectUrl.searchParams.get("code") || "").jwks_url).to.equal('http://whatever')
                });

                /**
                 * Verify that the jwks is added to the code token
                 */
                it (`passes jwks through to the auth code`, async () => {
                    const res = await launch({
                        launchParams: {
                            launch_type: "patient-standalone",
                            patient: "p",
                            encounter: "e",
                            skip_auth: true,
                            jwks: "whatever"
                        },
                        scope         : "launch/patient openid fhirUser",
                        login_success : true,
                        redirect_uri  : "http://localhost",
                        response_type : "code",
                        requestOptions: { method },
                        fhirVersion
                    })
                    expect(res.ok).to.equal(false)
                    expect(res.status).to.equal(302)
                    const redirectUrl = new URL(res.headers.get("location") || "")
                    expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                    expect(parseResponseCode(redirectUrl.searchParams.get("code") || "").jwks).to.equal('whatever')
                });

                describe("provider-ehr launch", () => {
                    it (`redirects to patient picker if no single patient is selected and launch/patient is requested`, async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "provider-ehr" },
                            scope         : "launch/patient",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.pathname).to.equal("/select-patient")
                    })
                })

                describe("patient-portal launch", () => {
                    it (`redirects to patient login if no patients are selected`, async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "patient-portal" },
                            scope         : "launch/patient",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.pathname).to.equal("/patient-login")
                    });

                    it (`redirects to patient login if multiple patients are selected`, async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "patient-portal", patient: "p1,p2" },
                            scope         : "launch/patient",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.pathname).to.equal("/patient-login")
                    });

                    it (`skips the patient login if skip_login is set`, async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "patient-portal", patient: "p1", skip_login: true },
                            scope         : "launch/patient",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.equal("/authorize-app")
                    });
                    
                    it (`redirects to encounter picker if needed`, async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "patient-portal", patient: "p1", skip_login: true },
                            scope         : "launch/patient launch/encounter",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.pathname).to.equal("/select-encounter")
                    });
                })

                describe("provider-standalone launch", () => {

                    it (`redirects to patient picker if no single patient is selected and launch/patient is requested`, async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "provider-standalone" },
                            scope         : "launch/patient",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.equal("/select-patient")
                    });

                    it (`redirects to provider login if no providers are selected`, async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "provider-standalone", patient: "pt" },
                            scope         : "launch/patient openid fhirUser",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.equal("/provider-login")
                    });
                    
                    it (`redirects to provider login if multiple providers are selected`, async () => {
                        const res = await launch({
                            launchParams: {
                                launch_type: "provider-standalone",
                                patient: "pt",
                                provider: "prov1,prov2"
                            },
                            scope         : "launch/patient openid fhirUser",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.equal("/provider-login")
                    });

                    it (`skips provider login if no openid scope is requested`, async () => {
                        const res = await launch({
                            launchParams: {
                                launch_type: "provider-standalone",
                                patient    : "pt",
                                provider   : "prov1,prov2",
                                skip_auth  : true
                            },
                            scope         : "launch/patient fhirUser",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.equal("/")
                    });

                    it ("skips provider login if no profile or fhirUser scope is requested", async () => {
                        const res = await launch({
                            launchParams: {
                                launch_type: "provider-standalone",
                                patient: "pt",
                                provider: "prov1,prov2",
                                skip_auth: true
                            },
                            scope         : "launch/patient openid",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.equal("/")
                    })

                    it ("skips provider login if one provider is selected and skip_login is set", async () => {
                        const res = await launch({
                            launchParams: {
                                launch_type: "provider-standalone",
                                patient: "pt",
                                provider: "prov1",
                                skip_login: true,
                                skip_auth: true
                            },
                            scope         : "launch/patient openid fhirUser",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.equal("/")
                    })

                    it ("redirects to encounter picker if needed", async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "provider-standalone", patient: "p1", skip_login: true },
                            scope         : "launch/patient launch/encounter",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.equal("/select-encounter")
                    })

                    it ("skips encounter picker if encounter is pre-selected", async () => {
                        const res = await launch({
                            launchParams: { launch_type: "provider-standalone", patient: "p1", skip_login: true },
                            scope: "launch/patient launch/encounter",
                            encounter: "x",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).not.to.equal("/select-encounter")
                    })
                })

                describe("patient-standalone launch", () => {
                    it ("redirects to patient login if no patients are selected", async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "patient-standalone" },
                            scope         : "launch/patient",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.equal("/patient-login")
                    })

                    it ("redirects to patient login if multiple patients are selected", async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "patient-standalone", patient: "p1,p2" },
                            scope         : "launch/patient",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.equal("/patient-login")
                    })

                    it ("skips the patient login if skip_login is set", async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "patient-standalone", patient: "p1", skip_login: true },
                            scope         : "launch/patient",
                            redirect_uri  : "http://localhost",
                            auth_success  : true,
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.not.equal("/authorize-app")
                    })

                    it ("does not redirect to the patient picker", async () => {
                        const res = await launch({
                            launchParams  : { launch_type: "patient-standalone", skip_login: true },
                            scope         : "launch/patient",
                            patient       : "p1",
                            redirect_uri  : "http://localhost",
                            response_type : "code",
                            requestOptions: { method },
                            fhirVersion
                        })
                        expect(res.ok).to.equal(false)
                        expect(res.status).to.equal(302)
                        const redirectUrl = new URL(res.headers.get("location") || "")
                        expect(redirectUrl.searchParams.get("error_description") || "").to.equal("")
                        expect(redirectUrl.pathname).to.not.equal("/select-patient")
                    })
                });
            });
        });
    });
});
