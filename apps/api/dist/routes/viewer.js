import { config } from '../config.js';
import { prisma } from '../db/client.js';
import { checkHolderThreshold } from '../services/solana.js';
import { ttsActionSchema, voteActionSchema, publicKeySchema } from '../utils/validation.js';
import { sanitizeTtsMessage } from '../utils/sanitize.js';
import { broadcastToOverlay } from '../websocket.js';
/**
 * Safely parse JSON, returning null on failure
 */
function safeJsonParse(json) {
    try {
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
function getGroupCount(row) {
    const c = row?._count;
    if (typeof c === 'number')
        return c;
    if (c && typeof c === 'object') {
        const v = c._all;
        if (typeof v === 'number')
            return v;
    }
    return 0;
}
function truncateWallet(maybeWallet) {
    if (typeof maybeWallet !== 'string')
        return '';
    if (maybeWallet.length <= 12)
        return maybeWallet;
    return `${maybeWallet.slice(0, 4)}...${maybeWallet.slice(-4)}`;
}
function getMaxTtsLength() {
    const maybe = config?.viewer?.maxTtsMessageLength;
    const n = typeof maybe === 'number' ? maybe : Number.parseInt(String(maybe ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 200;
}
export const viewerRoutes = async (fastify) => {
    /**
     * Basic rate limiting for viewer endpoints
     */
    await fastify.register(import('@fastify/rate-limit'), {
        max: config.rateLimit.action.max,
        timeWindow: config.rateLimit.action.windowMs,
    });
    /**
     * GET /api/viewer/:slug
     * Get public drop info for viewers
     */
    fastify.get('/:slug', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: { slug: request.params.slug },
            include: {
                polls: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' },
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
            const options = safeJsonParse(poll.options) ?? [];
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
                const payload = safeJsonParse(vote.payloadJson);
                if (payload &&
                    payload.pollId === poll.id &&
                    typeof payload.optionIndex === 'number' &&
                    payload.optionIndex >= 0 &&
                    payload.optionIndex < options.length) {
                    voteCounts[payload.optionIndex] += getGroupCount(vote);
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
                tokenMint: drop.tokenMint,
                status: drop.status,
                holderThresholdRaw: drop.holderThresholdRaw,
                bagsUrl: drop.tokenMint ? `https://bags.fm/${drop.tokenMint}` : null,
                poll: pollWithVotes,
                recentTts: recentTts.map((t) => {
                    const payload = safeJsonParse(t.payloadJson);
                    return {
                        id: t.id,
                        viewerWallet: truncateWallet(t.viewerWallet),
                        message: payload?.message ?? '',
                        createdAt: t.createdAt,
                    };
                }),
            },
        };
    });
    /**
     * POST /api/viewer/:slug/check-holding
     * Check if viewer meets holder threshold (public)
     */
    fastify.post('/:slug/check-holding', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: { slug: request.params.slug },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        const walletResult = publicKeySchema.safeParse(request.body.viewerWallet);
        if (!walletResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid viewer wallet',
            });
        }
        if (!drop.tokenMint || drop.status !== 'LAUNCHED') {
            return reply.status(400).send({
                success: false,
                error: 'Drop is not launched yet',
            });
        }
        const meetsThreshold = await checkHolderThreshold(walletResult.data, drop.tokenMint, drop.holderThresholdRaw);
        return {
            success: true,
            data: {
                meetsThreshold,
                requiredAmount: drop.holderThresholdRaw,
            },
        };
    });
    /**
     * POST /api/viewer/:slug/tts
     * Submit a TTS message (public)
     */
    fastify.post('/:slug/tts', async (request, reply) => {
        const walletResult = publicKeySchema.safeParse(request.body.viewerWallet);
        if (!walletResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid viewer wallet',
            });
        }
        const messageResult = ttsActionSchema.safeParse({ message: request.body.message });
        if (!messageResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid input',
                details: messageResult.error.flatten(),
            });
        }
        const drop = await prisma.drop.findFirst({
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
        const meetsThreshold = await checkHolderThreshold(walletResult.data, drop.tokenMint, drop.holderThresholdRaw);
        if (!meetsThreshold) {
            return reply.status(403).send({
                success: false,
                error: 'You need to hold more tokens to send TTS',
                requiredAmount: drop.holderThresholdRaw,
            });
        }
        const sanitizedMessage = sanitizeTtsMessage(messageResult.data.message, getMaxTtsLength());
        if (!sanitizedMessage) {
            return reply.status(400).send({
                success: false,
                error: 'Message was rejected after filtering',
            });
        }
        const action = await prisma.action.create({
            data: {
                dropId: drop.id,
                viewerWallet: walletResult.data,
                type: 'TTS',
                payloadJson: JSON.stringify({ message: sanitizedMessage }),
            },
        });
        broadcastToOverlay(drop.slug, {
            type: 'TTS',
            data: {
                id: action.id,
                viewerWallet: truncateWallet(walletResult.data),
                message: sanitizedMessage,
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
     * Submit a vote (public)
     */
    fastify.post('/:slug/vote', async (request, reply) => {
        const walletResult = publicKeySchema.safeParse(request.body.viewerWallet);
        if (!walletResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid viewer wallet',
            });
        }
        const voteResult = voteActionSchema.safeParse({
            pollId: request.body.pollId,
            optionIndex: request.body.optionIndex,
        });
        if (!voteResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid input',
                details: voteResult.error.flatten(),
            });
        }
        const drop = await prisma.drop.findFirst({
            where: { slug: request.params.slug },
            include: {
                polls: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' },
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
        if (!drop.polls.length) {
            return reply.status(400).send({
                success: false,
                error: 'No active poll',
            });
        }
        const poll = drop.polls[0];
        if (poll.id !== voteResult.data.pollId) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid poll',
            });
        }
        const options = safeJsonParse(poll.options) ?? [];
        if (voteResult.data.optionIndex < 0 || voteResult.data.optionIndex >= options.length) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid option index',
            });
        }
        if (drop.status !== 'LAUNCHED' || !drop.tokenMint) {
            return reply.status(400).send({
                success: false,
                error: 'Drop is not launched yet',
            });
        }
        const meetsThreshold = await checkHolderThreshold(walletResult.data, drop.tokenMint, drop.holderThresholdRaw);
        if (!meetsThreshold) {
            return reply.status(403).send({
                success: false,
                error: 'You need to hold more tokens to vote',
                requiredAmount: drop.holderThresholdRaw,
            });
        }
        const existingVote = await prisma.action.findFirst({
            where: {
                dropId: drop.id,
                viewerWallet: walletResult.data,
                type: 'VOTE',
                payloadJson: {
                    contains: `"pollId":"${voteResult.data.pollId}"`,
                },
            },
        });
        if (existingVote) {
            return reply.status(400).send({
                success: false,
                error: 'You have already voted on this poll',
            });
        }
        const action = await prisma.action.create({
            data: {
                dropId: drop.id,
                viewerWallet: walletResult.data,
                type: 'VOTE',
                payloadJson: JSON.stringify({
                    pollId: voteResult.data.pollId,
                    optionIndex: voteResult.data.optionIndex,
                }),
            },
        });
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
            const payload = safeJsonParse(vote.payloadJson);
            if (payload &&
                payload.pollId === voteResult.data.pollId &&
                typeof payload.optionIndex === 'number' &&
                payload.optionIndex >= 0 &&
                payload.optionIndex < options.length) {
                voteCounts[payload.optionIndex] += getGroupCount(vote);
            }
        }
        broadcastToOverlay(drop.slug, {
            type: 'VOTE',
            data: {
                pollId: voteResult.data.pollId,
                optionIndex: voteResult.data.optionIndex,
                voteCounts,
            },
        });
        return {
            success: true,
            data: {
                actionId: action.id,
                optionIndex: voteResult.data.optionIndex,
                voteCounts,
            },
        };
    });
};
//# sourceMappingURL=viewer.js.map