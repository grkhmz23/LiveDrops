import 'dotenv/config';
export declare const config: {
    readonly bagsApiKey: string;
    readonly bagsApiBaseUrl: string;
    readonly solanaRpcUrl: string;
    readonly appOrigin: string;
    readonly port: number;
    readonly nodeEnv: "development" | "production";
    readonly isProduction: boolean;
    readonly databaseUrl: string;
    readonly session: {
        readonly cookieName: string;
        readonly expiryHours: number;
    };
    readonly rateLimit: {
        readonly login: {
            readonly max: number;
            readonly windowMs: number;
        };
        readonly action: {
            readonly max: number;
            readonly windowMs: number;
        };
    };
    readonly viewer: {
        readonly tokenBalanceCacheSeconds: number;
        readonly maxTtsMessageLength: number;
    };
};
export type Config = typeof config;
//# sourceMappingURL=config.d.ts.map