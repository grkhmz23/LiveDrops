import { z } from 'zod';
/**
 * Validates a Solana public key (base58 encoded)
 */
export declare function isValidPublicKey(address: string): boolean;
/**
 * Zod schema for Solana public key validation
 */
export declare const publicKeySchema: z.ZodEffects<z.ZodString, string, string>;
/**
 * Validates a base58 encoded signature
 */
export declare function isValidSignature(signature: string): boolean;
/**
 * Zod schema for signature validation
 */
export declare const signatureSchema: z.ZodEffects<z.ZodString, string, string>;
/**
 * Validates a base64 encoded transaction
 */
export declare function isValidBase64Transaction(base64: string): boolean;
/**
 * Schema for creating a drop
 */
export declare const createDropSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    symbol: z.ZodEffects<z.ZodString, string, string>;
    description: z.ZodString;
    prizePoolWallet: z.ZodEffects<z.ZodString, string, string>;
    streamerBps: z.ZodDefault<z.ZodNumber>;
    prizePoolBps: z.ZodDefault<z.ZodNumber>;
    holderThresholdRaw: z.ZodDefault<z.ZodString>;
    initialBuyLamports: z.ZodDefault<z.ZodString>;
    twitterUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    websiteUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    telegramUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    imageUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    name: string;
    description: string;
    prizePoolWallet: string;
    streamerBps: number;
    prizePoolBps: number;
    holderThresholdRaw: string;
    initialBuyLamports: string;
    twitterUrl?: string | null | undefined;
    websiteUrl?: string | null | undefined;
    telegramUrl?: string | null | undefined;
    imageUrl?: string | null | undefined;
}, {
    symbol: string;
    name: string;
    description: string;
    prizePoolWallet: string;
    streamerBps?: number | undefined;
    prizePoolBps?: number | undefined;
    holderThresholdRaw?: string | undefined;
    initialBuyLamports?: string | undefined;
    twitterUrl?: string | null | undefined;
    websiteUrl?: string | null | undefined;
    telegramUrl?: string | null | undefined;
    imageUrl?: string | null | undefined;
}>, {
    symbol: string;
    name: string;
    description: string;
    prizePoolWallet: string;
    streamerBps: number;
    prizePoolBps: number;
    holderThresholdRaw: string;
    initialBuyLamports: string;
    twitterUrl?: string | null | undefined;
    websiteUrl?: string | null | undefined;
    telegramUrl?: string | null | undefined;
    imageUrl?: string | null | undefined;
}, {
    symbol: string;
    name: string;
    description: string;
    prizePoolWallet: string;
    streamerBps?: number | undefined;
    prizePoolBps?: number | undefined;
    holderThresholdRaw?: string | undefined;
    initialBuyLamports?: string | undefined;
    twitterUrl?: string | null | undefined;
    websiteUrl?: string | null | undefined;
    telegramUrl?: string | null | undefined;
    imageUrl?: string | null | undefined;
}>;
export type CreateDropInput = z.infer<typeof createDropSchema>;
/**
 * Schema for auth nonce request
 */
export declare const authNonceSchema: z.ZodObject<{
    walletPubkey: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    walletPubkey: string;
}, {
    walletPubkey: string;
}>;
/**
 * Schema for auth verify request
 */
export declare const authVerifySchema: z.ZodObject<{
    walletPubkey: z.ZodEffects<z.ZodString, string, string>;
    signature: z.ZodEffects<z.ZodString, string, string>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    walletPubkey: string;
    signature: string;
}, {
    message: string;
    walletPubkey: string;
    signature: string;
}>;
/**
 * Schema for TTS action
 */
export declare const ttsActionSchema: z.ZodObject<{
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
}, {
    message: string;
}>;
/**
 * Schema for vote action
 */
export declare const voteActionSchema: z.ZodObject<{
    pollId: z.ZodString;
    optionIndex: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    pollId: string;
    optionIndex: number;
}, {
    pollId: string;
    optionIndex: number;
}>;
/**
 * Schema for creating a poll
 */
export declare const createPollSchema: z.ZodObject<{
    question: z.ZodString;
    options: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    options: string[];
    question: string;
}, {
    options: string[];
    question: string;
}>;
export type CreatePollInput = z.infer<typeof createPollSchema>;
//# sourceMappingURL=validation.d.ts.map