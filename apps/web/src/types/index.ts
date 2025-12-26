export interface User {
  userId: string;
  walletPubkey: string;
  createdAt: string;
}

export type DropStatus = 'DRAFT' | 'TOKEN_INFO_CREATED' | 'CONFIG_CREATED' | 'LAUNCHED';

export interface Drop {
  id: string;
  slug: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string | null;
  tokenMint: string | null;
  tokenMetadataUrl: string | null;
  configKey: string | null;
  launchSig: string | null;
  status: DropStatus;
  prizePoolWallet: string;
  streamerBps: number;
  prizePoolBps: number;
  holderThresholdRaw: string;
  initialBuyLamports: string;
  twitterUrl: string | null;
  websiteUrl: string | null;
  telegramUrl: string | null;
  createdAt: string;
  updatedAt: string;
  actionCount?: number;
  claimCount?: number;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  isActive: boolean;
  createdAt: string;
}

export interface PollWithVotes {
  id: string;
  question: string;
  options: Array<{ text: string; votes: number }>;
  totalVotes?: number;
}

export interface TtsMessage {
  id: string;
  message: string;
  viewerWallet: string;
  createdAt: string;
}

export interface Action {
  id: string;
  type: 'TTS' | 'VOTE';
  viewerWallet: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Claim {
  id: string;
  signatures: string[];
  createdAt: string;
}

export interface ClaimablePosition {
  // Core identity
  baseMint: string;
  user: string;
  claimerIndex: number;
  userBps: number;

  // Pools / positions
  virtualPoolAddress: string | null;
  virtualPoolClaimableLamportsUserShare: number;
  dammPoolAddress: string | null;
  dammPoolClaimableLamportsUserShare: number;
  totalClaimableLamportsUserShare: number;
  claimableDisplayAmount: number;

  // Required to build claim txs
  isCustomFeeVault: boolean;
  programId: string;
  dammPositionInfo: {
    position: string | null;
    pool: string | null;
    positionNftAccount: string | null;
    tokenAMint: string | null;
    tokenBMint: string | null;
    tokenAVault: string | null;
    tokenBVault: string | null;
  } | null;
  customFeeVaultClaimerA: string | null;
  customFeeVaultClaimerB: string | null;
  customFeeVaultClaimerSide: 'A' | 'B' | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, unknown>;
}

export interface OverlayData {
  name: string;
  symbol: string;
  tokenMint: string | null;
  status: DropStatus;
  holderThresholdRaw: string;
  imageUrl: string | null;
  bagsUrl: string | null;
  poll: PollWithVotes | null;
  ttsQueue: TtsMessage[];
  counts: {
    tts: number;
    votes: number;
  };
}

export interface ViewerData {
  slug: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string | null;
  tokenMint: string | null;
  status: DropStatus;
  holderThresholdRaw: string;
  activePoll: PollWithVotes | null;
  recentTts: TtsMessage[];
  bagsUrl: string | null;
}

export interface WebSocketMessage {
  type: 'CONNECTED' | 'TTS' | 'VOTE' | 'POLL_CREATED' | 'POLL_CLOSED' | 'THRESHOLD_UPDATED' | 'DROP_LAUNCHED' | 'PONG';
  data?: unknown;
}
