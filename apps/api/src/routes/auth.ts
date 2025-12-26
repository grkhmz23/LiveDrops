import { FastifyPluginAsync } from 'fastify';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { config } from '../config.js';
import { prisma } from '../db/client.js';
import {
  generateNonceMessage,
  storeNonce,
  consumeNonce,
  createSession,
  deleteSession,
} from '../services/session.js';
import { authNonceSchema, authVerifySchema } from '../utils/validation.js';
import { getSessionCookieOptions, requireAuth } from '../middleware/auth.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Rate limit login endpoints
  await fastify.register(import('@fastify/rate-limit'), {
    max: config.rateLimit.login.max,
    timeWindow: config.rateLimit.login.windowMs,
    keyGenerator: (request) => request.ip,
  });

  /**
   * GET /api/auth/nonce
   * Generate a nonce message for wallet signature
   */
  fastify.get<{
    Querystring: { walletPubkey: string };
  }>('/nonce', async (request, reply) => {
    const parseResult = authNonceSchema.safeParse(request.query);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid wallet address',
        details: parseResult.error.flatten(),
      });
    }

    const { walletPubkey } = parseResult.data;
    const timestamp = Date.now();
    const message = generateNonceMessage(walletPubkey, timestamp);

    // Store nonce for verification (single-use, TTL enforced in session service)
    storeNonce(walletPubkey, message);

    // Prevent caching of nonce responses
    reply.header('Cache-Control', 'no-store');

    return {
      success: true,
      data: { message, timestamp },
    };
  });

  /**
   * POST /api/auth/verify
   * Verify wallet signature and create session
   */
  fastify.post<{
    Body: {
      walletPubkey: string;
      signature: string;
      message: string;
    };
  }>('/verify', async (request, reply) => {
    const parseResult = authVerifySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
        details: parseResult.error.flatten(),
      });
    }

    const { walletPubkey, signature, message } = parseResult.data;

    // Verify the nonce message matches what we stored (single-use)
    const storedMessage = consumeNonce(walletPubkey);
    if (!storedMessage || storedMessage !== message) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid or expired nonce. Please request a new one.',
      });
    }

    // Verify the signature
    try {
      const publicKey = new PublicKey(walletPubkey);

      let signatureBytes: Uint8Array;
      try {
        signatureBytes = bs58.decode(signature);
      } catch {
        return reply.status(401).send({
          success: false,
          error: 'Invalid signature encoding',
        });
      }

      // Ed25519 signatures must be 64 bytes
      if (signatureBytes.length !== 64) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid signature length',
        });
      }

      const messageBytes = new TextEncoder().encode(message);

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes()
      );

      if (!isValid) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid signature',
        });
      }
    } catch (error) {
      fastify.log.error({ err: error }, 'Signature verification error');
      return reply.status(401).send({
        success: false,
        error: 'Signature verification failed',
      });
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { walletPubkey } });
    if (!user) {
      user = await prisma.user.create({ data: { walletPubkey } });
    }

    // Create session token (raw token, hashed in DB)
    const sessionToken = await createSession(user.id);

    // Cookie options: ensure maxAge is always aligned with config
    const cookieOpts = {
      ...getSessionCookieOptions(config.isProduction),
      maxAge: config.session.expiryHours * 60 * 60,
      path: '/', // ensure consistent clearing
    };

    reply.setCookie(config.session.cookieName, sessionToken, cookieOpts);

    return {
      success: true,
      data: {
        userId: user.id,
        walletPubkey: user.walletPubkey,
      },
    };
  });

  /**
   * POST /api/auth/logout
   * Clear session
   */
  fastify.post('/logout', async (request, reply) => {
    const sessionToken = request.cookies[config.session.cookieName];

    if (sessionToken) {
      await deleteSession(sessionToken);
    }

    // Clear with the same attributes used to set the cookie
    const clearOpts = {
      ...getSessionCookieOptions(config.isProduction),
      path: '/',
    };

    reply.clearCookie(config.session.cookieName, clearOpts);

    return { success: true };
  });

  /**
   * GET /api/auth/me
   * Get current user info
   */
  fastify.get(
    '/me',
    { preHandler: requireAuth },
    async (request) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
      });

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      return {
        success: true,
        data: {
          userId: user.id,
          walletPubkey: user.walletPubkey,
          createdAt: user.createdAt,
        },
      };
    }
  );
};
