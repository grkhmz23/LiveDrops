import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/client.js';

export const overlayRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/overlay/:slug
   * Get overlay data for OBS
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
          if (payload.pollId === poll.id && payload.optionIndex >= 0 && payload.optionIndex < options.length) {
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
        totalVotes: voteCounts.reduce((a, b) => a + b, 0),
      };
    }

    // Get recent TTS queue (last 5)
    const ttsQueue = await prisma.action.findMany({
      where: {
        dropId: drop.id,
        type: 'TTS',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Get total action counts
    const actionCounts = await prisma.action.groupBy({
      by: ['type'],
      where: { dropId: drop.id },
      _count: true,
    });

    const counts = {
      tts: 0,
      votes: 0,
    };
    for (const count of actionCounts) {
      if (count.type === 'TTS') counts.tts = count._count;
      if (count.type === 'VOTE') counts.votes = count._count;
    }

    return {
      success: true,
      data: {
        name: drop.name,
        symbol: drop.symbol,
        tokenMint: drop.tokenMint,
        status: drop.status,
        holderThresholdRaw: drop.holderThresholdRaw,
        imageUrl: drop.imageUrl,
        bagsUrl: drop.tokenMint ? `https://bags.fm/${drop.tokenMint}` : null,
        poll: pollWithVotes,
        ttsQueue: ttsQueue.map(t => {
          const payload = JSON.parse(t.payloadJson) as { message: string };
          return {
            id: t.id,
            message: payload.message,
            viewerWallet: t.viewerWallet.slice(0, 4) + '...' + t.viewerWallet.slice(-4),
            createdAt: t.createdAt,
          };
        }),
        counts,
      },
    };
  });

  /**
   * GET /api/overlay/:slug/tts-queue
   * Get TTS queue only (for polling fallback)
   */
  fastify.get<{
    Params: { slug: string };
    Querystring: { since?: string };
  }>('/:slug/tts-queue', async (request, reply) => {
    const drop = await prisma.drop.findUnique({
      where: { slug: request.params.slug },
    });

    if (!drop) {
      return reply.status(404).send({
        success: false,
        error: 'Drop not found',
      });
    }

    const since = request.query.since ? new Date(request.query.since) : undefined;

    const ttsQueue = await prisma.action.findMany({
      where: {
        dropId: drop.id,
        type: 'TTS',
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      success: true,
      data: ttsQueue.map(t => {
        const payload = JSON.parse(t.payloadJson) as { message: string };
        return {
          id: t.id,
          message: payload.message,
          viewerWallet: t.viewerWallet.slice(0, 4) + '...' + t.viewerWallet.slice(-4),
          createdAt: t.createdAt,
        };
      }),
    };
  });

  /**
   * GET /api/overlay/:slug/poll
   * Get current poll only (for polling fallback)
   */
  fastify.get<{
    Params: { slug: string };
  }>('/:slug/poll', async (request, reply) => {
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

    if (drop.polls.length === 0) {
      return {
        success: true,
        data: null,
      };
    }

    const poll = drop.polls[0];
    const options = JSON.parse(poll.options) as string[];
    
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
        if (payload.pollId === poll.id && payload.optionIndex >= 0 && payload.optionIndex < options.length) {
          voteCounts[payload.optionIndex] = vote._count;
        }
      } catch {
        // Ignore invalid vote data
      }
    }

    return {
      success: true,
      data: {
        id: poll.id,
        question: poll.question,
        options: options.map((opt, idx) => ({
          text: opt,
          votes: voteCounts[idx],
        })),
        totalVotes: voteCounts.reduce((a, b) => a + b, 0),
      },
    };
  });
};
