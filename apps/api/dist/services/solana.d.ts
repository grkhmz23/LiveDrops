import { Connection, VersionedTransaction } from '@solana/web3.js';
/**
 * Get or create a Solana connection
 */
export declare function getConnection(): Connection;
/**
 * Get SPL token balance for a wallet
 * Returns the raw token amount (not adjusted for decimals)
 */
export declare function getTokenBalance(walletPubkey: string, tokenMint: string): Promise<bigint>;
/**
 * Check if a wallet holds at least the threshold amount of tokens
 */
export declare function checkHolderThreshold(walletPubkey: string, tokenMint: string, thresholdRaw: string): Promise<boolean>;
/**
 * Confirm a transaction with retries
 */
export declare function confirmTransaction(signature: string, maxRetries?: number): Promise<{
    confirmed: boolean;
    error?: string;
}>;
/**
 * Get SOL balance for a wallet
 */
export declare function getSolBalance(walletPubkey: string): Promise<number>;
/**
 * Deserialize a base64 encoded versioned transaction
 */
export declare function deserializeTransaction(base64: string): VersionedTransaction;
/**
 * Serialize a versioned transaction to base64
 */
export declare function serializeTransaction(tx: VersionedTransaction): string;
/**
 * Clear the balance cache (useful for testing or forced refresh)
 */
export declare function clearBalanceCache(): void;
export declare function getRecentBlockhash(): Promise<{
    blockhash: string;
    lastValidBlockHeight: number;
}>;
//# sourceMappingURL=solana.d.ts.map