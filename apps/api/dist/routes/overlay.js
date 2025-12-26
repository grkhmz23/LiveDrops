import { prisma } from '../db/client.js';
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
export const overlayRoutes = async (fastify) => {
    /**
     * GET /api/overlay/:slug
     * Get overlay data for OBS (public)
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
        return {
            success: true,
            data: {
                slug: drop.slug,
                name: drop.name,
                symbol: drop.symbol,
                tokenMint: drop.tokenMint,
                status: drop.status,
                // NOTE: verify Bags URL path if needed
                bagsUrl: drop.tokenMint ? `https://bags.fm/${drop.tokenMint}` : null,
                poll: pollWithVotes,
                ttsQueue: ttsQueue.map((t) => {
                    const payload = safeJsonParse(t.payloadJson);
                    return {
                        id: t.id,
                        viewerWallet: t.viewerWallet,
                        message: payload?.message ?? '',
                        createdAt: t.createdAt,
                    };
                }),
            },
        };
    });
    /**
     * GET /api/overlay/:slug/poll
     * Get current poll state (public)
     */
    fastify.get('/:slug/poll', async (request, reply) => {
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
        if (drop.polls.length === 0) {
            return {
                success: true,
                data: null,
            };
        }
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
//# sourceMappingURL=overlay.js.map