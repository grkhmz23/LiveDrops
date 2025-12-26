import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';

// Store connected overlay clients by drop slug
const overlayClients = new Map<string, Set<WebSocket>>();

export interface OverlayMessage {
  type: 'TTS' | 'VOTE' | 'POLL_CREATED' | 'POLL_CLOSED' | 'THRESHOLD_UPDATED' | 'DROP_LAUNCHED';
  data: unknown;
}

/**
 * Broadcast a message to all connected overlay clients for a drop
 */
export function broadcastToOverlay(slug: string, message: OverlayMessage): void {
  const clients = overlayClients.get(slug);
  if (!clients) return;

  const messageStr = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  }
}

/**
 * Register websocket routes
 */
export async function registerWebSocketRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(import('@fastify/websocket'));

  fastify.get<{
    Params: { slug: string };
  }>('/ws/overlay/:slug', { websocket: true }, (connection, request) => {
    // Depending on fastify-websocket version/typing, `connection` may be:
    // - a wrapper with `.socket`, or
    // - the raw WebSocket instance.
    const ws: WebSocket = ((connection as any).socket ?? connection) as WebSocket;
    const slug = request.params.slug;

    // Add client to the set for this drop
    if (!overlayClients.has(slug)) {
      overlayClients.set(slug, new Set());
    }
    overlayClients.get(slug)!.add(ws);

    console.log(`[WebSocket] Overlay client connected for drop: ${slug}`);

    // Send initial connection confirmation
    ws.send(
      JSON.stringify({
        type: 'CONNECTED',
        data: { slug },
      }),
    );

    // Handle incoming messages (ping/pong for keepalive)
    ws.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        if (data?.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }));
        }
      } catch {
        // Ignore invalid messages
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      const clients = overlayClients.get(slug);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          overlayClients.delete(slug);
        }
      }
      console.log(`[WebSocket] Overlay client disconnected for drop: ${slug}`);
    });

    // Handle errors
    ws.on('error', (error: any) => {
      console.error(`[WebSocket] Error for drop ${slug}:`, error);
    });
  });
}

/**
 * Get count of connected clients for a drop
 */
export function getOverlayClientCount(slug: string): number {
  return overlayClients.get(slug)?.size ?? 0;
}

/**
 * Get total connected clients across all drops
 */
export function getTotalOverlayClients(): number {
  let total = 0;
  for (const clients of overlayClients.values()) {
    total += clients.size;
  }
  return total;
}
