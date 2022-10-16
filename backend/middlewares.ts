import { Request, Response, NextFunction } from "express"
import { HttpError } from "./errors";
// import { HTTPError, operationOutcome } = from "./lib"


// function rejectXml(req, res, next) {
//     if (
//         // !req.accepts("json") ||
//         // (req.headers.accept && req.headers.accept.indexOf("xml") != -1) || 
//         (req.headers['content-type'] && req.headers['content-type'].indexOf("xml") != -1) ||
//         /_format=.*xml/i.test(req.url)
//     ) {
//         return operationOutcome(res, "XML format is not supported", { httpCode: 400 });
//     }
//     next()
// }

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

/**
 * 
 * @param {string} ipList 
 */
// function blackList(ipList) {
//     const list = String(ipList || "").trim().split(/\s*,\s*/);

//     return function(req, res, next) {
//         if (!list.length) {
//             return next()
//         }

//         let ip = req.headers["x-forwarded-for"] + "";
//         if (ip) {
//             ip = ip.split(",").pop() + "";
//         }
//         else {
//             ip = req.connection.remoteAddress;
//         }

//         if (ip && list.indexOf(ip) > -1) {
//             res.status(403).end(
//                 `Your IP (${ip}) cannot access this service. ` +
//                 `To find out more, please contact us at launch@smarthealthit.org.`
//             );
//         }
//         else {
//             next();
//         }
//     }
// }

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
