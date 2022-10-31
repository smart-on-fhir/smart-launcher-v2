import { Router, text }         from "express"
import getWellKnownSmartConfig  from "./.well-known/smart-configuration"
import getWellKnownOpenidConfig from "./.well-known/openid-configuration"
import getCapabilityStatement   from "./metadata"
import fhirProxy                from "./proxy"
import { asyncRouteWrap }       from "../../lib"


const router = Router({ mergeParams: true })

router.get("/.well-known/smart-configuration" , getWellKnownSmartConfig)
router.get("/.well-known/openid-configuration", getWellKnownOpenidConfig)
router.get("/metadata", asyncRouteWrap(getCapabilityStatement))
router.use("/", text({ type: "*/*", limit: 1e6 }), asyncRouteWrap(fhirProxy))

export default router
