import { Request, Response, NextFunction } from "express"
import { HttpError } from "./errors";
// import { HTTPError, operationOutcome } = from "./lib"



// const handleParseError = function(err, req, res, next) {
//     if (err instanceof SyntaxError && err.status === 400) {
//         return lib.operationOutcome(
//             res,
//             `Failed to parse JSON content, error was: ${err.message}`,
//             { httpCode: 400 }
//         );
//     }
//     next(err, req, res);
// }

// HTTP to HTTPS redirect (this is Heroku-specific!)
// app.use((req, res, next) => {
//     let proto = req.headers["x-forwarded-proto"];
//     let host  = req.headers.host;
//     if (proto && (`${proto}://${host}` !== config.baseUrl)) { 
//         return res.redirect(301, config.baseUrl + req.url);
//     }
//     next();
// });


export function ipBlackList(ipList: string) {
    const list = String(ipList || "").trim().split(/\s*,\s*/);

    return function(req: Request, res: Response, next: NextFunction) {
        if (!list.length) {
            return next()
        }

        let ip = req.headers["x-forwarded-for"] + "";
        if (ip) {
            ip = ip.split(",").pop() + "";
        }
        else {
            ip = req.socket.remoteAddress || "";
        }

        if (ip && list.includes(ip)) {
            res.status(403).end("Forbidden!");
        }
        else {
            next();
        }
    }
}

/**
 * Global error 500 handler
 */
export function globalErrorHandler(error: any, req: Request, res: Response, next: NextFunction)
{
    
    if (error instanceof HttpError) {
        return error.render(req, res)
    }

    /* istanbul ignore next */
    console.error(error);
    /* istanbul ignore next */
    res.status(error.code || 500).json({ error: error.message || 'Internal Server Error' });
}
