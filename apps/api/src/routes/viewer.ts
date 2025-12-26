import { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';
import { prisma } from '../db/client.js';
import { checkHolderThreshold } from '../services/solana.js';
import { ttsActionSchema, voteActionSchema, publicKeySchema } from '../utils/validation.js';
import { sanitizeTtsMessage } from '../utils/sanitize.js';
import { broadcastToOverlay } from '../websocket.js';

export const viewerRoutes: FastifyPluginAsync = async (fastify) => {
  // Rate limit viewer actions
  fastify.register(import('@fastify/rate-limit'), {
    max: config.rateLimit.action.max,
    timeWindow: config.rateLimit.action.windowMs,
    keyGenerator: (request) => {
      // Rate limit by wallet address if provided, otherwise by IP
      const body = request.body as Record<string, unknown>;
      return (body?.viewerWallet as string) || request.ip;
    },
  });

  /**
   * GET /api/viewer/:slug
   * Get public drop info for viewers
   */
  fastify.get<{
    Params: { slug: string };
  }>('/:slug', async (request, reply) => {
    const drop = await prisma.drop.findUnique({
      where: { slug: request.params.slug },
      include: {
        polls: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!drop) {
      return reply.status(404).send({
        success: false,
        error: 'Drop not found',
      });
    }

    // Get vote counts for active poll
    let pollWithVotes = null;
    if (drop.polls.length > 0) {
      const poll = drop.polls[0];
      const options = JSON.parse(poll.options) as string[];
      
      // Get vote counts per option
      const votes = await prisma.action.groupBy({
        by: ['payloadJson'],
        where: {
          dropId: drop.id,
          type: 'VOTE',
        },
        _count: true,
      });

      const voteCounts = new Array(options.length).fill(0);
      for (const vote of votes) {
        try {
          const payload = JSON.parse(vote.payloadJson) as { optionIndex: number };
          if (payload.optionIndex >= 0 && payload.optionIndex < options.length) {
            voteCounts[payload.optionIndex] = vote._count;
          }
        } catch {
          // Ignore invalid vote data
        }
      }

      pollWithVotes = {
        id: poll.id,
        question: poll.question,
        options: options.map((opt, idx) => ({
          text: opt,
          votes: voteCounts[idx],
        })),
      };
    }

    // Get recent TTS messages (last 10)
    const recentTts = await prisma.action.findMany({
      where: {
        dropId: drop.id,
        type: 'TTS',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      success: true,
      data: {
        slug: drop.slug,
        name: drop.name,
        symbol: drop.symbol,
        description: drop.description,
        imageUrl: drop.imageUrl,
        tokenMint: drop.tokenMint,
        status: drop.status,
        holderThresholdRaw: drop.holderThresholdRaw,
        activePoll: pollWithVotes,
        recentTts: recentTts.map(t => {
          const payload = JSON.parse(t.payloadJson) as { message: string };
          return {
            id: t.id,
            message: payload.message,
            viewerWallet: t.viewerWallet.slice(0, 4) + '...' + t.viewerWallet.slice(-4),
            createdAt: t.createdAt,
          };
        }),
        bagsUrl: drop.tokenMint ? `https://bags.fm/${drop.tokenMint}` : null,
      },
    };
  });

  /**
   * POST /api/viewer/:slug/check-holding
   * Check if a wallet holds enough tokens
   */
  fastify.post<{
    Params: { slug: string };
    Body: { viewerWallet: string };
  }>('/:slug/check-holding', async (request, reply) => {
    const walletResult = publicKeySchema.safeParse(request.body.viewerWallet);
    
    if (!walletResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid wallet address',
      });
    }

    const drop = await prisma.drop.findUnique({
      where: { slug: request.params.slug },
    });

    if (!drop) {
      return reply.status(404).send({
        success: false,
        error: 'Drop not found',
      });
    }

    if (drop.status !== 'LAUNCHED' || !drop.tokenMint) {
      return reply.status(400).send({
        success: false,
        error: 'Drop is not launched yet',
      });
    }

    try {
      const meetsThreshold = await checkHolderThreshold(
        request.body.viewerWallet,
        drop.tokenMint,
        drop.holderThresholdRaw
      );

      return {
        success: true,
        data: {
          meetsThreshold,
          requiredAmount: drop.holderThresholdRaw,
          tokenMint: drop.tokenMint,
        },
      };
    } catch (error) {
      console.error('Error checking token balance:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to check token balance',
      });
    }
  });

  /**
   * POST /api/viewer/:slug/tts
   * Submit a TTS message
   */
  fastify.post<{
    Params: { slug: string };
    Body: { viewerWallet: string; message: string };
  }>('/:slug/tts', async (request, reply) => {
    const walletResult = publicKeySchema.safeParse(request.body.viewerWallet);
    const messageResult = ttsActionSchema.safeParse({ message: request.body.message });

    if (!walletResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid wallet address',
      });
    }

    if (!messageResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid message',
        details: messageResult.error.flatten(),
      });
    }

    const drop = await prisma.drop.findUnique({
      where: { slug: request.params.slug },
    });

    if (!drop) {
      return reply.status(404).send({
        success: false,
        error: 'Drop not found',
      });
    }

    if (drop.status !== 'LAUNCHED' || !drop.tokenMint) {
      return reply.status(400).send({
        success: false,
        error: 'Drop is not launched yet',
      });
    }

    // Check if viewer holds enough tokens
    const meetsThreshold = await checkHolderThreshold(
      request.body.viewerWallet,
      drop.tokenMint,
      drop.holderThresholdRaw
    );

    if (!meetsThreshold) {
      return reply.status(403).send({
        success: false,
        error: 'You need to hold more tokens to submit TTS messages',
        requiredAmount: drop.holderThresholdRaw,
      });
    }

    // Sanitize message
    const sanitizedMessage = sanitizeTtsMessage(
      request.body.message,
      config.viewer.maxTtsMessageLength
    );

    if (!sanitizedMessage) {
      return reply.status(400).send({
        success: false,
        error: 'Message was rejected after filtering',
      });
    }

    // Save action
    const action = await prisma.action.create({
      data: {
        dropId: drop.id,
        viewerWallet: request.body.viewerWallet,
        type: 'TTS',
        payloadJson: JSON.stringify({ message: sanitizedMessage }),
      },
    });

    // Broadcast to overlay
    broadcastToOverlay(drop.slug, {
      type: 'TTS',
      data: {
        id: action.id,
        message: sanitizedMessage,
        viewerWallet: request.body.viewerWallet.slice(0, 4) + '...' + request.body.viewerWallet.slice(-4),
        createdAt: action.createdAt,
      },
    });

    return {
      success: true,
      data: {
        actionId: action.id,
        message: sanitizedMessage,
      },
    };
  });

  /**
   * POST /api/viewer/:slug/vote
   * Submit a vote
   */
  fastify.post<{
    Params: { slug: string };
    Body: { viewerWallet: string; pollId: string; optionIndex: number };
  }>('/:slug/vote', async (request, reply) => {
    const walletResult = publicKeySchema.safeParse(request.body.viewerWallet);
    const voteResult = voteActionSchema.safeParse({
      pollId: request.body.pollId,
      optionIndex: request.body.optionIndex,
    });

    if (!walletResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid wallet address',
      });
    }

    if (!voteResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid vote',
        details: voteResult.error.flatten(),
      });
    }

    const drop = await prisma.drop.findUnique({
      where: { slug: request.params.slug },
      include: {
        polls: {
          where: { id: request.body.pollId, isActive: true },
          take: 1,
        },
      },
    });

    if (!drop) {
      return reply.status(404).send({
        success: false,
        error: 'Drop not found',
      });
    }

    if (drop.status !== 'LAUNCHED' || !drop.tokenMint) {
      return reply.status(400).send({
        success: false,
        error: 'Drop is not launched yet',
      });
    }

    if (drop.polls.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Poll not found or not active',
      });
    }

    const poll = drop.polls[0];
    const options = JSON.parse(poll.options) as string[];

    if (request.body.optionIndex < 0 || request.body.optionIndex >= options.length) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid option index',
      });
    }

    // Check if viewer holds enough tokens
    const meetsThreshold = await checkHolderThreshold(
      request.body.viewerWallet,
      drop.tokenMint,
      drop.holderThresholdRaw
    );

    if (!meetsThreshold) {
      return reply.status(403).send({
        success: false,
        error: 'You need to hold more tokens to vote',
        requiredAmount: drop.holderThresholdRaw,
      });
    }

    // Check if user already voted on this poll
    const existingVote = await prisma.action.findFirst({
      where: {
        dropId: drop.id,
        viewerWallet: request.body.viewerWallet,
        type: 'VOTE',
        payloadJson: {
          contains: request.body.pollId,
        },
      },
    });

    if (existingVote) {
      return reply.status(400).send({
        success: false,
        error: 'You have already voted on this poll',
      });
    }

    // Save vote
    const action = await prisma.action.create({
      data: {
        dropId: drop.id,
        viewerWallet: request.body.viewerWallet,
        type: 'VOTE',
        payloadJson: JSON.stringify({
          pollId: request.body.pollId,
          optionIndex: request.body.optionIndex,
        }),
      },
    });

    // Get updated vote counts
    const votes = await prisma.action.groupBy({
      by: ['payloadJson'],
      where: {
        dropId: drop.id,
        type: 'VOTE',
      },
      _count: true,
    });

    const voteCounts = new Array(options.length).fill(0);
    for (const vote of votes) {
      try {
        const payload = JSON.parse(vote.payloadJson) as { optionIndex: number; pollId: string };
        if (payload.pollId === request.body.pollId && payload.optionIndex >= 0 && payload.optionIndex < options.length) {
          voteCounts[payload.optionIndex] = vote._count;
        }
      } catch {
        // Ignore invalid vote data
      }
    }

    // Broadcast to overlay
    broadcastToOverlay(drop.slug, {
      type: 'VOTE',
      data: {
        pollId: request.body.pollId,
        optionIndex: request.body.optionIndex,
        voteCounts,
      },
    });

    return {
      success: true,
      data: {
        actionId: action.id,
        optionIndex: request.body.optionIndex,
        voteCounts,
      },
    };
  });
};
