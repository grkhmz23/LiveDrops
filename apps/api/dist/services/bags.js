import axios from 'axios';
import FormData from 'form-data';
import { config } from '../config.js';
// Bags API base URL (v2 public API)
const BAGS_API_BASE = config.bagsApiBaseUrl;
/**
 * Create token info + metadata (image upload)
 */
export async function createTokenInfoAndMetadata(tokenInfo) {
    try {
        const formData = new FormData();
        formData.append('name', tokenInfo.name);
        formData.append('symbol', tokenInfo.symbol);
        formData.append('description', tokenInfo.description);
        if (tokenInfo.twitter)
            formData.append('twitter', tokenInfo.twitter);
        if (tokenInfo.website)
            formData.append('website', tokenInfo.website);
        if (tokenInfo.telegram)
            formData.append('telegram', tokenInfo.telegram);
        if (tokenInfo.imageUrl)
            formData.append('imageUrl', tokenInfo.imageUrl);
        const response = await axios.post(`${BAGS_API_BASE}/token-launch/create-token-info`, formData, {
            headers: {
                ...formData.getHeaders(),
                'x-api-key': config.bagsApiKey,
            },
        });
        if (!response.data.success) {
            throw new Error('Bags API returned success=false for create-token-info');
        }
        return response.data.response;
    }
    catch (error) {
        console.error('Error creating token info:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to create token info');
    }
}
/**
 * Create fee share config creation transactions (v2)
 */
export async function createFeeShareConfig(payer, baseMint, feeClaimers) {
    if (feeClaimers.length === 0) {
        throw new Error('feeClaimers is required');
    }
    try {
        const body = {
            payer,
            baseMint,
            claimersArray: feeClaimers.map((c) => c.user),
            basisPointsArray: feeClaimers.map((c) => c.userBps),
        };
        const response = await axios.post(`${BAGS_API_BASE}/fee-share/config`, body, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.bagsApiKey,
            },
        });
        if (!response.data.success) {
            throw new Error('Bags API returned success=false for fee-share/config');
        }
        const resp = response.data.response;
        return {
            meteoraConfigKey: resp.meteoraConfigKey,
            transactions: (resp.transactions ?? []).map((t) => t.transaction),
            bundles: resp.bundles?.map((bundle) => bundle.map((t) => t.transaction)),
        };
    }
    catch (error) {
        console.error('Error creating fee share config:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to create fee share config');
    }
}
/**
 * Create token launch transaction
 * Returns base58 serialized transaction string (already signed with token mint)
 */
export async function createLaunchTransaction(request) {
    try {
        const response = await axios.post(`${BAGS_API_BASE}/token-launch/create-launch-transaction`, request, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.bagsApiKey,
            },
        });
        if (!response.data.success) {
            throw new Error('Bags API returned success=false for create-launch-transaction');
        }
        return response.data.response;
    }
    catch (error) {
        console.error('Error creating launch transaction:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to create launch transaction');
    }
}
/**
 * Get all claimable positions for a wallet
 */
export async function getClaimablePositions(wallet) {
    try {
        const response = await axios.get(`${BAGS_API_BASE}/token-launch/claimable-positions`, {
            params: { wallet },
            headers: { 'x-api-key': config.bagsApiKey },
        });
        if (!response.data.success) {
            throw new Error('Bags API returned success=false for claimable-positions');
        }
        return response.data.response;
    }
    catch (error) {
        console.error('Error fetching claimable positions:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch claimable positions');
    }
}
/**
 * Get claim transactions for a claimable position
 */
export async function getClaimTransactions(request) {
    try {
        const response = await axios.post(`${BAGS_API_BASE}/token-launch/claim-txs/v2`, request, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.bagsApiKey,
            },
        });
        if (!response.data.success) {
            throw new Error('Bags API returned success=false for claim-txs/v2');
        }
        return response.data.response;
    }
    catch (error) {
        console.error('Error creating claim transactions:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to create claim transactions');
    }
}
/**
 * Get token lifetime fees
 */
export async function getTokenLifetimeFees(tokenMint) {
    try {
        const response = await axios.get(`${BAGS_API_BASE}/token-launch/lifetime-fees`, {
            params: { tokenMint },
            headers: { 'x-api-key': config.bagsApiKey },
        });
        if (!response.data.success) {
            throw new Error('Bags API returned success=false for lifetime-fees');
        }
        return response.data.response;
    }
    catch (error) {
        console.error('Error fetching token lifetime fees:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch token lifetime fees');
    }
}
/**
 * Get token launch creators
 */
export async function getTokenCreators(tokenMint) {
    try {
        const response = await axios.get(`${BAGS_API_BASE}/token-launch/creator/v3`, {
            params: { tokenMint },
            headers: { 'x-api-key': config.bagsApiKey },
        });
        if (!response.data.success) {
            throw new Error('Bags API returned success=false for creator/v3');
        }
        return response.data.response;
    }
    catch (error) {
        console.error('Error fetching token creators:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to fetch token creators');
    }
}
/**
 * Convenience: build a claim-txs request from a claimable position
 */
export function buildClaimTxRequestFromPosition(feeClaimer, position) {
    const claimVirtual = (position.virtualPoolClaimableLamportsUserShare ?? 0) > 0;
    const claimDamm = (position.dammPoolClaimableLamportsUserShare ?? 0) > 0;
    return {
        feeClaimer,
        tokenMint: position.baseMint,
        virtualPoolAddress: position.virtualPoolAddress,
        dammV2Position: position.dammPositionInfo?.position ?? null,
        dammV2Pool: position.dammPoolAddress ?? position.dammPositionInfo?.pool ?? null,
        dammV2PositionNftAccount: position.dammPositionInfo?.positionNftAccount ?? null,
        tokenAMint: position.dammPositionInfo?.tokenAMint ?? null,
        tokenBMint: position.dammPositionInfo?.tokenBMint ?? null,
        tokenAVault: position.dammPositionInfo?.tokenAVault ?? null,
        tokenBVault: position.dammPositionInfo?.tokenBVault ?? null,
        claimVirtualPoolFees: claimVirtual,
        claimDammV2Fees: claimDamm,
        isCustomFeeVault: !!position.isCustomFeeVault,
        feeShareProgramId: position.programId,
        customFeeVaultClaimerA: position.customFeeVaultClaimerA ?? null,
        customFeeVaultClaimerB: position.customFeeVaultClaimerB ?? null,
        customFeeVaultClaimerSide: position.customFeeVaultClaimerSide ?? null,
    };
}
//# sourceMappingURL=bags.js.map