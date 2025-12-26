import { config } from '../config.js';
import { validateSession } from '../services/session.js';
/**
 * Authentication middleware - requires valid session
 */
export async function requireAuth(request, reply) {
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
export async function optionalAuth(request, _reply) {
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
export function getSessionCookieOptions(isProduction) {
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: config.session.expiryHours * 60 * 60, // in seconds
    };
}
//# sourceMappingURL=auth.js.map