/**
 * TokenContext represents the data associated with an issued token.
 * NOTE: In a production environment, this should also include session binding
 * to prevent token reuse across different user sessions.
 */
export interface TokenContext {
    id_token_hash: string
    scope: string
    patient?: string
    user: string
    client_id: string
    context: Record<string, any>
    exp: number
}

/**
 * A simple in-memory cache for token contexts.
 * 
 * SECURITY NOTE: This is a reference implementation.
 * In a production environment, you should:
 * 1. Bind tokens to user sessions to prevent unauthorized reuse
 * 2. Use a persistent storage mechanism
 */
export class TokenCache {
    private cache: Map<string, TokenContext> = new Map();
    private readonly maxSize: number = 1000;

    public set(context: TokenContext): void {
        // If we're at capacity, remove oldest entries
        while (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(context.id_token_hash, context);
    }

    public get(idTokenHash: string): TokenContext | undefined {
        const context = this.cache.get(idTokenHash);
        if (context && 
            Date.now() < context.exp * 1000) {
            return context;
        }
        // Clean up expired entries
        this.cache.delete(idTokenHash);
        return undefined;
    }
}
