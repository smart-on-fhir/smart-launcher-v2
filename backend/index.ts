import Path            from "path"
import FS              from "fs"
import express         from "express"
import cors            from "cors"
import jose            from "node-jose"
import jwt             from "jsonwebtoken"
import { AddressInfo } from "net"
import config          from "./config"
import fhirServer      from "./routes/fhir"
import authServer      from "./routes/auth"
import launcher        from "./routes/launcher"
import pkg             from "../package.json"
import { globalErrorHandler, ipBlackList } from "./middlewares"

export let customisedFhirServerR4 = ""


const app = express()

app.use(express.json());

// CORS everywhere :)
app.use(cors({ origin: true, credentials: true }))

// Block some IPs
app.use(ipBlackList(process.env.IP_BLACK_LIST || ""));

app.get("/smart-style.json", (_, res) => {
    res.json({
        color_background    : "#edeae3",
        color_error         : "#9e2d2d",
        color_highlight     : "#69b5ce",
        color_modal_backdrop: "",
        color_success       : "#498e49",
        color_text          : "#303030",
        dim_border_radius   : "6px",
        dim_font_size       : "13px",
        dim_spacing_size    : "20px",
        font_family_body    : "Georgia, Times, 'Times New Roman', serif",
        font_family_heading : "'HelveticaNeue-Light', Helvetica, Arial, 'Lucida Grande', sans-serif;"
    })
})

// Auth server
app.use(["/v/:fhir_release/sim/:sim/auth", "/v/:fhir_release/auth"], authServer)

// FHIR servers
app.use(["/v/:fhir_release/sim/:sim/fhir", "/v/:fhir_release/fhir"], fhirServer)

// The launcher endpoint
app.get("/launcher", launcher);

// Host public keys for backend services JWKS auth
app.get("/keys", async (_, res) => {
    const key = await jose.JWK.asKey(config.privateKeyAsPem, "pem", { alg: "RS256", key_ops: ["verify"] })
    res.json(key.keystore.toJSON(false));
});

// Also host the public key as PEM
app.get("/public_key", (_, res) => {
    FS.readFile(__dirname + "/../public-key.pem", "utf8", (err, key) => {
        if (err) {
            return res.status(500).end("Failed to read public key");
        }
        res.type("text").send(key);
    });
});


/*
  * The following endpoints are used to switch between different source FHIR servers without redeploying.
  * It is now switched off to reduce complexity, and was only implemented as a temporary solution so it might have bugs.
  * If anyone comes across this code and thinks it is useful, please feel free to create an issue on the GitHub repository, I'll look into re-enabling it.
 */

// app.post("/endpoint_switch", (req, res) => {
//     if (req.body && req.body.url) {
//         // Extract the "url" property from the request body
//         const { url } = req.body;
//
//         if (!isValidURL(url)) {
//             res.status(400).json({ error: 'Invalid request, "url" is not a valid URL.' });
//             return
//         }
//
//         customisedFhirServerR4 = url;
//         res.status(200).json({ message: 'R4 endpoint switched successfully' });
//         return
//     }
//
//     // If the request does not contain a "url" property, return an error response
//     res.status(400).json({ error: 'Invalid request, missing "url" property' });
//
// });
//
// app.get("/endpoint_reset", (_, res) => {
//     customisedFhirServerR4 = "";
//     res.status(200).json({ message: 'R4 endpoint reset successfully' })
// })
//
// app.get("/endpoint_switch", (_, res) => {
//     res.status(200).json({ url: customisedFhirServerR4 });
// })

// Provide some env variables to the frontend
app.use("/env.js", (_, res) => {
    const out = {
        NODE_ENV           : process.env.NODE_ENV      || "production",
        PICKER_ORIGIN      : process.env.PICKER_ORIGIN || "https://patient-browser.smarthealthit.org",
        GOOGLE_ANALYTICS_ID: process.env.GOOGLE_ANALYTICS_ID,
        FHIR_SERVER_R2     : config.fhirServerR2,
        FHIR_SERVER_R3     : config.fhirServerR3,
        FHIR_SERVER_R4     : config.fhirServerR4,
        ACCESS_TOKEN       : jwt.sign({ client_id: "launcherUI" }, config.jwtSecret, { expiresIn: "10 years" }),
        VERSION            : pkg.version,
        COMMIT             : process.env.SOURCE_VERSION
    };

    res.type("application/javascript").send(`var ENV = ${JSON.stringify(out, null, 4)};`);
});

// Handle all routes
app.get("*", (req, res) => {
    const fhirR4ServerUrl = req.protocol + '://' + req.get('host') + '/v/r4/fhir';

    res.send(
  `This service is healthy, but this route does not exist (Something might have went wrong!).\nTo access the R4 server, visit ${fhirR4ServerUrl}.\nThis server is currently proxying the following FHIR servers:\nR2: ${config.fhirServerR2}\nR3: ${config.fhirServerR3}\nR4: ${config.fhirServerR4}`
)});

// Catch all errors
app.use(globalErrorHandler)

// Start the server if ran directly (tests import it and start it manually)
/* istanbul ignore if */
if (require.main?.filename === __filename) {
    const server = app.listen(+config.port, config.host, () => {
        const address = server.address() as AddressInfo
        console.log(`SMART launcher available at http://${address.address}:${address.port}`)
    });

    if (process.env.SSL_PORT) {
        require('pem').createCertificate({
            days: 100,
            selfSigned: true
        }, (err: Error, keys: any) => {
            if (err) {
                throw err
            }
            require("https").createServer({
                key : keys.serviceKey,
                cert: keys.certificate
            }, app).listen(process.env.SSL_PORT, config.host, () => {
                const address = server.address() as AddressInfo
                console.log(`SMART launcher available at https://${address.address}:${address.port}`)
            });
        });
    }
}

export default app
