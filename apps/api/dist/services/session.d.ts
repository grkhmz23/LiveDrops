/**
 * Generate a cryptographically secure random token
 */
export declare function generateSessionToken(): string;
/**
 * Hash a session token using SHA-256
 */
export declare function hashSessionToken(token: string): string;
/**
 * Create a new session for a user
 */
export declare function createSession(userId: string): Promise<string>;
/**
 * Validate a session token and return the associated user
 */
export declare function validateSession(token: string): Promise<{
    userId: string;
    walletPubkey: string;
} | null>;
/**
 * Delete a session (logout)
 */
export declare function deleteSession(token: string): Promise<void>;
/**
 * Delete all sessions for a user
 */
export declare function deleteAllUserSessions(userId: string): Promise<void>;
/**
 * Clean up expired sessions (call periodically)
 */
export declare function cleanupExpiredSessions(): Promise<number>;
/**
 * Generate a nonce message for wallet signature
 */
export declare function generateNonceMessage(walletPubkey: string, timestamp: number): string;
/**
 * Store a nonce for later verification
 */
export declare function storeNonce(walletPubkey: string, message: string): void;
/**
 * Get and consume a stored nonce
 */
export declare function consumeNonce(walletPubkey: string): string | null;
//# sourceMappingURL=session.d.ts.map