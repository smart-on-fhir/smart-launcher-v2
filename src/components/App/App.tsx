import { BrowserRouter, Route, Routes } from "react-router-dom"
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
import { useEffect } from "react"
  

export default function App() {

    useEffect(() => {
        if (window.ENV.GOOGLE_ANALYTICS_ID && window.ENV.NODE_ENV === "production") {
            const s = document.createElement("script");
            s.async = true
            s.src = "https://www.googletagmanager.com/gtag/js?id=" + window.ENV.GOOGLE_ANALYTICS_ID
            document.body.appendChild(s)
            // @ts-ignore
            window.dataLayer = window.dataLayer || [];
            // @ts-ignore
            // window.dataLayer.push(['js', new Date()], ['config', window.ENV.GOOGLE_ANALYTICS_ID])
            
            // @ts-ignore
            window.gtag = function() {
                // @ts-ignore
                window.dataLayer.push(arguments);
            };
            // @ts-ignore
            window.gtag('js', new Date()); 
            // @ts-ignore
            window.gtag('config', window.ENV.GOOGLE_ANALYTICS_ID);
            // console.log("here")
        }
    })

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/"                     element={ <Launcher />        } />
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
