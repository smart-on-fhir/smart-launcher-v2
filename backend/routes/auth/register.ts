import { notSupported } from "../../lib"


export default notSupported()

// import { Request, Response } from "express"
// import jwt                   from "jsonwebtoken"
// import config                from "../../../config"
// import { OAuthError }        from "../../../errors"


// interface ClientToken {
//     iss: string
//     pub_key: string,
//     accessTokensExpireIn?: number
//     auth_error?: string
// }


// /**
//  * Dynamic registration endpoint for Backend Services. The UI will make a POST
//  * request giving the `iss`, `pub_key`, `dur` and `auth_error` and will get back
//  * a client_id which will be a jwt
//  */
// export default function handleRegistration(req: Request, res: Response) {
        
//     // Require "application/x-www-form-urlencoded" POSTs
//     if (!req.is("application/x-www-form-urlencoded")) {
//         throw new OAuthError(
//             "Invalid request content-type header (must be 'application/x-www-form-urlencoded')"
//         )
//         .errorId("invalid_request")
//         .status(400)
//     }

//     // parse and validate the "iss" parameter
//     let iss = String(req.body.iss || "").trim()
//     if (!iss) {
//         throw new OAuthError("Missing iss parameter").errorId("invalid_request").status(400)
//     }
    
//     // parse and validate the "pub_key" parameter
//     let publicKey = String(req.body.pub_key || "").trim()
//     if (!publicKey) {
//         throw new OAuthError("Missing pub_key parameter").errorId("invalid_request").status(400)
//     }

//     // parse and validate the "dur" parameter
//     let dur = parseInt(req.body.dur || "15", 10)
//     if (isNaN(dur) || !isFinite(dur) || dur < 0) {
//         throw new OAuthError("Invalid dur parameter").errorId("invalid_request").status(400)
//     }

//     // Build the result token
//     let jwtToken: ClientToken = {
//         pub_key: publicKey,
//         iss
//     }

//     // Note that if dur is 0 accessTokensExpireIn will not be included
//     if (dur) {
//         jwtToken.accessTokensExpireIn = dur
//     }

//     // Custom errors (if any)
//     if (req.body.auth_error) {
//         jwtToken.auth_error = req.body.auth_error
//     }

//     // Reply with signed token as text
//     res.type("text").send(jwt.sign(jwtToken, config.jwtSecret))
// }
