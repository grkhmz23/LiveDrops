import { FastifyPluginAsync } from 'fastify';
import { nanoid } from 'nanoid';
import { prisma } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { createDropSchema, createPollSchema, isValidPublicKey } from '../utils/validation.js';
import * as bags from '../services/bags.js';
import { broadcastToOverlay } from '../websocket.js';

export const dropsRoutes: FastifyPluginAsync = async (fastify) => {
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
      data: drops.map(drop => ({
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
  fastify.get<{
    Params: { slug: string };
  }>('/:slug', async (request, reply) => {
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
        recentActions: recentActions.map(a => ({
          id: a.id,
          type: a.type,
          viewerWallet: a.viewerWallet,
          payload: JSON.parse(a.payloadJson),
          createdAt: a.createdAt,
        })),
        claims: claims.map(c => ({
          id: c.id,
          signatures: JSON.parse(c.signaturesJson),
          createdAt: c.createdAt,
        })),
        polls: drop.polls.map(p => ({
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
  fastify.post<{
    Body: unknown;
  }>('/', async (request, reply) => {
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
        ownerUserId: request.userId!,
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
  fastify.post<{
    Params: { slug: string };
  }>('/:slug/create-token-info', async (request, reply) => {
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
    } catch (error) {
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
  fastify.post<{
    Params: { slug: string };
  }>('/:slug/create-fee-config', async (request, reply) => {
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
        error: `Cannot create fee config: drop status is ${drop.status}, expected TOKEN_INFO_CREATED`,
      });
    }

    if (!drop.tokenMint) {
      return reply.status(400).send({
        success: false,
        error: 'Token mint not found. Please create token info first.',
      });
    }

    try {
      // Build fee claimers array
      const feeClaimers: bags.FeeClaimer[] = [
        { user: request.walletPubkey!, userBps: drop.streamerBps },
        { user: drop.prizePoolWallet, userBps: drop.prizePoolBps },
      ];

      // Call Bags API to create fee config
      const result = await bags.createFeeShareConfig(
        request.walletPubkey!,
        drop.tokenMint,
        feeClaimers
      );

      return {
        success: true,
        data: {
          configKey: result.meteoraConfigKey,
          transactions: result.transactions,
          bundles: result.bundles,
        },
      };
    } catch (error) {
      console.error('Error creating fee config:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create fee config',
      });
    }
  });

  /**
   * POST /api/drops/:slug/confirm-fee-config
   * Confirm that fee config transactions were sent
   */
  fastify.post<{
    Params: { slug: string };
    Body: { configKey: string; signatures: string[] };
  }>('/:slug/confirm-fee-config', async (request, reply) => {
    const { configKey, signatures } = request.body;

    if (!configKey || !signatures || !Array.isArray(signatures)) {
      return reply.status(400).send({
        success: false,
        error: 'configKey and signatures are required',
      });
    }

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
        error: `Cannot confirm fee config: drop status is ${drop.status}`,
      });
    }

    // Update drop with config key
    await prisma.drop.update({
      where: { id: drop.id },
      data: {
        configKey,
        status: 'CONFIG_CREATED',
      },
    });

    return {
      success: true,
      data: {
        status: 'CONFIG_CREATED',
        configKey,
      },
    };
  });

  /**
   * POST /api/drops/:slug/create-launch-tx
   * Step 3: Create the launch transaction
   * Returns transaction for client to sign
   */
  fastify.post<{
    Params: { slug: string };
  }>('/:slug/create-launch-tx', async (request, reply) => {
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
        error: `Cannot create launch tx: drop status is ${drop.status}, expected CONFIG_CREATED`,
      });
    }

    if (!drop.tokenMint || !drop.tokenMetadataUrl || !drop.configKey) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required data. Please complete previous steps.',
      });
    }

    try {
      const tx = await bags.createLaunchTransaction({
        ipfs: drop.tokenMetadataUrl,
        tokenMint: drop.tokenMint,
        wallet: request.walletPubkey!,
        initialBuyLamports: parseInt(drop.initialBuyLamports, 10),
        configKey: drop.configKey,
      });

      return {
        success: true,
        data: {
          transaction: tx,
        },
      };
    } catch (error) {
      console.error('Error creating launch transaction:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create launch transaction',
      });
    }
  });

  /**
   * POST /api/drops/:slug/confirm-launch
   * Confirm that launch transaction was sent
   */
  fastify.post<{
    Params: { slug: string };
    Body: { signature: string };
  }>('/:slug/confirm-launch', async (request, reply) => {
    const { signature } = request.body;

    if (!signature) {
      return reply.status(400).send({
        success: false,
        error: 'signature is required',
      });
    }

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
        error: `Cannot confirm launch: drop status is ${drop.status}`,
      });
    }

    // Update drop with launch signature
    await prisma.drop.update({
      where: { id: drop.id },
      data: {
        launchSig: signature,
        status: 'LAUNCHED',
      },
    });

    // Broadcast to overlay
    broadcastToOverlay(drop.slug, {
      type: 'DROP_LAUNCHED',
      data: {
        tokenMint: drop.tokenMint,
        launchSig: signature,
      },
    });

    return {
      success: true,
      data: {
        status: 'LAUNCHED',
        launchSig: signature,
        tokenMint: drop.tokenMint,
        viewerUrl: `/d/${drop.slug}`,
        overlayUrl: `/overlay/${drop.slug}`,
        bagsUrl: `https://bags.fm/${drop.tokenMint}`,
      },
    };
  });

  /**
   * POST /api/drops/:slug/polls
   * Create a new poll for a drop
   */
  fastify.post<{
    Params: { slug: string };
    Body: unknown;
  }>('/:slug/polls', async (request, reply) => {
    const parseResult = createPollSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid input',
        details: parseResult.error.flatten(),
      });
    }

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

    // Deactivate existing polls
    await prisma.poll.updateMany({
      where: { dropId: drop.id, isActive: true },
      data: { isActive: false },
    });

    // Create new poll
    const poll = await prisma.poll.create({
      data: {
        dropId: drop.id,
        question: parseResult.data.question,
        options: JSON.stringify(parseResult.data.options),
        isActive: true,
      },
    });

    // Broadcast to overlay
    broadcastToOverlay(drop.slug, {
      type: 'POLL_CREATED',
      data: {
        pollId: poll.id,
        question: poll.question,
        options: parseResult.data.options,
      },
    });

    return {
      success: true,
      data: {
        id: poll.id,
        question: poll.question,
        options: parseResult.data.options,
        isActive: poll.isActive,
      },
    };
  });

  /**
   * DELETE /api/drops/:slug/polls/:pollId
   * Close a poll
   */
  fastify.delete<{
    Params: { slug: string; pollId: string };
  }>('/:slug/polls/:pollId', async (request, reply) => {
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
      },
    });

    if (!poll) {
      return reply.status(404).send({
        success: false,
        error: 'Poll not found',
      });
    }

    await prisma.poll.update({
      where: { id: poll.id },
      data: { isActive: false },
    });

    // Broadcast to overlay
    broadcastToOverlay(drop.slug, {
      type: 'POLL_CLOSED',
      data: { pollId: poll.id },
    });

    return {
      success: true,
    };
  });

  /**
   * GET /api/drops/:slug/claimable
   * Get claimable positions for this drop
   */
  fastify.get<{
    Params: { slug: string };
  }>('/:slug/claimable', async (request, reply) => {
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

    if (drop.status !== 'LAUNCHED' || !drop.tokenMint) {
      return reply.status(400).send({
        success: false,
        error: 'Drop is not launched',
      });
    }

    try {
      const allPositions = await bags.getClaimablePositions(request.walletPubkey!);
      const positions = allPositions.filter((p) => p.baseMint === drop.tokenMint);

      // Calculate total claimable
      let totalClaimable = BigInt(0);
      for (const pos of positions) {
        if (pos.totalClaimableLamportsUserShare) {
          totalClaimable += BigInt(pos.totalClaimableLamportsUserShare);
        } else if (pos.virtualPoolClaimableLamportsUserShare) {
          totalClaimable += BigInt(pos.virtualPoolClaimableLamportsUserShare);
        }
        if (pos.dammPoolClaimableLamportsUserShare) {
          totalClaimable += BigInt(pos.dammPoolClaimableLamportsUserShare);
        }
      }

      return {
        success: true,
        data: {
          positions,
          totalClaimableLamports: totalClaimable.toString(),
        },
      };
    } catch (error) {
      console.error('Error fetching claimable positions:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch claimable positions',
      });
    }
  });

  /**
   * POST /api/drops/:slug/claim
   * Generate claim transactions for a position
   */
  fastify.post<{
    Params: { slug: string };
    Body: { position: bags.ClaimablePosition };
  }>('/:slug/claim', async (request, reply) => {
    const { position } = request.body;

    if (!position) {
      return reply.status(400).send({
        success: false,
        error: 'position is required',
      });
    }

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

    if (drop.status !== 'LAUNCHED') {
      return reply.status(400).send({
        success: false,
        error: 'Drop is not launched',
      });
    }

    try {
      const claimReq = bags.buildClaimTxRequestFromPosition(request.walletPubkey!, position);
      const txs = await bags.getClaimTransactions(claimReq);
      const transactions = txs.map((t) => t.tx);

      return {
        success: true,
        data: {
          transactions,
        },
      };
    } catch (error) {
      console.error('Error generating claim transactions:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate claim transactions',
      });
    }
  });

  /**
   * POST /api/drops/:slug/confirm-claim
   * Record a successful claim
   */
  fastify.post<{
    Params: { slug: string };
    Body: { signatures: string[] };
  }>('/:slug/confirm-claim', async (request, reply) => {
    const { signatures } = request.body;

    if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'signatures array is required',
      });
    }

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

    // Record the claim
    const claim = await prisma.claim.create({
      data: {
        dropId: drop.id,
        signaturesJson: JSON.stringify(signatures),
      },
    });

    return {
      success: true,
      data: {
        claimId: claim.id,
        signatures,
      },
    };
  });

  /**
   * PUT /api/drops/:slug/threshold
   * Update holder threshold
   */
  fastify.put<{
    Params: { slug: string };
    Body: { holderThresholdRaw: string };
  }>('/:slug/threshold', async (request, reply) => {
    const { holderThresholdRaw } = request.body;

    if (!holderThresholdRaw || !/^\d+$/.test(holderThresholdRaw)) {
      return reply.status(400).send({
        success: false,
        error: 'holderThresholdRaw must be a non-negative integer string',
      });
    }

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

    await prisma.drop.update({
      where: { id: drop.id },
      data: { holderThresholdRaw },
    });

    // Broadcast to overlay
    broadcastToOverlay(drop.slug, {
      type: 'THRESHOLD_UPDATED',
      data: { holderThresholdRaw },
    });

    return {
      success: true,
      data: { holderThresholdRaw },
    };
  });
};
