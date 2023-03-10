import Scope from "./Scope";

/**
 * This class tries to make it easier and cleaner to work with scopes (mostly by
 * using the two major methods - "has" and "matches").
 */
export default class ScopeSet
{
    private _scopesString: string;

    private _scopes: string[];
    
    /**
     * Parses the input string (if any) and initializes the private state vars
     */
    public constructor(str = "") {
        this._scopesString = String(str).trim();
        this._scopes = this._scopesString.split(/\s+/).filter(Boolean);
    }

    public get scopes(): string[]
    {
        return [ ...this._scopes ];
    }

    /**
     * Checks if there is a scope that matches exactly the given string
     */
    public has(scope: string): boolean {
        return this._scopes.indexOf(scope) > -1;
    }

    /**
     * Checks if there is a scope that matches by RegExp the given string
     */
    public matches(scopeRegExp: RegExp): boolean {
        return this._scopesString.search(scopeRegExp) > -1;
    }

    /**
     * Adds new scope to the set unless it already exists
     * @returns `true` if the scope was added and `false` otherwise
     */
    public add(scope: string): boolean {
        if (this.has(scope)) {
            return false;
        }
        this._scopes.push(scope);
        this._scopesString = this._scopes.join(" ");
        return true;
    }

    /**
     * Removes a scope to the set unless it does not exist.
     * @returns `true` if the scope was removed and `false` otherwise
     */
    public remove(scope: string): boolean {
        let index = this._scopes.indexOf(scope);
        if (index < 0) {
            return false;
        }
        this._scopes.splice(index, 1);
        this._scopesString = this._scopes.join(" ");
        return true;
    }

    /**
     * Converts the object to string which is the space-separated list of scopes
     */
    public toString(): string {
        return this._scopesString;
    }

    /**
     * Converts the object to JSON which is an arrays of scope strings
     */
    public toJSON(): string[] {
        return this._scopes;
    }

    /**
     * Checks if the given scopes string is valid for use by backend services.
     * This will only accept system scopes and will also reject empty scope.
     * @param scopes The scopes to check
     * @returns The invalid scope or empty string on success
     */
    public static getInvalidSystemScopes(scopes = ""): string {
        scopes = String(scopes).trim();
        return scopes.split(/\s+/).find(s => !(
            /^system\/(\*|[A-Z][a-zA-Z]+)(\.(read|write|\*|[cruds]+))?$/.test(s)
        )) || "";
    }

    /**
     * Assuming that this instance represents a list of allowed scopes, given a
     * another list of requested scopes, returns the scopes that would be
     * granted and those that would be rejected
     * @param requested Requested scopes as comma-separated list or as ScopeSet
     */
    public negotiate(requested: string | ScopeSet): { grantedScopes: string[], rejectedScopes: string[] }
    {
        if (!(requested instanceof ScopeSet)) {
            return this.negotiate(new ScopeSet(requested))
        }

        const grantedScopes : string[] = [];
        const rejectedScopes: string[] = [];

        requested.scopes.forEach(requestedScope => {
            
            // Firs look for direct match
            if (this.has(requestedScope)) {
                return grantedScopes.push(requestedScope);
            }

            // For resource access scope try smarter approach
            if (requestedScope.includes("/") && requestedScope.includes(".")) {
                const scope = new Scope(requestedScope);
                
                if (this.scopes.find(s => {
                    
                    // Skip scopes other than xxx/xxx.xxx
                    if (!s.includes("/") || !s.includes(".")) {
                        return false
                    }

                    const grantedScope = new Scope(s)
                    
                    // grantedScope does not allow access on the requested level
                    if (grantedScope.level !== "*" && grantedScope.level !== scope.level) {
                        return false
                    }

                    // grantedScope does not allow access to the requested resource
                    if (grantedScope.resource !== "*" && grantedScope.resource !== scope.resource) {
                        return false
                    }

                    // grantedScope has different create permission flag
                    if (grantedScope.actions.get("create") !== scope.actions.get("create")) {
                        return false
                    }

                    // grantedScope has different read permission flag
                    if (grantedScope.actions.get("read") !== scope.actions.get("read")) {
                        return false
                    }

                    // grantedScope has different update permission flag
                    if (grantedScope.actions.get("update") !== scope.actions.get("update")) {
                        return false
                    }

                    // grantedScope has different delete permission flag
                    if (grantedScope.actions.get("delete") !== scope.actions.get("delete")) {
                        return false
                    }

                    // grantedScope has different search permission flag
                    if (grantedScope.actions.get("search") !== scope.actions.get("search")) {
                        return false
                    }

                    // we have a match!
                    return true
                })) {
                    return grantedScopes.push(requestedScope);
                }
            }

            rejectedScopes.push(requestedScope);
        });

        return { grantedScopes, rejectedScopes };
    }
}


