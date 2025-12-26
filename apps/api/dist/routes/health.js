import { prisma } from '../db/client.js';
import { getConnection } from '../services/solana.js';
export const healthRoutes = async (fastify) => {
    /**
     * GET /health
     * Basic health check
     */
    fastify.get('/', async () => {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    });
    /**
     * GET /health/detailed
     * Detailed health check
     *
     * Note: This endpoint intentionally does not call external third-party APIs
     * (e.g., Bags) because health checks should remain reliable and cheap.
     */
    fastify.get('/detailed', async (_request, _reply) => {
        const checks = {};
        // Check database
        const dbStart = Date.now();
        try {
            await prisma.$queryRaw `SELECT 1`;
            checks.database = {
                status: 'ok',
                latencyMs: Date.now() - dbStart,
            };
        }
        catch (error) {
            checks.database = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
        // Check Solana RPC
        const rpcStart = Date.now();
        try {
            const conn = getConnection();
            await conn.getSlot();
            checks.solanaRpc = {
                status: 'ok',
                latencyMs: Date.now() - rpcStart,
            };
        }
        catch (error) {
            checks.solanaRpc = {
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
        const allOk = Object.values(checks).every((c) => c.status === 'ok');
        return {
            status: allOk ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            checks,
        };
    });
};
//# sourceMappingURL=health.js.map