import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { validateSession } from '../services/session.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    walletPubkey?: string;
  }
}

/**
 * Authentication middleware - requires valid session
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const sessionToken = request.cookies[config.session.cookieName];

  if (!sessionToken) {
    reply.status(401).send({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  const session = await validateSession(sessionToken);

  if (!session) {
    reply.status(401).send({
      success: false,
      error: 'Invalid or expired session',
    });
    return;
  }

  // Attach user info to request
  request.userId = session.userId;
  request.walletPubkey = session.walletPubkey;
}

/**
 * Optional auth middleware - attaches user info if session exists, but doesn't require it
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const sessionToken = request.cookies[config.session.cookieName];

  if (!sessionToken) {
    return;
  }

  const session = await validateSession(sessionToken);

  if (session) {
    request.userId = session.userId;
    request.walletPubkey = session.walletPubkey;
  }
}

/**
 * Helper to get session cookie options
 */
export function getSessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: config.session.expiryHours * 60 * 60, // in seconds
  };
}
