import { oauth2 } from "fhirclient"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom";
import { decode } from "../../isomorphic/codec";


export default function SampleAppLaunch() {

    const [searchParams] = useSearchParams()

    const [error, setError] = useState()

    const launch = decode(searchParams.get("launch") || "")

    useEffect(() => {
        oauth2.authorize({
            clientId: launch.client_id || "whatever",
            redirectUri: "/sample-app",
            scope: "patient/*.* user/*.* launch launch/patient launch/encounter openid fhirUser profile offline_access",
            
            clientSecret: launch.client_type === "confidential-symmetric" ?
                launch.client_secret || undefined :
                undefined,
            
            pkceMode: launch.pkce === "none" ?
                "disabled" :
                launch.pkce === "auto" ?
                    "ifSupported" :
                    "required",
            
            clientPublicKeySetUrl: launch.client_type === "confidential-asymmetric" ?
                "https://www.hl7.org/fhir/smart-app-launch/RS384.public.json" :
                undefined,
            
            clientPrivateJwk: launch.client_type === "confidential-asymmetric" ? {
                "kty": "RSA",
                "alg": "RS384",
                "n": "wJq2RHIA-7RT6q4go7wjcbHdW7ck7Kz22A8wf-kN7Wi5CWvhFG2_Y7nQp1lDpb2IKMQr-Q4n_vgJ6d5rWPspJpSPY7iffUK4ipQCEbzID5DJ6fQMBZOfCTXyxkuMh3jYGKEF3Ziw2oxbM1H9j-eJAPtrj5stUG6kVoXowegdox-bSjWP0iI5PnkwUNzcekLMug4M3LRluEQgGR9O_BAML6-w3igZ_rZA_gunyrLAMbfmCVaceW5ohLp679kyM7U6W2gDK_NbkDKcINUakVmPeoG5h8RzgGzvGrySR0k0VDFiZv60Ua07DqHTeDGH9e4NV07AECae-oykIj5NDCs3pw",
                "e": "AQAB",
                "d": "O7k9v6eiSmq2gtUP5fXW_9BplaEK4CEaQhEjtuYrnWyVxCghmVYWvPPHkb0KTwCgkhOSlx4epN-BI3YGz4bCUeZLOF7thcgEtWQD6EAjwT_ifJtihvAppo-GAps2rmN4jtqPmRFZ9csEFLvd5pujThyoU9WIjaJhbzsC2-4AEq6WgCDsjdxJ9AXz379vUaoSFAk_ETMRnFSUP-dCJqi_yUrS5h2Tr6rosKP3I_93tt2p2wtOfIjaq7fYipXS7_daHh7hSehEcRHkHI3faaDKY0UwqJa4icHtbX8KgayP6NPUQ-Xv8GMIii3cksRqktDuODHgqGpfkOCii4loS0B-wQ",
                "p": "58yRMh3SBFkK0n9ulWDADANqXVGwozMHf9m5nh0sDFSy9v8dTCvTBbzP2wN4pP0cYhIrPYyeBm724lvp7FFzgIz7u2UUIU_Q2-x5VWPy97ZI-V5_eooC58y8DdNbi89D4TzsTJaraEhcqcFH2gI4R-RP01ViKDg2EOzYu2105xE",
                "q": "1LaQOiUsaGO7T7aIKgLxvLs7uEekqoSN3tl-ALZxO8RhUyRYjmtH51aKLq8bublqM3XoXBSA4TVm07qUBmWKfHCCz8QhorDFDVgVlEGUMcdmyBmoH5RaEMj4R19oG7C-emP3TFCfzjlnRELuP3v-HdEe6SxoADQwYzyAjduSYzc",
                "dp": "oIbQ_s4cBZrMnd5WbOil1yv-W0YZd8v9I5Nasp8tRBTcI6WlWnz3FQAfSmNrB4eqQlimzWc2gOoT28sfguMdhCcepjZn7HHkCIoJtRMUzmvUua2xxuERBgqJKWH4Aii1r6SLWLb3Wa7TTVRnOBlVdKQujAKTiZr0BmCf75zr2qE",
                "dq": "BJA-G-E8SKkLFbS2yx_xC7mAmH2A_N-HI6bK2z0OxNd7twrqk3OdwUrMACBlmeBudNgsufz-ntZEdHpmPpTjGbRYOhjdF95u-9BN9jZJ9Z9vhw912eeW3xFQskdLtnxeOcX3Qj3gj84PdxlwfxAr7XvVC--V85srBpX_tAtn4pU",
                "qi": "z24jzWhTRZ-x_zsH2wiSKmqg0wXOWO_BCnHA7lC6mMZCj-mQqY-PrZbrrii46ZoGxKWt12bnlHs5OCHtcwcuLrczXCyZPWImbG6Aqch7GVeChzBhdrnflUgt5Y1TmDLMrFmXUIZ2mSMbyN5xZZ4IwfoAq1fOLvXeQny4er2pyxo",
                "key_ops": [ "sign" ],
                "ext": true,
                "kid": "eee9f17a3b598fd86417a980b591fbe6"
            } : undefined

            // Public key:
            // -----------------------------------------------------------------
            // {
            //     "kty": "RSA",
            //     "alg": "RS384",
            //     "n": "wJq2RHIA-7RT6q4go7wjcbHdW7ck7Kz22A8wf-kN7Wi5CWvhFG2_Y7nQp1lDpb2IKMQr-Q4n_vgJ6d5rWPspJpSPY7iffUK4ipQCEbzID5DJ6fQMBZOfCTXyxkuMh3jYGKEF3Ziw2oxbM1H9j-eJAPtrj5stUG6kVoXowegdox-bSjWP0iI5PnkwUNzcekLMug4M3LRluEQgGR9O_BAML6-w3igZ_rZA_gunyrLAMbfmCVaceW5ohLp679kyM7U6W2gDK_NbkDKcINUakVmPeoG5h8RzgGzvGrySR0k0VDFiZv60Ua07DqHTeDGH9e4NV07AECae-oykIj5NDCs3pw",
            //     "e": "AQAB",
            //     "key_ops": [
            //         "verify"
            //     ],
            //     "ext": true,
            //     "kid": "eee9f17a3b598fd86417a980b591fbe6"
            // }
            // -----------------------------------------------------------------
        }).catch(setError)
    }, [launch])

    if (error) {
        console.dir(error)
    }

    return error ? 
        <div className="container">
            <br/>
            <h2 className="text-center">Error Launching Sample App</h2>
            <br/>
            <pre className="alert alert-danger">{ error + "" }</pre>
        </div> :
        <h2 className="text-center">Redirecting...</h2>
}