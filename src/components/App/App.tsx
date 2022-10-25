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
  

export default function App() {
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
