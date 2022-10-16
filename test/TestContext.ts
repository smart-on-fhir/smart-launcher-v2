import "mocha"
import { AddressInfo, Server } from "net"
import MockServer              from "./MockServer"
import launcher                from "../backend/index"
import config                  from "../backend/config"


export const FHIR_SERVER_R2: MockServer   = new MockServer("R2 FHIR Server");
export const FHIR_SERVER_R3: MockServer   = new MockServer("R3 FHIR Server");
export const FHIR_SERVER_R4: MockServer   = new MockServer("R4 FHIR Server");


let launcherServer: Server | null

export const LAUNCHER = {
    baseUrl: "",
    start() {
        return new Promise(resolve => {
            launcherServer = launcher.listen(0, "localhost", () => {
                const address = launcherServer!.address() as AddressInfo
                this.baseUrl = "http://localhost:" + address.port
                console.log(`Launcher listening at ${this.baseUrl}`)
                resolve(this)
            })
        })
    },
    stop() {
        return new Promise((resolve, reject) => {
            if (launcherServer && launcherServer.listening) {
                launcherServer.close((error?: Error) => {
                    if (error) {
                        reject(error)
                    } else {
                        console.log(`Launcher stopped`)
                        resolve(this)
                    }
                })
            } else {
                resolve(this)
            }
        })
    }
};

let _orig_fhirServerR2 = config.fhirServerR2
let _orig_fhirServerR3 = config.fhirServerR3
let _orig_fhirServerR4 = config.fhirServerR4

before(async () => {
    await FHIR_SERVER_R2.start()
    await FHIR_SERVER_R3.start()
    await FHIR_SERVER_R4.start()
    await LAUNCHER      .start()
    config.fhirServerR2 = FHIR_SERVER_R2.baseUrl
    config.fhirServerR3 = FHIR_SERVER_R3.baseUrl
    config.fhirServerR4 = FHIR_SERVER_R4.baseUrl
});

after(async () => {
    await FHIR_SERVER_R2.stop()
    await FHIR_SERVER_R3.stop()
    await FHIR_SERVER_R4.stop()
    await LAUNCHER      .stop()
    config.fhirServerR2 = _orig_fhirServerR2
    config.fhirServerR3 = _orig_fhirServerR3
    config.fhirServerR4 = _orig_fhirServerR4
});

beforeEach(async () => {
    FHIR_SERVER_R2.clear()
    FHIR_SERVER_R3.clear()
    FHIR_SERVER_R4.clear()
})

export const FHIR_VERSIONS: [string, MockServer][] = [
    ["r2", FHIR_SERVER_R2],
    ["r3", FHIR_SERVER_R3],
    ["r4", FHIR_SERVER_R4]
];


