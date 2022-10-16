import { useState } from "react"


export default function Clip({ txt = "", max = 200 }: { txt?: string, max?: number }) {
    
    const [expanded, setExpanded] = useState(false)
    
    if (txt.length <= max)  {
        return <span>{ txt }</span>
    }

    return (
        <span className="clip">
            <span>{ expanded ? txt : txt.substring(0, max) + "..." }</span>
            <b className="text-info small" style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                onClick={() => setExpanded(!expanded)}>
                <i> { expanded ? "Show less": "Show more" }</i>
            </b>
        </span>
    )
}
