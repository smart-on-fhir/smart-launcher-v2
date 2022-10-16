
import { InputHTMLAttributes, useEffect, useState } from "react";
import { humanName } from "../../lib";
import "./UserPicker.css";

interface UserPickerProps {
    value?: string,
    fhirServerBaseUrl: string
    onChange: (list: string) => void
    limit?: number
    inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "value"|"onChange"|"className">
}

export default function UserPicker({
    value,
    onChange,
    limit,
    fhirServerBaseUrl,
    inputProps = {}
}: UserPickerProps)
{
    const [records, setRecords] = useState<fhir4.Practitioner[]>([]);

    useEffect(() => {
        const url = new URL("./Practitioner", fhirServerBaseUrl)

        if (limit) {
            url.searchParams.set("_count", limit + "")
        }

        fetch(url).then(res => res.json()).then(
            (bundle: fhir4.Bundle<fhir4.Practitioner>) => {
                if (!bundle.entry) {
                    console.error("No practitioners found")
                } else {
                    setRecords(bundle.entry!.map(p => p.resource!))
                }
            },
            e => console.error("No practitioners found. " + e)
        )
    }, [fhirServerBaseUrl, limit]);

    return (
        <div className="dropdown user-picker open">
            <input
                { ...inputProps }
                value={ value }
                onChange={ e => onChange(e.target.value) }
                className="form-control"
            />
            <UserPickerMenu selection={ value } records={records} onChange={list => onChange(list.join(","))} />
        </div>
    )
}

function UserPickerMenu({
    selection = "",
    records,
    onChange
}: {
    selection?: string,
    records: fhir4.Practitioner[]
    onChange: (list: string[]) => void
})
{
    const ids = selection.trim().split(/\s*,\s*/).filter(Boolean);

    const createToggleHandler = (id: string) => {
        return (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.checked) {
                if (!ids.includes(id)) {
                    ids.push(id)
                    onChange(ids)
                }
            }
            else {
                const index = ids.indexOf(id)
                if (index > -1) {
                    ids.splice(index, 1)
                    onChange(ids)
                }
            }
        }
    }
    
    if (!records.length) {
        return (
            <ul className="dropdown-menu" style={{
                minWidth: "100%",
                maxHeight: "50vh",
                overflow: "auto"
            }}>
                <li className="text-center text-danger">No Providers Found</li>
            </ul>
        )
    }

    return (
        <ul className="dropdown-menu">
            { records.map(r => (
                <UserPickerMenuItem
                    key={r.id}
                    provider={r}
                    selected={ids.includes(r.id!)}
                    onChange={createToggleHandler(r.id!)}
                />
            )) }
        </ul>
    )
}

function UserPickerMenuItem({
    provider,
    selected,
    onChange
}: {
    provider: fhir4.Practitioner
    selected: boolean
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
})
{
    return (
        <li className="picker-option">
            <label onFocusCapture={e => { e.preventDefault(); e.stopPropagation() }} onMouseDown={e => e.preventDefault()} htmlFor={ "provider-" + provider.id }>
                <div className="picker-option-left">
                    <input
                        id={ "provider-" + provider.id }
                        type="checkbox"
                        value={ provider.id  }
                        checked={ selected }
                        onChange={ onChange }
                    /> <b>&nbsp;{ humanName(provider) }</b>
                </div>
                <div className="text-muted picker-option-right">
                    <b>ID: </b>{provider.id}
                </div>
            </label>
        </li>
    );
}