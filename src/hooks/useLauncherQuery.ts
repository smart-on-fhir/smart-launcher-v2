import { SMART }           from "../../"
import { useSearchParams } from "react-router-dom"
import { decode, encode }  from "../isomorphic/codec"


interface LauncherState extends Omit<Partial<LauncherQuery>, "launch">, SMART.LaunchParams {}

export interface LauncherQuery {
    launch_url  : string
    fhir_version: string
    tab         : string
    launch      : string
    jwks_tab    : string
    validation ?: string
}

const LauncherQueryDefaults: LauncherQuery = {
    fhir_version: "r4",
    launch_url  : "",
    tab         : "0",
    launch      : encode({ launch_type: "provider-ehr", client_type: "public", pkce: "auto" }),
    jwks_tab    : "0",
    validation  : "0"
}

/**
 * Uses the query string to store the state of the launcher page
 */
export default function useLauncherQuery(initialState: Partial<LauncherQuery> = {})
{
    let [searchParams, setSearchParams] = useSearchParams();

    const query: LauncherQuery = {
        ...LauncherQueryDefaults,
        ...initialState
    };

    searchParams.forEach((value, key) => {
        query[key as keyof LauncherQuery] = value
    });

    const launch: SMART.LaunchParams = decode(query.launch);

    // Properties that belong to the launch parameters are encoded into a
    // `launch` parameter. Everything else is store as normal query parameter.
    // `undefined` can be used to remove launch or query parameters.
    function setQuery(props: Partial<LauncherState>) {
        for (const name in props) {
            const value = props[name as keyof LauncherState]
            
            if (name in launch) {
                if (value === undefined) {
                    delete launch[name as keyof SMART.LaunchParams]
                } else {
                    (launch[name as keyof SMART.LaunchParams] as any) = value
                }
            }

            // everything else is store as normal query parameter
            else {
                if (value === undefined) {
                    searchParams.delete(name)
                } else {
                    searchParams.set(name, value + "");
                }
            }
        }
        
        searchParams.set("launch", encode(launch))
        setSearchParams(searchParams)
    }

    return { query, launch, setQuery }
}
