import { SMART } from "../"
import moment from "moment"
import { encode } from "./isomorphic/codec";
import Clip from "./components/Clip";

const RE_YEAR       = /\d{4}$/;
const RE_MONTH_YEAR = /\d{4}-d{2}$/;

type FHIRPerson = fhir2.Patient | fhir3.Patient | fhir4.Patient | fhir2.Practitioner | fhir3.Practitioner | fhir4.Practitioner


function toArray(x: any) {
    if (!Array.isArray(x)) {
        return [ x ];
    }
    return x;
}

export function humanName(human: FHIRPerson, separator = " "): string {
    let names = human.name || [];
    if (!Array.isArray(names)) {
        names = [ names ];
    }
    
    let name = names[0];
    
    if (!name) {
        name = { family: [ "No Name Listed" ] };
    }
    
    const prefix = toArray(name.prefix || "").filter(Boolean).join(" ")
    const given  = toArray(name.given  || "").filter(Boolean).join(" ")
    const family = toArray(name.family || "").filter(Boolean).join(" ")
    
    let out = [prefix, given, family].filter(Boolean).join(separator || " ");
    
    if (name.suffix) {
        out += ", " + name.suffix;
    }

    return out;
}

/**
 * 
 * @param dob 
 * @param deceased deceasedDateTime | deceasedBoolean
 * @returns 
 */
export function formatAge(patient: fhir2.Patient | fhir3.Patient | fhir4.Patient): string {

    let dob = patient.birthDate

    if (!dob || patient.deceasedBoolean) return "";
    
    // If deceasedDateTime exists, we have a death date so show age as
    // the range between date of birth and date of death.
    if (patient.deceasedDateTime)
        return moment.duration(moment(patient.deceasedDateTime).diff(moment(dob))).humanize()
        // return moment(deceasedDateTime).diff(moment(dob), 'years') + " (deceased)";

    //fix year or year-month style dates 
    if (RE_YEAR.test(dob))
        dob = dob + "-01";
    if (RE_MONTH_YEAR.test(dob))
        dob = dob + "-01"

    return moment(dob).fromNow(true)
        .replace("a ", "1 ")
        .replace(/minutes?/, "min");
}

const deferMap = new WeakMap();

export function defer(fn: () => void, delay = 0)
{
    const f = () => {
        fn()
        deferMap.delete(fn)
    };

    const ref = deferMap.get(fn);
    if (ref) {
        if (delay) {
            clearTimeout(ref)
        } else {
            cancelAnimationFrame(ref)
        }
    }

    deferMap.set(fn, delay === undefined ? requestAnimationFrame(f) : setTimeout(f, delay));
}

export function highlight(str: string, stringToFind = "") {
    if (!stringToFind) {
        return str
    }
    let temp  = str;
    let index = str.toLocaleLowerCase().indexOf(stringToFind.toLocaleLowerCase());
    while (index > -1) {
        const replacement = `<span class="search-match">${temp.substring(index, index + stringToFind.length)}</span>`;
        const endIndex = index + stringToFind.length;
        temp  = temp.substring(0, index) + replacement + temp.substring(endIndex);
        index = temp.toLocaleLowerCase().indexOf(stringToFind.toLocaleLowerCase(), index + replacement.length);
    }
    return temp;
}

export function createLaunchUrl(iss: string, params: SMART.LaunchParams) {
    const url = new URL(iss)
    url.searchParams.set("launch", encode(params))
    url.searchParams.set("iss"   , iss + "/auth/authorize" )
    return url.href
}

export function renderBoolean(x: boolean) {
    return <b className="text-primary">{x + ""}</b>
}

export function renderUrl(x: any) {
    return <span className="text-info">{x + ""}</span>
}

export function renderString(x: any, clip?: true | number) {
    if (clip === true) {
        return <span className="text-success"><Clip txt={x} /></span>
    }
    if (clip) {
        return <span className="text-success"><Clip txt={x} max={clip} /></span>
    }
    return <span className="text-success">{x}</span>
}

export function renderNumber(x: any) {
    return <span className="text-danger">{x + ""}</span>
}

export function renderCodeList(x: string | string[]) {
    if (!Array.isArray(x)) {
        x = x.split(/[\s,]+/)
    }
    return <> {x.map((f, i) => (
        <span key={i}>
            { i > 0 ? ", " : "" }
            <code>{f}</code>
        </span>
    ))}</>
}

export function arrayToUnique(a: any[]) {
    return a.reduce((prev, cur) => {
        if (!prev.includes(cur)) {
            prev.push(cur);
        }
        return prev;
    }, [])
}

export function copyElement(selector: string) {
    const el = document.querySelector<HTMLInputElement>(selector);
    if (el && el.focus && el.select) {
        el.focus();
        el.select();
        document.execCommand('copy');
    }
}

export function pick(obj: Record<string, any>, keys: string[]) {
    const out: Record<string, any> = {}
    keys.forEach(key => out[key] = obj[key])
    return out
}

export function omit(obj: Record<string, any>, keys: string[]) {
    const out: Record<string, any> = {}
    for (const key in obj) {
        if (!keys.includes(key)) out[key] = obj[key]
    }
    return out
}
