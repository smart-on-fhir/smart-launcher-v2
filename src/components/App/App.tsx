import { BrowserRouter, Route, Routes } from "react-router-dom"
import { useEffect }   from "react"
import Launcher        from "../Launcher"
import PatientPicker   from "../PatientPicker"
import EncounterPicker from "../EncounterPicker"
import SampleApp       from "../SampleApp"
import SampleAppLaunch from "../SampleApp/Launch"
import AuthorizeLaunch from "../AuthorizeLaunch"
import Login           from "../Login"
import EHR             from "../EHR"
import LaunchBS        from "../SampleApp/LaunchBS"
import "./App.css"

declare global {
    var dataLayer: any[]
    var gtag: (...args: any[]) => any
}
  

export default function App() {

    const { GOOGLE_ANALYTICS_ID, NODE_ENV } = window.ENV || {};

    useEffect(() => {
        if (GOOGLE_ANALYTICS_ID && NODE_ENV === "production") {
            const s = document.createElement("script");
            s.async = true
            s.src = "https://www.googletagmanager.com/gtag/js?id=" + GOOGLE_ANALYTICS_ID
            document.body.appendChild(s)
            window.dataLayer = window.dataLayer || [];
            window.gtag = function() {
                window.dataLayer.push(arguments);
            };
            window.gtag('js', new Date()); 
            window.gtag('config', window.ENV.GOOGLE_ANALYTICS_ID);
        }
    })

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/launcher"                     element={ <Launcher />        } />
                <Route path="/select-patient"       element={ <PatientPicker />   } />
                <Route path="/select-encounter"     element={ <EncounterPicker /> } />
                <Route path="/authorize-app"        element={ <AuthorizeLaunch /> } />
                <Route path="/patient-login"        element={ <Login /> } />
                <Route path="/provider-login"       element={ <Login /> } />
                <Route path="/ehr"                  element={ <EHR /> } />
                <Route path="/sample-app/launch"    element={ <SampleAppLaunch /> } />
                <Route path="/sample-app/launch-bs" element={ <LaunchBS /> } />
                <Route path="/sample-app"           element={ <SampleApp />       } />
                <Route path="/*"                    element={ <h2 className="text-center"><br/>Not Found</h2> } />
            </Routes>
        </BrowserRouter>
    );
}
