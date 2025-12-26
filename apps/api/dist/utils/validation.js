import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
/**
 * Validates a Solana public key (base58 encoded)
 */
export function isValidPublicKey(address) {
    try {
        new PublicKey(address);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Zod schema for Solana public key validation
 */
export const publicKeySchema = z.string().refine(isValidPublicKey, {
    message: 'Invalid Solana public key',
});
/**
 * Validates a base58 encoded signature
 */
export function isValidSignature(signature) {
    try {
        const decoded = bs58.decode(signature);
        return decoded.length === 64;
    }
    catch {
        return false;
    }
}
/**
 * Zod schema for signature validation
 */
export const signatureSchema = z.string().refine(isValidSignature, {
    message: 'Invalid signature format',
});
/**
 * Validates a base64 encoded transaction
 */
export function isValidBase64Transaction(base64) {
    try {
        const buffer = Buffer.from(base64, 'base64');
        // Basic sanity check - transactions are typically > 100 bytes
        return buffer.length > 50 && buffer.length < 2000;
    }
    catch {
        return false;
    }
}
/**
 * Schema for creating a drop
 */
export const createDropSchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(32, 'Name must be 32 characters or less')
        .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Name can only contain letters, numbers, spaces, hyphens, and underscores'),
    symbol: z.string()
        .min(1, 'Symbol is required')
        .max(10, 'Symbol must be 10 characters or less')
        .regex(/^[A-Z0-9]+$/i, 'Symbol can only contain letters and numbers')
        .transform(s => s.toUpperCase()),
    description: z.string()
        .min(1, 'Description is required')
        .max(500, 'Description must be 500 characters or less'),
    prizePoolWallet: publicKeySchema,
    streamerBps: z.number()
        .int()
        .min(0, 'Streamer BPS must be at least 0')
        .max(10000, 'Streamer BPS must be at most 10000')
        .default(5000),
    prizePoolBps: z.number()
        .int()
        .min(0, 'Prize pool BPS must be at least 0')
        .max(10000, 'Prize pool BPS must be at most 10000')
        .default(5000),
    holderThresholdRaw: z.string()
        .regex(/^\d+$/, 'Holder threshold must be a non-negative integer')
        .default('0'),
    initialBuyLamports: z.string()
        .regex(/^\d+$/, 'Initial buy must be a non-negative integer')
        .default('10000000'), // 0.01 SOL
    twitterUrl: z.string().url().optional().nullable(),
    websiteUrl: z.string().url().optional().nullable(),
    telegramUrl: z.string().url().optional().nullable(),
    imageUrl: z.string().url().optional().nullable(),
}).refine((data) => data.streamerBps + data.prizePoolBps === 10000, { message: 'Streamer BPS + Prize Pool BPS must equal 10000 (100%)' });
/**
 * Schema for auth nonce request
 */
export const authNonceSchema = z.object({
    walletPubkey: publicKeySchema,
});
/**
 * Schema for auth verify request
 */
export const authVerifySchema = z.object({
    walletPubkey: publicKeySchema,
    signature: signatureSchema,
    message: z.string().min(1),
});
/**
 * Schema for TTS action
 */
export const ttsActionSchema = z.object({
    message: z.string()
        .min(1, 'Message is required')
        .max(200, 'Message must be 200 characters or less'),
});
/**
 * Schema for vote action
 */
export const voteActionSchema = z.object({
    pollId: z.string().min(1),
    optionIndex: z.number().int().min(0),
});
/**
 * Schema for creating a poll
 */
export const createPollSchema = z.object({
    question: z.string()
        .min(1, 'Question is required')
        .max(200, 'Question must be 200 characters or less'),
    options: z.array(z.string().min(1).max(100))
        .min(2, 'At least 2 options required')
        .max(6, 'Maximum 6 options allowed'),
});
//# sourceMappingURL=validation.js.map