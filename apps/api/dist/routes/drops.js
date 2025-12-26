import { nanoid } from 'nanoid';
import { prisma } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { createDropSchema, createPollSchema } from '../utils/validation.js';
import * as bags from '../services/bags.js';
import { broadcastToOverlay } from '../websocket.js';
export const dropsRoutes = async (fastify) => {
    // All routes require authentication
    fastify.addHook('preHandler', requireAuth);
    /**
     * GET /api/drops
     * List all drops for current user
     */
    fastify.get('/', async (request) => {
        const drops = await prisma.drop.findMany({
            where: { ownerUserId: request.userId },
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { actions: true, claims: true },
                },
            },
        });
        return {
            success: true,
            data: drops.map((drop) => ({
                id: drop.id,
                slug: drop.slug,
                name: drop.name,
                symbol: drop.symbol,
                description: drop.description,
                imageUrl: drop.imageUrl,
                tokenMint: drop.tokenMint,
                tokenMetadataUrl: drop.tokenMetadataUrl,
                configKey: drop.configKey,
                launchSig: drop.launchSig,
                status: drop.status,
                prizePoolWallet: drop.prizePoolWallet,
                streamerBps: drop.streamerBps,
                prizePoolBps: drop.prizePoolBps,
                holderThresholdRaw: drop.holderThresholdRaw,
                initialBuyLamports: drop.initialBuyLamports,
                twitterUrl: drop.twitterUrl,
                websiteUrl: drop.websiteUrl,
                telegramUrl: drop.telegramUrl,
                createdAt: drop.createdAt,
                updatedAt: drop.updatedAt,
                actionCount: drop._count.actions,
                claimCount: drop._count.claims,
            })),
        };
    });
    /**
     * GET /api/drops/:slug
     * Get a specific drop
     */
    fastify.get('/:slug', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
            include: {
                polls: {
                    orderBy: { createdAt: 'desc' },
                },
                _count: {
                    select: { actions: true, claims: true },
                },
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        // Get recent actions
        const recentActions = await prisma.action.findMany({
            where: { dropId: drop.id },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        // Get claims
        const claims = await prisma.claim.findMany({
            where: { dropId: drop.id },
            orderBy: { createdAt: 'desc' },
        });
        return {
            success: true,
            data: {
                ...drop,
                actionCount: drop._count.actions,
                claimCount: drop._count.claims,
                recentActions: recentActions.map((a) => ({
                    id: a.id,
                    type: a.type,
                    viewerWallet: a.viewerWallet,
                    payload: JSON.parse(a.payloadJson),
                    createdAt: a.createdAt,
                })),
                claims: claims.map((c) => ({
                    id: c.id,
                    signatures: JSON.parse(c.signaturesJson),
                    createdAt: c.createdAt,
                })),
                polls: drop.polls.map((p) => ({
                    id: p.id,
                    question: p.question,
                    options: JSON.parse(p.options),
                    isActive: p.isActive,
                    createdAt: p.createdAt,
                })),
            },
        };
    });
    /**
     * POST /api/drops
     * Create a new drop (DRAFT status)
     */
    fastify.post('/', async (request, reply) => {
        const parseResult = createDropSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid input',
                details: parseResult.error.flatten(),
            });
        }
        const data = parseResult.data;
        // Generate unique slug
        const slug = `${data.symbol.toLowerCase()}-${nanoid(8)}`;
        const drop = await prisma.drop.create({
            data: {
                slug,
                ownerUserId: request.userId,
                name: data.name,
                symbol: data.symbol,
                description: data.description,
                prizePoolWallet: data.prizePoolWallet,
                streamerBps: data.streamerBps,
                prizePoolBps: data.prizePoolBps,
                holderThresholdRaw: data.holderThresholdRaw,
                initialBuyLamports: data.initialBuyLamports,
                twitterUrl: data.twitterUrl,
                websiteUrl: data.websiteUrl,
                telegramUrl: data.telegramUrl,
                imageUrl: data.imageUrl,
                status: 'DRAFT',
            },
        });
        return {
            success: true,
            data: {
                id: drop.id,
                slug: drop.slug,
                status: drop.status,
            },
        };
    });
    /**
     * POST /api/drops/:slug/create-token-info
     * Step 1: Create token info and metadata via Bags API
     */
    fastify.post('/:slug/create-token-info', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        if (drop.status !== 'DRAFT') {
            return reply.status(400).send({
                success: false,
                error: `Cannot create token info: drop is already in ${drop.status} status`,
            });
        }
        try {
            // Call Bags API to create token info
            const result = await bags.createTokenInfoAndMetadata({
                name: drop.name,
                symbol: drop.symbol,
                description: drop.description,
                imageUrl: drop.imageUrl || undefined,
                twitter: drop.twitterUrl || undefined,
                website: drop.websiteUrl || undefined,
                telegram: drop.telegramUrl || undefined,
            });
            // Update drop with token info
            await prisma.drop.update({
                where: { id: drop.id },
                data: {
                    tokenMint: result.tokenMint,
                    tokenMetadataUrl: result.tokenMetadata,
                    status: 'TOKEN_INFO_CREATED',
                },
            });
            return {
                success: true,
                data: {
                    tokenMint: result.tokenMint,
                    tokenMetadataUrl: result.tokenMetadata,
                    status: 'TOKEN_INFO_CREATED',
                },
            };
        }
        catch (error) {
            console.error('Error creating token info:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create token info',
            });
        }
    });
    /**
     * POST /api/drops/:slug/create-fee-config
     * Step 2: Create fee share configuration
     * Returns transactions for client to sign
     */
    fastify.post('/:slug/create-fee-config', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        if (drop.status !== 'TOKEN_INFO_CREATED') {
            return reply.status(400).send({
                success: false,
                error: `Cannot create fee config: drop is in ${drop.status} status`,
            });
        }
        if (!drop.tokenMint) {
            return reply.status(400).send({
                success: false,
                error: 'Drop missing tokenMint',
            });
        }
        try {
            const creatorWallet = request.walletPubkey;
            // Build fee claimers array matching bags.ts FeeClaimer interface
            const feeClaimers = [
                { user: creatorWallet, userBps: drop.streamerBps },
                { user: drop.prizePoolWallet, userBps: drop.prizePoolBps },
            ];
            // Create fee config via Bags API (correct signature: payer, baseMint, feeClaimers)
            const result = await bags.createFeeShareConfig(creatorWallet, // payer
            drop.tokenMint, // baseMint
            feeClaimers // feeClaimers array
            );
            // Save configKey (transactions are signed client-side)
            await prisma.drop.update({
                where: { id: drop.id },
                data: {
                    configKey: result.meteoraConfigKey,
                },
            });
            return {
                success: true,
                data: {
                    configKey: result.meteoraConfigKey,
                    transactions: result.transactions,
                    bundles: result.bundles,
                },
            };
        }
        catch (error) {
            console.error('Error creating fee config:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create fee config',
            });
        }
    });
    /**
     * POST /api/drops/:slug/confirm-fee-config
     * Step 2b: Confirm fee config transactions were submitted
     */
    fastify.post('/:slug/confirm-fee-config', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        if (drop.status !== 'TOKEN_INFO_CREATED') {
            return reply.status(400).send({
                success: false,
                error: `Cannot confirm fee config: drop is in ${drop.status} status`,
            });
        }
        if (!drop.configKey) {
            return reply.status(400).send({
                success: false,
                error: 'Drop missing configKey',
            });
        }
        // Mark status
        await prisma.drop.update({
            where: { id: drop.id },
            data: {
                status: 'CONFIG_CREATED',
            },
        });
        broadcastToOverlay(drop.slug, {
            type: 'THRESHOLD_UPDATED',
            data: {
                status: 'CONFIG_CREATED',
            },
        });
        return {
            success: true,
            data: { status: 'CONFIG_CREATED' },
        };
    });
    /**
     * POST /api/drops/:slug/create-launch-tx
     * Step 3: Create launch transaction via Bags API
     */
    fastify.post('/:slug/create-launch-tx', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        if (drop.status !== 'CONFIG_CREATED') {
            return reply.status(400).send({
                success: false,
                error: `Cannot create launch tx: drop is in ${drop.status} status`,
            });
        }
        if (!drop.tokenMint || !drop.tokenMetadataUrl || !drop.configKey) {
            return reply.status(400).send({
                success: false,
                error: 'Drop missing tokenMint, tokenMetadataUrl, or configKey',
            });
        }
        try {
            const creatorWallet = request.walletPubkey;
            // Call bags.createLaunchTransaction with correct interface
            const transaction = await bags.createLaunchTransaction({
                ipfs: drop.tokenMetadataUrl, // IPFS metadata URL
                tokenMint: drop.tokenMint,
                wallet: creatorWallet,
                initialBuyLamports: parseInt(drop.initialBuyLamports, 10) || 0, // Must be number
                configKey: drop.configKey,
            });
            return {
                success: true,
                data: {
                    transaction, // base58 serialized tx
                },
            };
        }
        catch (error) {
            console.error('Error creating launch tx:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create launch transaction',
            });
        }
    });
    /**
     * POST /api/drops/:slug/confirm-launch
     * Confirm launch was submitted
     */
    fastify.post('/:slug/confirm-launch', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        if (drop.status !== 'CONFIG_CREATED') {
            return reply.status(400).send({
                success: false,
                error: `Cannot confirm launch: drop is in ${drop.status} status`,
            });
        }
        const updated = await prisma.drop.update({
            where: { id: drop.id },
            data: {
                launchSig: request.body.signature,
                status: 'LAUNCHED',
            },
        });
        broadcastToOverlay(drop.slug, {
            type: 'DROP_LAUNCHED',
            data: {
                slug: updated.slug,
                tokenMint: updated.tokenMint,
                launchSig: updated.launchSig,
            },
        });
        return {
            success: true,
            data: {
                status: updated.status,
                launchSig: updated.launchSig,
            },
        };
    });
    /**
     * POST /api/drops/:slug/polls
     * Create a new poll
     */
    fastify.post('/:slug/polls', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        const parseResult = createPollSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({
                success: false,
                error: 'Invalid input',
                details: parseResult.error.flatten(),
            });
        }
        const poll = await prisma.poll.create({
            data: {
                dropId: drop.id,
                question: parseResult.data.question,
                options: JSON.stringify(parseResult.data.options),
                isActive: true,
            },
        });
        broadcastToOverlay(drop.slug, {
            type: 'POLL_CREATED',
            data: {
                id: poll.id,
                question: poll.question,
                options: JSON.parse(poll.options),
                isActive: poll.isActive,
                createdAt: poll.createdAt,
            },
        });
        return {
            success: true,
            data: poll,
        };
    });
    /**
     * POST /api/drops/:slug/polls/:pollId/close
     * Close an active poll
     */
    fastify.post('/:slug/polls/:pollId/close', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        const poll = await prisma.poll.findFirst({
            where: {
                id: request.params.pollId,
                dropId: drop.id,
                isActive: true,
            },
        });
        if (!poll) {
            return reply.status(404).send({
                success: false,
                error: 'Poll not found or already closed',
            });
        }
        const updated = await prisma.poll.update({
            where: { id: poll.id },
            data: { isActive: false },
        });
        broadcastToOverlay(drop.slug, {
            type: 'POLL_CLOSED',
            data: {
                id: updated.id,
                isActive: updated.isActive,
            },
        });
        return {
            success: true,
            data: updated,
        };
    });
    /**
     * GET /api/drops/:slug/claimable
     * Get claimable positions for fees
     */
    fastify.get('/:slug/claimable', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        if (!drop.tokenMint) {
            return reply.status(400).send({
                success: false,
                error: 'Drop missing tokenMint',
            });
        }
        try {
            const wallet = request.walletPubkey;
            const positions = await bags.getClaimablePositions(wallet);
            // Filter by baseMint (not tokenMint - that's the field name in ClaimablePosition)
            const tokenPositions = positions.filter((p) => p.baseMint === drop.tokenMint);
            // Calculate total claimable
            let totalClaimableLamports = BigInt(0);
            for (const pos of tokenPositions) {
                if (pos.totalClaimableLamportsUserShare) {
                    totalClaimableLamports += BigInt(pos.totalClaimableLamportsUserShare);
                }
            }
            return {
                success: true,
                data: {
                    positions: tokenPositions,
                    totalClaimableLamports: totalClaimableLamports.toString(),
                },
            };
        }
        catch (error) {
            console.error('Error getting claimable positions:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get claimable positions',
            });
        }
    });
    /**
     * POST /api/drops/:slug/claim
     * Create claim transactions for a specific position
     */
    fastify.post('/:slug/claim', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        if (!drop.tokenMint) {
            return reply.status(400).send({
                success: false,
                error: 'Drop missing tokenMint',
            });
        }
        const { position } = request.body;
        if (!position) {
            return reply.status(400).send({
                success: false,
                error: 'position is required',
            });
        }
        try {
            const wallet = request.walletPubkey;
            // Build claim request from position using helper
            const claimRequest = bags.buildClaimTxRequestFromPosition(wallet, position);
            // Get claim transactions
            const txResponses = await bags.getClaimTransactions(claimRequest);
            // Extract just the transaction strings
            const transactions = txResponses.map((t) => t.tx);
            return {
                success: true,
                data: {
                    transactions,
                },
            };
        }
        catch (error) {
            console.error('Error creating claim transactions:', error);
            return reply.status(500).send({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create claim transactions',
            });
        }
    });
    /**
     * POST /api/drops/:slug/confirm-claim
     * Record successful claim
     */
    fastify.post('/:slug/confirm-claim', async (request, reply) => {
        const drop = await prisma.drop.findFirst({
            where: {
                slug: request.params.slug,
                ownerUserId: request.userId,
            },
        });
        if (!drop) {
            return reply.status(404).send({
                success: false,
                error: 'Drop not found',
            });
        }
        const claim = await prisma.claim.create({
            data: {
                dropId: drop.id,
                signaturesJson: JSON.stringify(request.body.signatures),
            },
        });
        return {
            success: true,
            data: claim,
        };
    });
};
//# sourceMappingURL=drops.js.map