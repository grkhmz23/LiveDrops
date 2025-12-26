import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { config } from '../config.js';
import { prisma } from '../db/client.js';
import { generateNonceMessage, storeNonce, consumeNonce, createSession, deleteSession, } from '../services/session.js';
import { authNonceSchema, authVerifySchema } from '../utils/validation.js';
import { getSessionCookieOptions, requireAuth } from '../middleware/auth.js';
export const authRoutes = async (fastify) => {
    // Rate limit login endpoints
    fastify.register(import('@fastify/rate-limit'), {
        max: config.rateLimit.login.max,
        timeWindow: config.rateLimit.login.windowMs,
        keyGenerator: (request) => {
            // Rate limit by IP for auth endpoints
            return request.ip;
        },
    });
    /**
     * GET /api/auth/nonce
     * Generate a nonce message for wallet signature
     */
    fastify.get('/nonce', async (request, reply) => {
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
        // Store nonce for verification
        storeNonce(walletPubkey, message);
        return {
            success: true,
            data: {
                message,
                timestamp,
            },
        };
    });
    /**
     * POST /api/auth/verify
     * Verify wallet signature and create session
     */
    fastify.post('/verify', async (request, reply) => {
        const parseResult = authVerifySchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid request body',
                details: parseResult.error.flatten(),
            });
        }
        const { walletPubkey, signature, message } = parseResult.data;
        // Verify the nonce message matches what we stored
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
            const signatureBytes = bs58.decode(signature);
            const messageBytes = new TextEncoder().encode(message);
            const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());
            if (!isValid) {
                return reply.status(401).send({
                    success: false,
                    error: 'Invalid signature',
                });
            }
        }
        catch (error) {
            console.error('Signature verification error:', error);
            return reply.status(401).send({
                success: false,
                error: 'Signature verification failed',
            });
        }
        // Find or create user
        let user = await prisma.user.findUnique({
            where: { walletPubkey },
        });
        if (!user) {
            user = await prisma.user.create({
                data: { walletPubkey },
            });
        }
        // Create session
        const sessionToken = await createSession(user.id);
        // Set session cookie
        reply.setCookie(config.session.cookieName, sessionToken, getSessionCookieOptions(config.isProduction));
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
        reply.clearCookie(config.session.cookieName, {
            path: '/',
        });
        return {
            success: true,
        };
    });
    /**
     * GET /api/auth/me
     * Get current user info
     */
    fastify.get('/me', {
        preHandler: requireAuth,
    }, async (request) => {
        const user = await prisma.user.findUnique({
            where: { id: request.userId },
        });
        if (!user) {
            return {
                success: false,
                error: 'User not found',
            };
        }
        return {
            success: true,
            data: {
                userId: user.id,
                walletPubkey: user.walletPubkey,
                createdAt: user.createdAt,
            },
        };
    });
};
//# sourceMappingURL=auth.js.map