import React               from "react"
import { useSearchParams } from "react-router-dom"
import "./style.css"


export default function AuthorizeLaunch() {

    let [searchParams] = useSearchParams();

    // openid fhirUser profile offline_access patient/Observation.cruds?category=vital-signs smart/orchestrate_launch launch launch/encounter launch/patient patient/Observation.rs?_security=L,N,R,V user/Encounter.* patient/Encounter.*
    const scopes = searchParams.get("scope") + ""
    const isPatient = searchParams.get("login_type") !== "provider"

    const _scopes = String(scopes || "").trim().split(/\s+/);

    const groups: Record<string, any[]> = {
        create: [],
        read  : [],
        update: [],
        delete: [],
        search: [],
        write : [],
        other : [],
        access: []
    };

    if (_scopes.includes("offline_access") && _scopes.includes("online_access")) {
        groups.access.push(
            "You have requested both <code>offline_access</code> and <code>online_access</code> scopes. " +
            "Please make sure you only use one of them."
        );
    }

    if (_scopes.includes("launch")) {

        if (_scopes.includes("launch/Patient")) {
            groups.access.push(
                "You have requested both <code>launch</code> and <code>launch/Patient</code> scopes. " +
                "You probably only need to use one of them. The <code>launch</code> scope is used " +
                "in the EHR launch flow while <code>launch/Patient</code> is for the standalone flow."
            )
        }

        if (_scopes.includes("launch/Encounter")) {
            groups.access.push(
                "You have requested both <code>launch</code> and <code>launch/Encounter</code> scopes. " +
                "You probably only need to use one of them. The <code>launch</code> scope is used " +
                "in the EHR launch flow while <code>launch/Encounter</code> is for the standalone flow."
            )
        }
    }

    _scopes.forEach(scope => {
        const permissions = scopeToText(scope, isPatient);
        if (permissions.read  ) groups.read.push  (permissions.read  );
        if (permissions.write ) groups.write.push (permissions.write );
        if (permissions.access) groups.access.push(permissions.access);
        if (permissions.other ) groups.other.push (permissions.other );
        if (permissions.create) groups.create.push(permissions.create);
        if (permissions.update) groups.update.push(permissions.update);
        if (permissions.delete) groups.delete.push(permissions.delete);
        if (permissions.search) groups.search.push(permissions.search);
    });

    for (const key in groups) {
        groups[key] = arrayToUnique(groups[key])
    }

    const listItems: React.ReactElement[] = [];

    ["read", "search", "create", "update", "delete", "write", "other"].forEach(key => {
        groups[key].forEach((msg, i) => {
            listItems.push(<li key={ key + "-" + i } dangerouslySetInnerHTML={{ __html: msg }} />)
        })
    });

    if (!listItems.length) {
        return <p><big>Do you want to launch this application? No useful scopes requested!</big></p>
    }

    function submit(approve?: boolean) {
        const url = new URL(searchParams.get("aud")!.replace(/\/fhir$/, "/auth/authorize"))
        url.search = window.location.search
        url.searchParams.set("auth_success", approve ? "1" : "0")
        window.location.href = url.href;
    }

    return (
        <div className="container authorize-app">
            <div className="row">
                <div className="col-xs-12 col-md-offset-1 col-md-10">
                    <h2 className="page-header">
                        <img src="/logo.png" alt="SMART Logo" height={28} style={{ margin: "-6px 10px 0 0" }} />
                        <span className="text-primary">Authorize App Launch</span>
                    </h2>
                </div>
            </div>
            <div className="row">
                <div className="col-xs-12 col-md-offset-1 col-md-10">
                    { groups.access.length > 0 && <div className="alert alert-warning access-alert">
                        <b className="glyphicon glyphicon-info-sign pull-left" style={{ margin: "7px -7px -7px 7px" }}/>
                        <ul id="access-note">{ groups.access.map((msg, i) => (<li key={i} dangerouslySetInnerHTML={{ __html: msg }} />)) }</ul>
                    </div> }
                    
                    <div className="panel-body">

                        <h4 className="other text-muted">This application is requesting permission to:</h4>
                        
                        <ul>{ listItems  }</ul>
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
        delete: "",
        search: ""
    };

    switch (scope) {
        case "smart/orchestrate_launch":
            return { ...out, other: '<i class="glyphicon glyphicon-ok-sign text-warning"></i>&nbsp;<b class="text-warning">Launch</b> other SMART applications' }
        case "profile":
        case "fhirUser":
            return { ...out, read: '<i class="glyphicon glyphicon-ok-sign text-success"></i>&nbsp;<b class="text-success">Read</b> our profile information' }
        case "launch":
            return { ...out, read: '<i class="glyphicon glyphicon-ok-sign text-success"></i>&nbsp;<b class="text-success">Read</b> all data about the selected patient and encounter' }
        case "launch/patient":
            return { ...out, read: '<i class="glyphicon glyphicon-ok-sign text-success"></i>&nbsp;<b class="text-success">Read</b> all data about the selected patient' }
        case "launch/encounter":
            return { ...out, read: '<i class="glyphicon glyphicon-ok-sign text-success"></i>&nbsp;<b class="text-success">Read</b> all data about the selected encounter' }
        case "online_access":
            return { ...out, access: 'The application will be able to access data while you are online (<code>online access</code>) without having to be re-launched when its access token expires.' }
        case "offline_access":
            return { ...out, access: "The application will be able to access data until you revoke permission (<code>offline access</code>)." }
    }
    
    const scopeParts = scope.split(/[/.]/);

    if (scopeParts.length < 2) {
        return out;
    }

    if (scopeParts.length === 2 || scopeParts[2] === 'read' || scopeParts[2] === 'write' || scopeParts[2] === '*') {

        if (scopeParts[1].toLowerCase() === "patient")
            scopeParts[1] = "demographic";

        var text;
        if (!isPatient) {
            text = (scopeParts[1] === "*") ? "all" : "<code>" + scopeParts[1] + "</code>";
            if (scopeParts[0] === "user") {
                text += " data you have access to in the EHR system";
            } else {
                text += " data on the current patient";
            }
        } else {
            if 	(scopeParts[1] === "*") {
                text = "your medical information";
            } else {
                text = 'your information of type "' + scopeParts[1] + '"';
            }
        }

        if (scopeParts[2] === "write" || scopeParts[2] === "*") {
            out.write = '<i class="glyphicon glyphicon-ok-sign text-danger"></i>&nbsp;<b class="text-danger">Write</b> ' + text;
        }

        if (scopeParts[2] === "read" || scopeParts[2] === "*") {
            out.read = '<i class="glyphicon glyphicon-ok-sign text-success"></i>&nbsp;<b class="text-success">Read</b> ' + text;
        }

        return out;
    }

    var tags = "";

    if (scopeParts[2].includes('?')) {
        var accessAndTags = scopeParts[2].split(/[?&]/);
        scopeParts[2] = accessAndTags[0];
        accessAndTags = scope.split(/[?&]/);
        tags = tagsToString(accessAndTags);
    }

    if (scopeParts[2].includes('c')) {
        out.create = `<i class="glyphicon glyphicon-ok-sign text-danger"></i>&nbsp;<b class="text-danger">Create</b> new <code>${scopeParts[1]}</code> records${tags}`;
    }

    if (scopeParts[2].includes('u')) {
        out.update = `<i class="glyphicon glyphicon-ok-sign text-danger"></i>&nbsp;<b class="text-danger">Update</b> existing <code>${scopeParts[1]}</code> records${tags}`;
    }

    if (scopeParts[2].includes('s')) {
        out.search = `<i class="glyphicon glyphicon-ok-sign text-info"></i>&nbsp;<b class="text-info">Search</b> for <code>${scopeParts[1]}</code> records${tags}`;
    }

    if (scopeParts[2].includes('r')) {
        out.read = `<i class="glyphicon glyphicon-ok-sign text-success"></i>&nbsp;<b class="text-success">Read</b> <code>${scopeParts[1]}</code> records${tags}`;
    }

    if (scopeParts[2].includes('d')) {
        out.delete = `<i class="glyphicon glyphicon-ok-sign text-danger"></i>&nbsp;<b class="text-danger">Delete</b> <code>${scopeParts[1]}</code> records${tags}`;
    }

    return out;
}

function tagsToString(accessAndTags: any) {
    if (!accessAndTags) {
        return "";
    }

    if (accessAndTags.length < 2) {
        return "";
    }

    var tags = "";
    accessAndTags.forEach((val: any, index: any) => {
        if (index === 0) { return; }
        if (val.includes('=')) {
            var parts = val.split(/[=]/);
            if (parts[1].includes('|')) {
                parts[1] = parts[1].split('|')[1];
            }
            if (index === 1) {
                tags += ` with <code>${parts[0]}</code> of <code>${parts[1]}</code>`;
            } else {
                tags += ` and <code>${parts[0]}</code> of <code>${parts[1]}</code>`;
            }
        }
    });

    return tags;
}

