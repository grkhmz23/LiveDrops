import type { ApiResponse, Drop, User, ViewerData, OverlayData, ClaimablePosition } from '../types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  const data = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !data.success) {
    throw new ApiError(
      response.status,
      data.error || 'Request failed',
      data.details as Record<string, unknown>
    );
  }

  return data.data as T;
}

// Auth endpoints
export const auth = {
  async getNonce(walletPubkey: string): Promise<{ message: string; timestamp: number }> {
    return request(`/auth/nonce?walletPubkey=${encodeURIComponent(walletPubkey)}`);
  },

  async verify(walletPubkey: string, signature: string, message: string): Promise<User> {
    return request('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ walletPubkey, signature, message }),
    });
  },

  async logout(): Promise<void> {
    await request('/auth/logout', { method: 'POST' });
  },

  async me(): Promise<User> {
    return request('/auth/me');
  },
};

// Drops endpoints
export const drops = {
  async list(): Promise<Drop[]> {
    return request('/drops');
  },

  async get(slug: string): Promise<Drop & { recentActions: unknown[]; claims: unknown[]; polls: unknown[] }> {
    return request(`/drops/${slug}`);
  },

  async create(data: {
    name: string;
    symbol: string;
    description: string;
    prizePoolWallet: string;
    streamerBps?: number;
    prizePoolBps?: number;
    holderThresholdRaw?: string;
    initialBuyLamports?: string;
    twitterUrl?: string;
    websiteUrl?: string;
    telegramUrl?: string;
    imageUrl?: string;
  }): Promise<{ id: string; slug: string; status: string }> {
    return request('/drops', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createTokenInfo(slug: string): Promise<{
    tokenMint: string;
    tokenMetadataUrl: string;
    status: string;
  }> {
    return request(`/drops/${slug}/create-token-info`, { method: 'POST' });
  },

  async createFeeConfig(slug: string): Promise<{
    configKey: string;
    transactions: string[];
    bundles?: string[][];
  }> {
    return request(`/drops/${slug}/create-fee-config`, { method: 'POST' });
  },

  async confirmFeeConfig(slug: string, configKey: string, signatures: string[]): Promise<{
    status: string;
    configKey: string;
  }> {
    return request(`/drops/${slug}/confirm-fee-config`, {
      method: 'POST',
      body: JSON.stringify({ configKey, signatures }),
    });
  },

  async createLaunchTx(slug: string): Promise<{ transaction: string }> {
    return request(`/drops/${slug}/create-launch-tx`, { method: 'POST' });
  },

  async confirmLaunch(slug: string, signature: string): Promise<{
    status: string;
    launchSig: string;
    tokenMint: string;
    viewerUrl: string;
    overlayUrl: string;
    bagsUrl: string;
  }> {
    return request(`/drops/${slug}/confirm-launch`, {
      method: 'POST',
      body: JSON.stringify({ signature }),
    });
  },

  async createPoll(slug: string, question: string, options: string[]): Promise<{
    id: string;
    question: string;
    options: string[];
    isActive: boolean;
  }> {
    return request(`/drops/${slug}/polls`, {
      method: 'POST',
      body: JSON.stringify({ question, options }),
    });
  },

  async closePoll(slug: string, pollId: string): Promise<void> {
    await request(`/drops/${slug}/polls/${pollId}`, { method: 'DELETE' });
  },

  async getClaimable(slug: string): Promise<{
    positions: ClaimablePosition[];
    totalClaimableLamports: string;
  }> {
    return request(`/drops/${slug}/claimable`);
  },

  async claim(slug: string, position: ClaimablePosition): Promise<{ transactions: string[] }> {
    return request(`/drops/${slug}/claim`, {
      method: 'POST',
      body: JSON.stringify({ position }),
    });
  },

  async confirmClaim(slug: string, signatures: string[]): Promise<{ claimId: string; signatures: string[] }> {
    return request(`/drops/${slug}/confirm-claim`, {
      method: 'POST',
      body: JSON.stringify({ signatures }),
    });
  },

  async updateThreshold(slug: string, holderThresholdRaw: string): Promise<{ holderThresholdRaw: string }> {
    return request(`/drops/${slug}/threshold`, {
      method: 'PUT',
      body: JSON.stringify({ holderThresholdRaw }),
    });
  },
};

// Viewer endpoints (public)
export const viewer = {
  async get(slug: string): Promise<ViewerData> {
    return request(`/viewer/${slug}`);
  },

  async checkHolding(slug: string, viewerWallet: string): Promise<{
    meetsThreshold: boolean;
    requiredAmount: string;
    tokenMint: string;
  }> {
    return request(`/viewer/${slug}/check-holding`, {
      method: 'POST',
      body: JSON.stringify({ viewerWallet }),
    });
  },

  async submitTts(slug: string, viewerWallet: string, message: string): Promise<{
    actionId: string;
    message: string;
  }> {
    return request(`/viewer/${slug}/tts`, {
      method: 'POST',
      body: JSON.stringify({ viewerWallet, message }),
    });
  },

  async submitVote(slug: string, viewerWallet: string, pollId: string, optionIndex: number): Promise<{
    actionId: string;
    optionIndex: number;
    voteCounts: number[];
  }> {
    return request(`/viewer/${slug}/vote`, {
      method: 'POST',
      body: JSON.stringify({ viewerWallet, pollId, optionIndex }),
    });
  },
};

// Overlay endpoints (public)
export const overlay = {
  async get(slug: string): Promise<OverlayData> {
    return request(`/overlay/${slug}`);
  },
};

export { ApiError };
