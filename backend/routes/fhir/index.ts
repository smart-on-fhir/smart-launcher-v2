import { Router, text }         from "express"
import getWellKnownSmartConfig  from "./.well-known/smart-configuration"
import getWellKnownOpenidConfig from "./.well-known/openid-configuration"
import getCapabilityStatement   from "./metadata"
import fhirProxy                from "./proxy"
import { asyncRouteWrap }       from "../../lib"


const router = Router({ mergeParams: true })

router.get("/.well-known/smart-configuration" , getWellKnownSmartConfig )
router.get("/.well-known/openid-configuration", getWellKnownOpenidConfig)
router.get("/metadata"                        , getCapabilityStatement  )

// Provide launch_id if the CDS Sandbox asks for it
// router.post("/_services/smart/launch", express.json(), (req, res) => {
//     res.json({
//         launch_id: base64url.encode(JSON.stringify({
//             context: req.body.parameters || {}
//         }))
//     });
// });

router.use("/", text({ type: "*/*", limit: 1e6 }), asyncRouteWrap(fhirProxy))

export default router
