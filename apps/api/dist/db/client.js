import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';
// Prevent multiple instances in development due to hot reloading
export const prisma = globalThis.prisma ?? new PrismaClient({
    log: config.isProduction ? ['error'] : ['query', 'error', 'warn'],
});
if (!config.isProduction) {
    globalThis.prisma = prisma;
}
export async function connectDatabase() {
    try {
        await prisma.$connect();
        console.log('✅ Database connected');
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        throw error;
    }
}
export async function disconnectDatabase() {
    await prisma.$disconnect();
    console.log('📴 Database disconnected');
}
//# sourceMappingURL=client.js.map