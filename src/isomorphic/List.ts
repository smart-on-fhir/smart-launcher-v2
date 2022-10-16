
/**
 * Represents a list of strings
 */
export default class List
{
    /**
     * Stores all the separate string tokens
     */
    protected _arr: string[] = [];
    
    /**
     * What separator to use when an input string is parsed and/or when the
     * tokens are joined back into a string. Defaults to `,`.
     */
    protected _separator: string = ",";

    /**
     * An instance can be constructed from a string or from an array of strings.
     * In any case, a separator can also be given as a second argument.
     * @param input A string or array of strings to start with 
     * @param separator The separator (defaults to ",")
     */
    public constructor(input: string|string[] = "", separator: string = ",")
    {
        this._separator = separator
        this.set(input)
    }

    /**
     * Returns the length of the token list. For example:
     * @example
     * ```
     * new List(["a", "b", "c"]).size() => 3
     * new List("a, b, c").size() => 3
     * ```
     */
    public size(): number
    {
        return this._arr.length
    }

    /**
     * Converts the instance to string by joining the tokens using the separator
     */
    public toString(): string
    {
        return this._arr.join(this._separator)
    }

    /**
     * The JSON representation of the instance is a copy of the string array
     */
    public toJSON(): string[]
    {
        return [ ...this._arr ]
    }

    /**
     * Checks if there is a token matching the given string or RegExp
     * @param needle The string or RegExp to look for
     */
    public has(needle: string | RegExp): boolean
    {
        if (typeof needle === "string") {
            return this._arr.includes(needle)
        }
        return this._arr.some(s => s.match(needle));
    }

    /**
     * Adds new string token to the list, but only if it is not there already.
     */
    public add(item: string): List
    {
        if (item && !this.has(item)) {
            this._arr.push(item)
        }
        return this
    }

    /**
     * Removes a string token from the list.
     */
    public remove(item: string): List
    {
        this._arr = this._arr.filter(x => x !== item)
        return this
    }

    /**
     * Empties the instance by removing all the tokens from the list
     */
    public clear(): List
    {
        this._arr = []
        return this
    }

    /**
     * Replaces the entire content of the instance with new one extracted from
     * the given @items
     */
    public set(items: string | string[]): List
    {
        if (Array.isArray(items)) {
            this._arr = items.filter(Boolean)
        } else {
            this._arr = items.split(this._separator).map(s => s.trim()).filter(Boolean)
        }
        return this
    }

    /**
     * Get the token at the given index. The result should be a string, but can
     * also be undefined if there is nothing on that index
     */
    public get(index: number): string | undefined
    {
        return this._arr[index]
    }
}
