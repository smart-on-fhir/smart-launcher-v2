import { NextFunction, Request, Response, Router } from "express"
import jose from "node-jose"

const router = Router({ mergeParams: true });

export default router;


router.get("/rsa", (req: Request, res: Response, next: NextFunction) => {
    jose.JWK.createKey("RSA", 2048, { alg: "RS384" }).then(key => {
        res.json({
            publicKey : key.toPEM(),
            privateKey: key.toPEM(true)
        })
    }, next)
});

router.get("/random", (req, res) => {
    const encodings = ["base64", "base64url", "binary", "hex", "utf8", "ascii"];
    
    let enc = String(req.query.enc || "hex");
    if (!encodings.includes(enc)) {
        enc = "hex"
    }
    
    let len = +(req.query.len || 32);
    if (isNaN(len) || !isFinite(len) || len < 1 || len > 1024) {
        len = 32;
    }

    res.set("content-type", "text/plain")
    res.end(jose.util.randomBytes(len).toString(enc as BufferEncoding))
});
