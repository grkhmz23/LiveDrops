import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from '@solana/web3.js';
import { config } from '../config.js';

// Singleton connection
let connection: Connection | null = null;

/**
 * Get or create a Solana connection
 */
export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(config.solanaRpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
}

// Token balance cache to reduce RPC load
interface BalanceCacheEntry {
  balance: bigint;
  timestamp: number;
}

const balanceCache = new Map<string, BalanceCacheEntry>();

/**
 * Get SPL token balance for a wallet
 * Returns the raw token amount (not adjusted for decimals)
 */
export async function getTokenBalance(
  walletPubkey: string,
  tokenMint: string
): Promise<bigint> {
  const cacheKey = `${walletPubkey}:${tokenMint}`;
  const cached = balanceCache.get(cacheKey);
  
  // Return cached value if still valid
  if (cached && Date.now() - cached.timestamp < config.viewer.tokenBalanceCacheSeconds * 1000) {
    return cached.balance;
  }

  const conn = getConnection();
  const wallet = new PublicKey(walletPubkey);
  const mint = new PublicKey(tokenMint);

  try {
    // Get all token accounts for this wallet
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(
      wallet,
      { mint },
      'confirmed'
    );

    // Sum up balances from all accounts (usually just one)
    let totalBalance = BigInt(0);
    for (const account of tokenAccounts.value) {
      const amount = account.account.data.parsed?.info?.tokenAmount?.amount;
      if (amount) {
        totalBalance += BigInt(amount);
      }
    }

    // Update cache
    balanceCache.set(cacheKey, {
      balance: totalBalance,
      timestamp: Date.now(),
    });

    return totalBalance;
  } catch (error) {
    console.error('Error fetching token balance:', error);
    // On error, return cached value if available, otherwise 0
    return cached?.balance ?? BigInt(0);
  }
}

/**
 * Check if a wallet holds at least the threshold amount of tokens
 */
export async function checkHolderThreshold(
  walletPubkey: string,
  tokenMint: string,
  thresholdRaw: string
): Promise<boolean> {
  const balance = await getTokenBalance(walletPubkey, tokenMint);
  const threshold = BigInt(thresholdRaw);
  return balance >= threshold;
}

/**
 * Confirm a transaction with retries
 */
export async function confirmTransaction(
  signature: string,
  maxRetries: number = 3
): Promise<{ confirmed: boolean; error?: string }> {
  const conn = getConnection();
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await conn.confirmTransaction(signature, 'confirmed');
      
      if (result.value.err) {
        return {
          confirmed: false,
          error: JSON.stringify(result.value.err),
        };
      }
      
      return { confirmed: true };
    } catch (error) {
      if (attempt === maxRetries - 1) {
        return {
          confirmed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  
  return { confirmed: false, error: 'Max retries exceeded' };
}

/**
 * Get SOL balance for a wallet
 */
export async function getSolBalance(walletPubkey: string): Promise<number> {
  const conn = getConnection();
  const wallet = new PublicKey(walletPubkey);
  const balance = await conn.getBalance(wallet);
  return balance / LAMPORTS_PER_SOL;
}

/**
 * Deserialize a base64 encoded versioned transaction
 */
export function deserializeTransaction(base64: string): VersionedTransaction {
  const buffer = Buffer.from(base64, 'base64');
  return VersionedTransaction.deserialize(buffer);
}

/**
 * Serialize a versioned transaction to base64
 */
export function serializeTransaction(tx: VersionedTransaction): string {
  return Buffer.from(tx.serialize()).toString('base64');
}

/**
 * Clear the balance cache (useful for testing or forced refresh)
 */
export function clearBalanceCache(): void {
  balanceCache.clear();
}

/**
 * Get recent blockhash with caching
 */
let cachedBlockhash: { blockhash: string; lastValidBlockHeight: number; timestamp: number } | null = null;

export async function getRecentBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  // Cache blockhash for 30 seconds
  if (cachedBlockhash && Date.now() - cachedBlockhash.timestamp < 30000) {
    return {
      blockhash: cachedBlockhash.blockhash,
      lastValidBlockHeight: cachedBlockhash.lastValidBlockHeight,
    };
  }

  const conn = getConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  
  cachedBlockhash = {
    blockhash,
    lastValidBlockHeight,
    timestamp: Date.now(),
  };

  return { blockhash, lastValidBlockHeight };
}
