import { FastifyInstance } from 'fastify';
export interface OverlayMessage {
    type: 'TTS' | 'VOTE' | 'POLL_CREATED' | 'POLL_CLOSED' | 'THRESHOLD_UPDATED' | 'DROP_LAUNCHED';
    data: unknown;
}
/**
 * Broadcast a message to all connected overlay clients for a drop
 */
export declare function broadcastToOverlay(slug: string, message: OverlayMessage): void;
/**
 * Register websocket routes
 */
export declare function registerWebSocketRoutes(fastify: FastifyInstance): Promise<void>;
/**
 * Get count of connected clients for a drop
 */
export declare function getOverlayClientCount(slug: string): number;
/**
 * Get total connected clients across all drops
 */
export declare function getTotalOverlayClients(): number;
//# sourceMappingURL=websocket.d.ts.map