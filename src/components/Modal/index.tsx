import { useEffect, useMemo } from "react"
import ReactDOM               from "react-dom"
import "./Modal.css"

const MODAL_ROOT_ID = "modal-root"


export default function Modal({ children, onClose }: { children: React.ReactNode, onClose?: () => void })
{
    const closeOnEscape = useMemo(() => (e: KeyboardEvent) => {
        if (onClose && e.key === "Escape") {
            onClose()
        }
    }, [])

    useEffect(() => {
        if (children && onClose) {
            window.addEventListener("keydown", closeOnEscape)
        }
        return () => window.removeEventListener("keydown", closeOnEscape)
    })

    return ReactDOM.createPortal(
        children,
        document.getElementById(MODAL_ROOT_ID)!
    );
}

