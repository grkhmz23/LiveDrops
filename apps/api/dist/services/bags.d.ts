/**
 * Create Token Info and Metadata request/response
 * Docs: POST /token-launch/create-token-info
 */
export interface CreateTokenInfoRequest {
    name: string;
    symbol: string;
    description: string;
    twitter?: string;
    website?: string;
    telegram?: string;
    imageUrl?: string;
}
export interface CreateTokenInfoResponse {
    tokenMint: string;
    tokenMetadata: string;
    image: string;
}
/**
 * Fee Share Config (v2) creation txs
 * Docs: POST /fee-share/config
 */
export interface FeeClaimer {
    user: string;
    userBps: number;
}
export interface FeeShareConfigResponse {
    meteoraConfigKey: string;
    transactions: Array<{
        blockhash: {
            blockhash: string;
            lastValidBlockHeight: number;
        };
        transaction: string;
    }>;
    bundles?: Array<Array<{
        blockhash: {
            blockhash: string;
            lastValidBlockHeight: number;
        };
        transaction: string;
    }>>;
}
/**
 * Create Token Launch Transaction
 * Docs: POST /token-launch/create-launch-transaction
 */
export interface CreateLaunchTransactionRequest {
    ipfs: string;
    tokenMint: string;
    wallet: string;
    initialBuyLamports: number;
    configKey: string;
    tipWallet?: string;
    tipLamports?: number;
}
export interface ClaimablePosition {
    isCustomFeeVault: boolean;
    baseMint: string;
    isMigrated: boolean;
    totalClaimableLamportsUserShare: number;
    programId: string;
    quoteMint: string;
    virtualPool: string;
    virtualPoolAddress: string | null;
    virtualPoolClaimableAmount: number;
    virtualPoolClaimableLamportsUserShare: number;
    dammPoolClaimableAmount: number;
    dammPoolClaimableLamportsUserShare: number;
    dammPoolAddress: string | null;
    dammPositionInfo: {
        position: string | null;
        pool: string | null;
        positionNftAccount: string | null;
        tokenAMint: string | null;
        tokenBMint: string | null;
        tokenAVault: string | null;
        tokenBVault: string | null;
    } | null;
    claimableDisplayAmount: number;
    user: string;
    claimerIndex: number;
    userBps: number;
    customFeeVault: string | null;
    customFeeVaultClaimerA: string | null;
    customFeeVaultClaimerB: string | null;
    customFeeVaultClaimerSide: 'A' | 'B' | null;
}
export interface ClaimTxRequest {
    feeClaimer: string;
    tokenMint: string;
    virtualPoolAddress: string | null;
    dammV2Position: string | null;
    dammV2Pool: string | null;
    dammV2PositionNftAccount: string | null;
    tokenAMint: string | null;
    tokenBMint: string | null;
    tokenAVault: string | null;
    tokenBVault: string | null;
    claimVirtualPoolFees: boolean;
    claimDammV2Fees: boolean;
    isCustomFeeVault: boolean;
    feeShareProgramId: string;
    customFeeVaultClaimerA: string | null;
    customFeeVaultClaimerB: string | null;
    customFeeVaultClaimerSide: 'A' | 'B' | null;
}
export interface ClaimTxResponseItem {
    tx: string;
    blockhash: {
        blockhash: string;
        lastValidBlockHeight: number;
    };
}
/**
 * Get Token Launch Creators & Lifetime Fees
 */
export interface TokenCreator {
    username?: string;
    pfp?: string;
    royaltyBps?: number;
    isCreator?: boolean;
    wallet: string;
    provider?: string;
    providerUsername?: string;
}
/**
 * Create token info + metadata (image upload)
 */
export declare function createTokenInfoAndMetadata(tokenInfo: CreateTokenInfoRequest): Promise<CreateTokenInfoResponse>;
/**
 * Create fee share config creation transactions (v2)
 */
export declare function createFeeShareConfig(payer: string, baseMint: string, feeClaimers: FeeClaimer[]): Promise<{
    meteoraConfigKey: string;
    transactions: string[];
    bundles?: string[][];
}>;
/**
 * Create token launch transaction
 * Returns base58 serialized transaction string (already signed with token mint)
 */
export declare function createLaunchTransaction(request: CreateLaunchTransactionRequest): Promise<string>;
/**
 * Get all claimable positions for a wallet
 */
export declare function getClaimablePositions(wallet: string): Promise<ClaimablePosition[]>;
/**
 * Get claim transactions for a claimable position
 */
export declare function getClaimTransactions(request: ClaimTxRequest): Promise<ClaimTxResponseItem[]>;
/**
 * Get token lifetime fees
 */
export declare function getTokenLifetimeFees(tokenMint: string): Promise<string>;
/**
 * Get token launch creators
 */
export declare function getTokenCreators(tokenMint: string): Promise<TokenCreator[]>;
/**
 * Convenience: build a claim-txs request from a claimable position
 */
export declare function buildClaimTxRequestFromPosition(feeClaimer: string, position: ClaimablePosition): ClaimTxRequest;
//# sourceMappingURL=bags.d.ts.map