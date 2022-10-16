import express            from "express"
import introspect         from "./introspect"
import revoke             from "./revoke"
import manage             from "./manage"
import register           from "./register"
import TokenHandler       from "./token"
import AuthorizeHandler   from "./authorize"
import { asyncRouteWrap } from "../../lib"


const authServer = express.Router({ mergeParams: true })
const urlencoded = express.urlencoded({ extended: false, limit: "64kb" })


authServer.get ("/authorize" , asyncRouteWrap(AuthorizeHandler.handle))
authServer.post("/authorize" , urlencoded, asyncRouteWrap(AuthorizeHandler.handle))
authServer.post("/token"     , urlencoded, asyncRouteWrap(TokenHandler.handle))
authServer.post("/introspect", urlencoded, asyncRouteWrap(introspect))
authServer.post("/revoke"    , urlencoded, asyncRouteWrap(revoke))
authServer.post("/manage"    , urlencoded, asyncRouteWrap(manage))
authServer.post("/register"  , urlencoded, asyncRouteWrap(register))


export default authServer
