import { Buffer } from 'buffer';
import bs58 from 'bs58';
import {
  Connection,
  Transaction,
  VersionedTransaction,
  TransactionSignature,
} from '@solana/web3.js';

// For production: point to a reliable RPC (Helius/QuickNode/etc.)
const RPC_URL = 'https://api.mainnet-beta.solana.com';

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_URL, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
}

export type AnySolanaTx = Transaction | VersionedTransaction;
export type SignTransactionFn = <T extends AnySolanaTx>(tx: T) => Promise<T>;

function deserializeBagsTx(base58Tx: string): AnySolanaTx {
  const bytes = bs58.decode(base58Tx);

  // Most Bags endpoints return a v0 tx, but handle legacy too.
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(Buffer.from(bytes));
  }
}

/**
 * Sign and send a Bags-generated transaction (base58 serialized tx)
 */
export async function signAndSendTransaction(
  signTransaction: SignTransactionFn,
  base58Transaction: string
): Promise<TransactionSignature> {
  const conn = getConnection();

  const tx = deserializeBagsTx(base58Transaction);
  const signed = await signTransaction(tx as any);

  const raw =
    signed instanceof VersionedTransaction
      ? signed.serialize()
      : (signed as Transaction).serialize();

  const signature = await conn.sendRawTransaction(raw, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  const confirmation = await conn.confirmTransaction(signature, 'confirmed');
  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  return signature;
}

/**
 * Sign and send multiple transactions sequentially
 */
export async function signAndSendTransactions(
  signTransaction: SignTransactionFn,
  base58Transactions: string[]
): Promise<TransactionSignature[]> {
  const signatures: TransactionSignature[] = [];
  for (const tx of base58Transactions) {
    signatures.push(await signAndSendTransaction(signTransaction, tx));
  }
  return signatures;
}

/**
 * Format lamports to SOL string
 */
export function lamportsToSol(lamports: number | string | bigint): string {
  const lamportsBigInt = typeof lamports === 'bigint' ? lamports : BigInt(lamports);
  const sol = Number(lamportsBigInt) / 1_000_000_000;
  return sol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 9 });
}

/**
 * Format SOL to lamports (string)
 */
export function solToLamports(sol: number): string {
  return Math.floor(sol * 1_000_000_000).toString();
}

/**
 * Truncate a wallet address for display
 */
export function truncateAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Explorer URLs
 */
export function getExplorerUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

export function getAddressExplorerUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}
