import { createHash, randomBytes } from 'crypto';
import { prisma } from '../db/client.js';
import { config } from '../config.js';

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
    },
  });

  return token;
}

/**
 * Validate a session token and return the associated user
 */
export async function validateSession(token: string): Promise<{ userId: string; walletPubkey: string } | null> {
  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: { cookieTokenHash: tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Update last seen timestamp
  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  }).catch(() => {}); // Non-critical, don't fail if update fails

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
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

/**
 * Generate a nonce message for wallet signature
 */
export function generateNonceMessage(walletPubkey: string, timestamp: number): string {
  return `Sign this message to authenticate with LiveDrops.\n\nWallet: ${walletPubkey}\nTimestamp: ${timestamp}\nNonce: ${randomBytes(16).toString('hex')}`;
}

// Store nonces temporarily (in production, consider Redis)
const nonceStore = new Map<string, { message: string; timestamp: number }>();

/**
 * Store a nonce for later verification
 */
export function storeNonce(walletPubkey: string, message: string): void {
  // Clean old nonces (older than 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, value] of nonceStore.entries()) {
    if (value.timestamp < fiveMinutesAgo) {
      nonceStore.delete(key);
    }
  }

  nonceStore.set(walletPubkey, { message, timestamp: Date.now() });
}

/**
 * Get and consume a stored nonce
 */
export function consumeNonce(walletPubkey: string): string | null {
  const stored = nonceStore.get(walletPubkey);
  if (!stored) {
    return null;
  }

  // Check if nonce is expired (5 minute validity)
  if (Date.now() - stored.timestamp > 5 * 60 * 1000) {
    nonceStore.delete(walletPubkey);
    return null;
  }

  nonceStore.delete(walletPubkey);
  return stored.message;
}
