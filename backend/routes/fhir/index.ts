import { Router, json, text }   from "express"
import getWellKnownSmartConfig  from "./.well-known/smart-configuration"
import getWellKnownOpenidConfig from "./.well-known/openid-configuration"
import getCapabilityStatement   from "./metadata"
import fhirProxy                from "./proxy"
import { asyncRouteWrap }       from "../../lib"


const router = Router({ mergeParams: true })

router.get("/.well-known/smart-configuration" , getWellKnownSmartConfig)
router.get("/.well-known/openid-configuration", getWellKnownOpenidConfig)
router.get("/metadata", asyncRouteWrap(getCapabilityStatement))


// Provide launch_id if the CDS Sandbox asks for it
router.post("/_services/smart/Launch", json(), (req, res) => {
    // {
    //     "launchUrl":"https://examples.smarthealthit.org/growth-chart-app/launch.html",
    //     "parameters":{
    //         "patient":"2e27c71e-30c8-4ceb-8c1c-5641e066c0a4",
    //         "smart_messaging_origin":"https://sandbox.cds-hooks.org",
    //         "appContext":"{\"patient\":\"099e7de7-c952-40e2-9b4e-0face78c9d80\",\"encounter\": \"1d3f33a3-5e0b-4508-8836-ecabcab2ff4c\"}"
    //     }
    // }
    res.json({
        launch_id: Buffer.from(JSON.stringify({
            context: req.body.parameters || {}
        }), "utf8").toString("base64")
    });
});

router.use("/", text({ type: "*/*", limit: 1e6 }), asyncRouteWrap(fhirProxy))

export default router
