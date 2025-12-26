import { z } from 'zod';
import 'dotenv/config';
const envSchema = z.object({
    // Required
    BAGS_API_KEY: z.string().min(1, 'BAGS_API_KEY is required'),
    BAGS_API_BASE_URL: z.string().url('BAGS_API_BASE_URL must be a valid URL').default('https://public-api-v2.bags.fm/api/v1'),
    SOLANA_RPC_URL: z.string().url('SOLANA_RPC_URL must be a valid URL'),
    APP_ORIGIN: z.string().url('APP_ORIGIN must be a valid URL'),
    // Optional with defaults
    PORT: z.string().default('3000').transform(Number),
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    DATABASE_URL: z.string().default('file:./dev.db'),
    SESSION_COOKIE_NAME: z.string().default('livedrops_session'),
    SESSION_EXPIRY_HOURS: z.string().default('168').transform(Number),
    // Rate limiting
    RATE_LIMIT_LOGIN_MAX: z.string().default('10').transform(Number),
    RATE_LIMIT_LOGIN_WINDOW_MS: z.string().default('60000').transform(Number),
    RATE_LIMIT_ACTION_MAX: z.string().default('20').transform(Number),
    RATE_LIMIT_ACTION_WINDOW_MS: z.string().default('60000').transform(Number),
    // Viewer config
    TOKEN_BALANCE_CACHE_SECONDS: z.string().default('15').transform(Number),
    MAX_TTS_MESSAGE_LENGTH: z.string().default('200').transform(Number),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}
export const config = {
    bagsApiKey: parsed.data.BAGS_API_KEY,
    bagsApiBaseUrl: parsed.data.BAGS_API_BASE_URL,
    solanaRpcUrl: parsed.data.SOLANA_RPC_URL,
    appOrigin: parsed.data.APP_ORIGIN,
    port: parsed.data.PORT,
    nodeEnv: parsed.data.NODE_ENV,
    isProduction: parsed.data.NODE_ENV === 'production',
    databaseUrl: parsed.data.DATABASE_URL,
    session: {
        cookieName: parsed.data.SESSION_COOKIE_NAME,
        expiryHours: parsed.data.SESSION_EXPIRY_HOURS,
    },
    rateLimit: {
        login: {
            max: parsed.data.RATE_LIMIT_LOGIN_MAX,
            windowMs: parsed.data.RATE_LIMIT_LOGIN_WINDOW_MS,
        },
        action: {
            max: parsed.data.RATE_LIMIT_ACTION_MAX,
            windowMs: parsed.data.RATE_LIMIT_ACTION_WINDOW_MS,
        },
    },
    viewer: {
        tokenBalanceCacheSeconds: parsed.data.TOKEN_BALANCE_CACHE_SECONDS,
        maxTtsMessageLength: parsed.data.MAX_TTS_MESSAGE_LENGTH,
    },
};
//# sourceMappingURL=config.js.map