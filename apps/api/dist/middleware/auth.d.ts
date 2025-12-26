import { FastifyRequest, FastifyReply } from 'fastify';
declare module 'fastify' {
    interface FastifyRequest {
        userId?: string;
        walletPubkey?: string;
    }
}
/**
 * Authentication middleware - requires valid session
 */
export declare function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Optional auth middleware - attaches user info if session exists, but doesn't require it
 */
export declare function optionalAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void>;
/**
 * Helper to get session cookie options
 */
export declare function getSessionCookieOptions(isProduction: boolean): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
};
//# sourceMappingURL=auth.d.ts.map