import 'dotenv/config';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import { config } from './config.js';
import { connectDatabase, disconnectDatabase } from './db/client.js';
import { authRoutes } from './routes/auth.js';
import { dropsRoutes } from './routes/drops.js';
import { viewerRoutes } from './routes/viewer.js';
import { overlayRoutes } from './routes/overlay.js';
import { healthRoutes } from './routes/health.js';
import { registerWebSocketRoutes } from './websocket.js';
import { generateRequestId } from './utils/sanitize.js';
import { cleanupExpiredSessions } from './services/session.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: config.isProduction ? 'info' : 'debug',
  },
  trustProxy: true,
});

// Request ID for tracing
fastify.addHook('onRequest', async (request) => {
  request.id = generateRequestId();
});

// CORS
await fastify.register(fastifyCors, {
  origin: config.isProduction ? config.appOrigin : true,
  credentials: true,
});

// Cookies
await fastify.register(fastifyCookie);

// Multipart (file uploads)
await fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max
  },
});

// WebSocket for overlay
await registerWebSocketRoutes(fastify);

// API Routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(dropsRoutes, { prefix: '/api/drops' });
await fastify.register(viewerRoutes, { prefix: '/api/viewer' });
await fastify.register(overlayRoutes, { prefix: '/api/overlay' });
await fastify.register(healthRoutes, { prefix: '/health' });

// Serve static files in production (built web app)
const publicPath = join(__dirname, 'public');
if (existsSync(publicPath)) {
  await fastify.register(fastifyStatic, {
    root: publicPath,
    prefix: '/',
    decorateReply: false,
  });

  // SPA fallback - serve index.html for all non-API routes
  fastify.setNotFoundHandler(async (_request, reply) => {
    const url = reply.request.url;

    if (url.startsWith('/api/') || url.startsWith('/ws/') || url.startsWith('/health')) {
      return reply.status(404).send({ success: false, error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
} else {
  // Development mode - no static files
  fastify.setNotFoundHandler(async (_request, reply) => {
    return reply.status(404).send({ success: false, error: 'Not found' });
  });
}

// Global error handler
fastify.setErrorHandler(async (error, request, reply) => {
  fastify.log.error({ err: error, requestId: request.id }, 'Request error');

  // Handle validation errors
  if ((error as any).validation) {
    return reply.status(400).send({
      success: false,
      error: 'Validation error',
      details: (error as any).validation,
    });
  }

  // Handle known errors
  if ((error as any).statusCode) {
    return reply.status((error as any).statusCode).send({
      success: false,
      error: (error as any).message,
    });
  }

  // Unknown errors
  return reply.status(500).send({
    success: false,
    error: config.isProduction ? 'Internal server error' : (error as any).message,
  });
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await fastify.close();
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    fastify.log.error(err, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    await connectDatabase();

    // Start session cleanup interval (every hour)
    setInterval(async () => {
      try {
        const cleaned = await cleanupExpiredSessions();
        if (cleaned > 0) fastify.log.info(`Cleaned up ${cleaned} expired sessions`);
      } catch (err) {
        fastify.log.error(err, 'Session cleanup error');
      }
    }, 60 * 60 * 1000);

    await fastify.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    fastify.log.info(
      {
        port: config.port,
        env: config.nodeEnv,
        appOrigin: config.appOrigin,
      },
      'LiveDrops server started'
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
