import React               from "react"
import { useSearchParams } from "react-router-dom"
import "./style.css"


export default function AuthorizeLaunch() {

    let [searchParams] = useSearchParams();

    const scopes    = searchParams.get("scope") + ""
    const isPatient = searchParams.get("login_type") !== "provider"

    let read  : string[] = [];
    let write : string[] = [];
    let access: string[] = [];
    let other : string[] = [];

    const _scopes = String(scopes || "").trim().split(/\s+/);
    
    if (_scopes.includes("offline_access") && _scopes.includes("online_access")) {
        access.push(
            "You have requested both <code>offline_access</code> and <code>online_access</code> scopes. " +
            "Please make sure you only use one of them."
        );
    }

    if (_scopes.includes("launch")) {

        if (_scopes.includes("launch/Patient")) {
            access.push(
                "You have requested both <code>launch</code> and <code>launch/Patient</code> scopes. " +
                "You probably only need to use one of them. The <code>launch</code> scope is used " +
                "in the EHR launch flow while <code>launch/Patient</code> is for the standalone flow."
            )
        }

        if (_scopes.includes("launch/Encounter")) {
            access.push(
                "You have requested both <code>launch</code> and <code>launch/Encounter</code> scopes. " +
                "You probably only need to use one of them. The <code>launch</code> scope is used " +
                "in the EHR launch flow while <code>launch/Encounter</code> is for the standalone flow."
            )
        }
    }

    _scopes.forEach(scope => {
        var permissions = scopeToText(scope, isPatient);
        if (permissions.read) {
            read.push(permissions.read);
        }
        if (permissions.write) {
            write.push(permissions.write);
        }
        if (permissions.access) {
            access.push(permissions.access);
        }
        if (permissions.other) {
            other.push(permissions.other);
        }
        if (permissions.create) {
            write.push(permissions.create);
        }
        if (permissions.update) {
            write.push(permissions.update);
        }
        if (permissions.deletePermission) {
            other.push(permissions.deletePermission);
        }
        if (permissions.search) {
            other.push(permissions.search);
        }
    });

    read   = arrayToUnique(read)
    write  = arrayToUnique(write)
    access = arrayToUnique(access)
    other  = arrayToUnique(other)

    const readListItems  : React.ReactElement[] = []
    const writeListItems : React.ReactElement[] = []
    const otherListItems : React.ReactElement[] = []
    const accessListItems: React.ReactElement[] = []
    
    read.forEach(msg => {
        readListItems.push(
            <li key={readListItems.length}>
                <i className="glyphicon glyphicon-ok-sign text-success" /> { msg }
            </li>
        )
    })

    write.forEach(msg => {
        writeListItems.push(
            <li key={writeListItems.length}>
                <i className="glyphicon glyphicon-ok-sign text-warning" /> { msg }
            </li>
        )
    })

    other.forEach(msg => {
        otherListItems.push(
            <li key={otherListItems.length}>
                <i className="glyphicon glyphicon-ok-sign text-info" /> { msg }
            </li>
        )
    })
    
    if (!readListItems.length && !writeListItems.length && !otherListItems.length) {
        return <p><big>Do you want to launch this application?</big></p>
    }

    access.forEach(msg => {
        accessListItems.push(
            <li key={accessListItems.length} dangerouslySetInnerHTML={{ __html: msg }} />
        )
    })

    function submit(approve?: boolean) {
        const url = new URL(searchParams.get("aud")!.replace(/\/fhir$/, "/auth/authorize"))
        url.search = window.location.search
        url.searchParams.set("auth_success", approve ? "1" : "0")
        window.location.href = url.href;
    }

    return (
        <div className="container authorize-app">

            <div className="row">
                <div className="col-sm-10 col-sm-offset-1">
                    <h2 className="page-header">
                        <img src="/logo.png" alt="SMART Logo" height={28} style={{ margin: "-6px 10px 0 0" }} />
                        <span className="text-primary">Authorize App Launch</span>
                    </h2>
                </div>
            </div>

            <div className="row">
                <div className="col-xs-12 col-md-offset-1 col-md-10">
                    { accessListItems.length  > 0 && <div className="alert alert-warning access-alert">
                        <b className="glyphicon glyphicon-info-sign pull-left" style={{ margin: "7px -7px -7px 7px" }}/>
                        <ul id="access-note">{ accessListItems  }</ul>
                    </div> }
                    
                    <div className="panel-body">

                        { readListItems.length  > 0 && <>
                            <h4 className="read text-muted">
                                <b className="label label-success">Read</b> This application is requesting permission to read:
                            </h4>
                            <ul className="read">{ readListItems  }</ul>
                        </> }

                        { writeListItems.length  > 0 && <>
                            <h4 className="write text-muted">
                                <b className="label label-warning">Write</b> This application is requesting permission to write:
                            </h4>
                            <ul className="read">{ writeListItems  }</ul>
                        </> }

                        { otherListItems.length  > 0 && <>
                            <h4 className="other text-muted">
                                <b className="label label-info">Other</b> This application is requesting permission to:
                            </h4>
                            <ul className="other">{ otherListItems  }</ul>
                        </> }
                    </div>

                    <hr />
                    <div className="text-center">
                        <button type="button" className="btn btn-danger"  id="deny"    style={{ minWidth: "8em" }} onClick={() => submit(false)}>Deny</button> &nbsp;
                        <button type="button" className="btn btn-success" id="approve" style={{ minWidth: "8em" }} onClick={() => submit(true )}>Approve</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function arrayToUnique(array: any[]) {
    return array.reduce((prev, current) => {
        if (prev.indexOf(current) === -1) {
            prev.push(current);
        }
        return prev;
    }, []);
}

function scopeToText(scope: string, isPatient?: boolean) {
    const out = {
        read  : "",
        write : "",
        access: "",
        other : "",
        create: "",
        update: "",
        deletePermission: "",
        search: ""
    };

    if (scope === "smart/orchestrate_launch") {
        out.other = "Allow this application to launch other SMART applications.";
        return out;
    }

    if (scope === "profile" || scope === "fhirUser") {
        out.read = "Your profile information";
        return out;
    }

    if (scope === "launch") { 
        out.read = "All data about the selected patient and encounter";
        return out;
    }

    if (scope === "launch/patient") { 
        out.read = "All data about the selected patient";
        return out;
    }

    if (scope === "launch/encounter") {
        out.read = "All data about the selected encounter";
        return out;
    }

    if (scope === "online_access") {
        out.access = "The application will be able to access data while you are online " +
            "(<code>online access</code>) without having to be re-launched when its access token expires.";
        return out;
    }
    
    if (scope === "offline_access") {
        out.access = "The application will be able to access data until you revoke permission (<code>offline access</code>).";
        return out;
    }

    const scopeParts = scope.split(/[/.]/);

    if (scopeParts.length < 2) {
        return out;
    }

    if (scopeParts.length === 2 || scopeParts[2] === 'read' || scopeParts[2] === 'write' || scopeParts[2] === '*') {

        if (scopeParts[1].toLowerCase() === "patient")
            scopeParts[1] = "Demographic";

        var text;
        if (!isPatient) {
            text = (scopeParts[1] === "*") ? "All" : scopeParts[1];
            if (scopeParts[0] === "user") {
                text += " data you have access to in the EHR system";
            } else {
                text += " data on the current patient";
            }
        } else {
            if 	(scopeParts[1] === "*") {
                text = "Your medical information";
            } else {
                text = 'Your information of type "' + scopeParts[1] + '"';
            }
        }

        if (scopeParts[2] === "write" || scopeParts[2] === "*") {
            out.write = text;
        }

        if (scopeParts[2] === "read" || scopeParts[2] === "*") {
            out.read = text;
        }

        return out;
    }

    // var tags = "";

    // if (scopeParts[2].includes('?')) {
    //     var accessAndTags = scopeParts[2].split(/[?&]/);
    //     scopeParts[2] = accessAndTags[0];

    //     accessAndTags = scope.split(/[?&]/);
    //     tags = tagsToString(accessAndTags);
    // }

    // if (scopeParts[2].includes('c')) {
    //     out.create = `New <code>${scopeParts[1]}</code> records${tags}`;
    // }

    // if (scopeParts[2].includes('u')) {
    //     out.update = `Changes to existing <code>${scopeParts[1]}</code> records${tags}`;
    // }

    // if (scopeParts[2].includes('s')) {
    //     out.search = `Search for <code>${scopeParts[1]}</code> records${tags}`;
    // }

    // if (scopeParts[2].includes('r')) {
    //     out.read = `<code>${scopeParts[1]}</code> records${tags}`;
    // }

    // if (scopeParts[2].includes('d')) {
    //     out.delete = `Delete <code>${scopeParts[1]}</code> records${tags}`;
    // }

    return out;
}

