import { Request, Response } from "express"
import { format }   from "node:util"

export class HttpError extends Error
{
    code = 400

    constructor(message: string, ...args: any[]) {
        super(format(message, ...args))
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }

    status(statusCode: number) {
        this.code = statusCode
        return this
    }

    render(req: Request, res: Response) {
        res.status(this.code).type("text").end(this.message)
    }
}

export class OAuthError extends HttpError
{
    id: string = "invalid_request"

    code = 302

    constructor(message: string, ...args: any[]) {
        super(message, ...args)
    }

    errorId(id: string) {
        this.id = id
        return this
    }

    render(req: Request, res: Response) {
        const redirectUri = req.body ?
            String(req.body.redirect_uri  || "") :
            String(req.query.redirect_uri || "");

        const isRedirectCode = [301, 302, 303, 307, 308].includes(this.code)

        if (redirectUri && isRedirectCode) {
            // console.log("%o", redirectUri)
            let redirectURL = new URL(redirectUri);
            redirectURL.searchParams.set("error", this.id);
            redirectURL.searchParams.set("error_description", this.message);
            if (req.query.state) {
                redirectURL.searchParams.set("state", req.query.state + "");
            }
            return res.redirect(this.code, redirectURL.href);
        }

        if (!redirectUri && isRedirectCode) {
            this.code = 400
        }

        return res.status(this.code).json({
            error: this.id,
            error_description: this.message
        });
    }
}

// export class InvalidParamError extends HttpError
// {
//     constructor(paramName: string, paramValue: string, ...args: any[]) {
//         super(`Invalid parameter value "%s" for parameter "%s"`, paramValue, paramName, ...args)
//     }
// }

// export class MissingParamError extends HttpError
// {
//     constructor(paramName: string, ...args: any[]) {
//         super(`Missing parameter "%s"`, paramName, ...args)
//     }
// }

export class InvalidRequestError extends OAuthError
{
    id = "invalid_request"
}

export class InvalidScopeError extends OAuthError
{
    id = "invalid_scope"
}

export class InvalidClientError extends OAuthError
{
    id = "invalid_client"
}
