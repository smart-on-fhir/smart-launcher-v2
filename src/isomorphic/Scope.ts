type AccessLevel = "patient" | "user" | "system" | "*";
type Action = "create" | "read" | "update" | "delete" | "search";

// patient|user|system|*)/(*|resourceType).(read|write|*)
const re_scope_v1 = /^\s*(patient|user|system|\*)\/(\*|[A-Z][A-Za-z0-9]+)\.(read|write|\*)\s*$/;

// patient|user|system)/(*|resourceType).[cruds]?query
const re_scope_v2 = /^\s*(patient|user|system|\*)\/(\*|[A-Z][A-Za-z0-9]+)\.([cruds]+)(\?.*)?$/

export default class Scope {

    public readonly level: AccessLevel;

    public readonly resource: string;

    public readonly actions: Map<Action, boolean>;

    /**
     * Only V2 scopes will have a query property
     */
    public readonly query?: URLSearchParams

    public readonly version: "1" | "2";
    
    constructor(input: string)
    {
        let match = input.match(re_scope_v1);

        if (match) {
            const action = match[3];
            this.level    = match[1] as AccessLevel;
            this.resource = match[2];
            this.version  = "1";
            this.actions  = new Map([
                [ "create", action === "*" || action === "write" ],
                [ "read"  , action === "*" || action === "read"  ],
                [ "update", action === "*" || action === "write" ],
                [ "delete", action === "*" || action === "write" ],
                [ "search", action === "*" || action === "read"  ],
            ]);
        }

        else {
            match = input.match(re_scope_v2);

            if (match) {

                const action = match[3];
                const map = new Map();
                const actionKeys = ["create", "read", "update", "delete", "search"];

                action.split("").forEach(key => {
                    map.set(actionKeys.find(x => x[0] === key), true)
                });

                actionKeys.filter(x => !map.has(x)).forEach(x => map.set(x, false))

                this.level    = match[1] as AccessLevel;
                this.resource = match[2];
                this.actions  = map;
                this.version  = "2";
                this.query    = new URLSearchParams(match[4]);
            }

            else {
                throw new Error(`Invalid scope "${input}"`)
            }
        }
    }

    public toString()
    {
        let out = `${this.level}/${this.resource}.`;

        if (this.version === "2") {
            for (let action of this.actions.keys()) {
                if (this.actions.get(action)) {
                    out += action[0];
                }
            }

            const qs = this.query!.toString();
            if (qs) {
                out += "?" + qs;
            }
        }

        else {
            let canRead   = this.actions.get("read"  ) && this.actions.get("search")
            let canMutate = this.actions.get("create") && this.actions.get("update") && this.actions.get("delete")

            out += canRead && canMutate ? "*" : canMutate ? "write" : "read";
        }

        return out;
    }
}
