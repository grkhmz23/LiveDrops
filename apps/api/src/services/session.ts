import { createHash, randomBytes } from 'crypto';
import { prisma } from '../db/client.js';
import { config } from '../config.js';

/**
 * Tunables
 * - NONCE_TTL_MS: how long a nonce is valid for signature verification
 * - LAST_SEEN_UPDATE_MS: throttle DB writes for lastSeenAt to reduce SQLite write load
 */
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LAST_SEEN_UPDATE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a cryptographically secure random token
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a session token using SHA-256
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + config.session.expiryHours * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      cookieTokenHash: tokenHash,
      expiresAt,
      // lastSeenAt default is handled by Prisma schema default(now())
    },
  });

  return token;
}

/**
 * Validate a session token and return the associated user
 */
export async function validateSession(
  token: string
): Promise<{ userId: string; walletPubkey: string } | null> {
  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: { cookieTokenHash: tokenHash },
    include: { user: true },
  });

  if (!session) return null;

  const now = Date.now();

  // Expired: delete and reject
  if (session.expiresAt.getTime() < now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Throttle lastSeenAt updates to reduce DB writes under load
  const lastSeen = session.lastSeenAt?.getTime?.() ?? 0;
  if (lastSeen < now - LAST_SEEN_UPDATE_MS) {
    await prisma.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now) },
      })
      .catch(() => {});
  }

  return {
    userId: session.userId,
    walletPubkey: session.user.walletPubkey,
  };
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await prisma.session.deleteMany({
    where: { cookieTokenHash: tokenHash },
  });
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Clean up expired sessions (call periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

/**
 * Generate a nonce message for wallet signature
 *
 * Note: This is intentionally plain-text and deterministic in structure.
 * The nonce itself is random bytes embedded in the message.
 */
export function generateNonceMessage(walletPubkey: string, timestamp: number): string {
  return [
    'Sign this message to authenticate with LiveDrops.',
    '',
    `Wallet: ${walletPubkey}`,
    `Timestamp: ${timestamp}`,
    `Nonce: ${randomBytes(16).toString('hex')}`,
  ].join('\n');
}

/**
 * Nonce storage (in-memory)
 *
 * This is acceptable for hackathon/demo, but NOT restart-safe:
 * if the server restarts between nonce issuance and verification, verification will fail.
 * Next step (after you paste auth.ts): move this to DB with a Nonce table.
 */
const nonceStore = new Map<string, { message: string; issuedAtMs: number }>();

/**
 * Store a nonce for later verification
 */
export function storeNonce(walletPubkey: string, message: string): void {
  // Opportunistic cleanup to prevent unbounded growth
  const cutoff = Date.now() - NONCE_TTL_MS;
  for (const [key, value] of nonceStore.entries()) {
    if (value.issuedAtMs < cutoff) nonceStore.delete(key);
  }

  // One active nonce per wallet (newest overwrites old)
  nonceStore.set(walletPubkey, { message, issuedAtMs: Date.now() });
}

/**
 * Get and consume a stored nonce (single-use)
 */
export function consumeNonce(walletPubkey: string): string | null {
  const stored = nonceStore.get(walletPubkey);
  if (!stored) return null;

  // TTL check
  if (Date.now() - stored.issuedAtMs > NONCE_TTL_MS) {
    nonceStore.delete(walletPubkey);
    return null;
  }

  // Single-use
  nonceStore.delete(walletPubkey);
  return stored.message;
}
