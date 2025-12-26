import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { Layout, Card, StatusBadge, Spinner } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { drops as dropsApi, ApiError } from '../lib/api';
import { signAndSendTransaction, signAndSendTransactions, lamportsToSol, truncateAddress, getExplorerUrl } from '../lib/solana';
import type { Drop, ClaimablePosition } from '../types';

type LaunchStep = 'idle' | 'creating_token_info' | 'creating_fee_config' | 'signing_fee_config' | 'creating_launch_tx' | 'signing_launch_tx' | 'complete';

export default function DropDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { signTransaction } = useWallet();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [drop, setDrop] = useState<Drop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launchStep, setLaunchStep] = useState<LaunchStep>('idle');
  const [stepError, setStepError] = useState<string | null>(null);
  
  // Claiming state
  const [claimablePositions, setClaimablePositions] = useState<ClaimablePosition[]>([]);
  const [totalClaimable, setTotalClaimable] = useState('0');
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Load drop data
  const loadDrop = useCallback(async () => {
    if (!slug) return;
    
    try {
      const data = await dropsApi.get(slug);
      setDrop(data);
      
      // If launched, load claimable positions
      if (data.status === 'LAUNCHED') {
        try {
          const claimData = await dropsApi.getClaimable(slug);
          setClaimablePositions(claimData.positions);
          setTotalClaimable(claimData.totalClaimableLamports);
        } catch (err) {
          console.error('Failed to load claimable positions:', err);
        }
      }
    } catch (err) {
      console.error('Failed to load drop:', err);
      setError('Failed to load drop');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDrop();
    }
  }, [isAuthenticated, loadDrop]);

  // Step 1: Create token info
  const handleCreateTokenInfo = async () => {
    if (!slug || !drop) return;
    setStepError(null);
    setLaunchStep('creating_token_info');

    try {
      const result = await dropsApi.createTokenInfo(slug);
      setDrop({ ...drop, tokenMint: result.tokenMint, tokenMetadataUrl: result.tokenMetadataUrl, status: 'TOKEN_INFO_CREATED' });
      setLaunchStep('idle');
    } catch (err) {
      console.error('Create token info error:', err);
      setStepError(err instanceof ApiError ? err.message : 'Failed to create token info');
      setLaunchStep('idle');
    }
  };

  // Step 2: Create and sign fee config
  const handleCreateFeeConfig = async () => {
    if (!slug || !drop || !signTransaction) return;
    setStepError(null);
    setLaunchStep('creating_fee_config');

    try {
      // Get fee config transactions from server
      const result = await dropsApi.createFeeConfig(slug);
      
      setLaunchStep('signing_fee_config');
      
      // Sign and send all transactions
      const signatures = await signAndSendTransactions(
        signTransaction,
        result.transactions
      );
      
      // Confirm with server
      await dropsApi.confirmFeeConfig(slug, result.configKey, signatures);
      
      setDrop({ ...drop, configKey: result.configKey, status: 'CONFIG_CREATED' });
      setLaunchStep('idle');
    } catch (err) {
      console.error('Create fee config error:', err);
      setStepError(err instanceof ApiError ? err.message : 'Failed to create fee config');
      setLaunchStep('idle');
    }
  };

  // Step 3: Create and sign launch transaction
  const handleLaunch = async () => {
    if (!slug || !drop || !signTransaction) return;
    setStepError(null);
    setLaunchStep('creating_launch_tx');

    try {
      // Get launch transaction from server
      const result = await dropsApi.createLaunchTx(slug);
      
      setLaunchStep('signing_launch_tx');
      
      // Sign and send
      const signature = await signAndSendTransaction(signTransaction, result.transaction);
      
      // Confirm with server
      const confirmResult = await dropsApi.confirmLaunch(slug, signature);
      
      setDrop({ 
        ...drop, 
        launchSig: confirmResult.launchSig, 
        status: 'LAUNCHED',
        tokenMint: confirmResult.tokenMint 
      });
      setLaunchStep('complete');
      
      // Reload to get full data
      setTimeout(() => loadDrop(), 2000);
    } catch (err) {
      console.error('Launch error:', err);
      setStepError(err instanceof ApiError ? err.message : 'Failed to launch token');
      setLaunchStep('idle');
    }
  };

  // Handle fee claiming
  const handleClaim = async (position: ClaimablePosition) => {
    if (!slug || !signTransaction) return;
    setClaimError(null);
    setIsClaiming(true);

    try {
      // Get claim transactions
      const result = await dropsApi.claim(slug, position);
      
      // Sign and send all claim transactions
      const signatures = await signAndSendTransactions(signTransaction, result.transactions);
      
      // Confirm with server
      await dropsApi.confirmClaim(slug, signatures);
      
      // Reload claimable positions
      await loadDrop();
    } catch (err) {
      console.error('Claim error:', err);
      setClaimError(err instanceof ApiError ? err.message : 'Failed to claim fees');
    } finally {
      setIsClaiming(false);
    }
  };

  // Copy URL helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error || !drop) {
    return (
      <Layout>
        <Card>
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">{error || 'Drop not found'}</p>
            <Link to="/dashboard" className="btn btn-secondary">
              Back to Dashboard
            </Link>
          </div>
        </Card>
      </Layout>
    );
  }

  const appOrigin = window.location.origin;
  const viewerUrl = `${appOrigin}/d/${drop.slug}`;
  const overlayUrl = `${appOrigin}/overlay/${drop.slug}`;
  const bagsUrl = drop.tokenMint ? `https://bags.fm/${drop.tokenMint}` : null;

  return (
    <Layout>
      <div className="mb-6">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          {drop.imageUrl ? (
            <img src={drop.imageUrl} alt={drop.name} className="w-20 h-20 rounded-xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gray-700 flex items-center justify-center text-4xl">🪙</div>
          )}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{drop.name}</h1>
              <span className="text-gray-500 text-xl">${drop.symbol}</span>
              <StatusBadge status={drop.status} />
            </div>
            <p className="text-gray-400">{drop.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Launch Steps */}
          {drop.status !== 'LAUNCHED' && (
            <Card>
              <h2 className="text-xl font-semibold mb-4">Launch Pipeline</h2>
              
              {stepError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {stepError}
                </div>
              )}

              <div className="space-y-4">
                {/* Step 1: Create Token Info */}
                <div className={`p-4 rounded-lg border ${drop.tokenMint ? 'border-green-500/30 bg-green-500/5' : 'border-gray-700 bg-gray-800/50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${drop.tokenMint ? 'bg-green-500' : 'bg-gray-600'}`}>
                          {drop.tokenMint ? '✓' : '1'}
                        </span>
                        <span className="font-medium">Create Token Info</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1 ml-8">
                        Creates the token mint and uploads metadata
                      </p>
                      {drop.tokenMint && (
                        <p className="text-xs text-green-400 mt-1 ml-8">
                          Mint: {truncateAddress(drop.tokenMint, 8)}
                        </p>
                      )}
                    </div>
                    {!drop.tokenMint && (
                      <button
                        onClick={handleCreateTokenInfo}
                        disabled={launchStep !== 'idle'}
                        className="btn btn-primary"
                      >
                        {launchStep === 'creating_token_info' ? (
                          <>
                            <Spinner size="sm" />
                            <span className="ml-2">Creating...</span>
                          </>
                        ) : (
                          'Create Token'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 2: Create Fee Config */}
                <div className={`p-4 rounded-lg border ${drop.configKey ? 'border-green-500/30 bg-green-500/5' : drop.tokenMint ? 'border-gray-700 bg-gray-800/50' : 'border-gray-800 bg-gray-900/50 opacity-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${drop.configKey ? 'bg-green-500' : 'bg-gray-600'}`}>
                          {drop.configKey ? '✓' : '2'}
                        </span>
                        <span className="font-medium">Create Fee Config</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1 ml-8">
                        Sets up fee split: {drop.streamerBps / 100}% you / {drop.prizePoolBps / 100}% prize pool
                      </p>
                      {drop.configKey && (
                        <p className="text-xs text-green-400 mt-1 ml-8">
                          Config: {truncateAddress(drop.configKey, 8)}
                        </p>
                      )}
                    </div>
                    {drop.tokenMint && !drop.configKey && (
                      <button
                        onClick={handleCreateFeeConfig}
                        disabled={launchStep !== 'idle'}
                        className="btn btn-primary"
                      >
                        {launchStep === 'creating_fee_config' ? (
                          <>
                            <Spinner size="sm" />
                            <span className="ml-2">Creating...</span>
                          </>
                        ) : launchStep === 'signing_fee_config' ? (
                          <>
                            <Spinner size="sm" />
                            <span className="ml-2">Sign in wallet...</span>
                          </>
                        ) : (
                          'Create & Sign'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 3: Launch */}
                <div className={`p-4 rounded-lg border ${drop.launchSig ? 'border-green-500/30 bg-green-500/5' : drop.configKey ? 'border-gray-700 bg-gray-800/50' : 'border-gray-800 bg-gray-900/50 opacity-50'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${drop.launchSig ? 'bg-green-500' : 'bg-gray-600'}`}>
                          {drop.launchSig ? '✓' : '3'}
                        </span>
                        <span className="font-medium">Launch Token</span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1 ml-8">
                        Initial buy: {lamportsToSol(drop.initialBuyLamports)} SOL
                      </p>
                      {drop.launchSig && (
                        <a 
                          href={getExplorerUrl(drop.launchSig)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-green-400 mt-1 ml-8 hover:underline block"
                        >
                          TX: {truncateAddress(drop.launchSig, 8)} ↗
                        </a>
                      )}
                    </div>
                    {drop.configKey && !drop.launchSig && (
                      <button
                        onClick={handleLaunch}
                        disabled={launchStep !== 'idle'}
                        className="btn btn-primary"
                      >
                        {launchStep === 'creating_launch_tx' ? (
                          <>
                            <Spinner size="sm" />
                            <span className="ml-2">Preparing...</span>
                          </>
                        ) : launchStep === 'signing_launch_tx' ? (
                          <>
                            <Spinner size="sm" />
                            <span className="ml-2">Sign in wallet...</span>
                          </>
                        ) : (
                          '🚀 Launch!'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* URLs (shown after launch) */}
          {drop.status === 'LAUNCHED' && (
            <Card>
              <h2 className="text-xl font-semibold mb-4">Stream URLs</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400">Viewer Page</label>
                  <div className="flex gap-2 mt-1">
                    <input type="text" readOnly value={viewerUrl} className="input flex-1 font-mono text-sm" />
                    <button onClick={() => copyToClipboard(viewerUrl)} className="btn btn-secondary">Copy</button>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">OBS Overlay (Browser Source: 1920x1080)</label>
                  <div className="flex gap-2 mt-1">
                    <input type="text" readOnly value={overlayUrl} className="input flex-1 font-mono text-sm" />
                    <button onClick={() => copyToClipboard(overlayUrl)} className="btn btn-secondary">Copy</button>
                  </div>
                </div>
                {bagsUrl && (
                  <div>
                    <label className="text-sm text-gray-400">Buy on Bags</label>
                    <div className="flex gap-2 mt-1">
                      <input type="text" readOnly value={bagsUrl} className="input flex-1 font-mono text-sm" />
                      <a href={bagsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">Open ↗</a>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Fee Claiming */}
          {drop.status === 'LAUNCHED' && (
            <Card>
              <h2 className="text-xl font-semibold mb-4">Claim Fees</h2>
              
              {claimError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {claimError}
                </div>
              )}

              {claimablePositions.length === 0 ? (
                <p className="text-gray-400">No claimable fees at this time.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">
                    Total claimable: <span className="text-white font-semibold">{lamportsToSol(totalClaimable)} SOL</span>
                  </p>
                  {claimablePositions.map((position, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Position {index + 1}</p>
                        <p className="text-xs text-gray-400">
                          {position.totalClaimableLamportsUserShare 
                            ? `${lamportsToSol(position.totalClaimableLamportsUserShare)} SOL`
                            : position.virtualPoolClaimableLamportsUserShare
                              ? `${lamportsToSol(position.virtualPoolClaimableLamportsUserShare)} SOL`
                              : '0 SOL'
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => handleClaim(position)}
                        disabled={isClaiming}
                        className="btn btn-primary btn-sm"
                      >
                        {isClaiming ? <Spinner size="sm" /> : 'Claim'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Drop Info */}
          <Card>
            <h3 className="font-semibold mb-4">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <StatusBadge status={drop.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fee Split</span>
                <span>{drop.streamerBps / 100}% / {drop.prizePoolBps / 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Holder Threshold</span>
                <span>{parseInt(drop.holderThresholdRaw) / 1_000_000} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Initial Buy</span>
                <span>{lamportsToSol(drop.initialBuyLamports)} SOL</span>
              </div>
              {drop.tokenMint && (
                <div>
                  <span className="text-gray-400 block mb-1">Token Mint</span>
                  <span className="font-mono text-xs break-all">{drop.tokenMint}</span>
                </div>
              )}
              <div>
                <span className="text-gray-400 block mb-1">Prize Pool Wallet</span>
                <span className="font-mono text-xs break-all">{drop.prizePoolWallet}</span>
              </div>
            </div>
          </Card>

          {/* Social Links */}
          {(drop.twitterUrl || drop.websiteUrl || drop.telegramUrl) && (
            <Card>
              <h3 className="font-semibold mb-4">Links</h3>
              <div className="space-y-2">
                {drop.twitterUrl && (
                  <a href={drop.twitterUrl} target="_blank" rel="noopener noreferrer" className="block text-brand-400 hover:underline text-sm">
                    Twitter ↗
                  </a>
                )}
                {drop.websiteUrl && (
                  <a href={drop.websiteUrl} target="_blank" rel="noopener noreferrer" className="block text-brand-400 hover:underline text-sm">
                    Website ↗
                  </a>
                )}
                {drop.telegramUrl && (
                  <a href={drop.telegramUrl} target="_blank" rel="noopener noreferrer" className="block text-brand-400 hover:underline text-sm">
                    Telegram ↗
                  </a>
                )}
              </div>
            </Card>
          )}

          {/* Quick Actions */}
          {drop.status === 'LAUNCHED' && (
            <Card>
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <a href={viewerUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full text-center block">
                  Open Viewer Page ↗
                </a>
                <a href={overlayUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full text-center block">
                  Open Overlay ↗
                </a>
                {bagsUrl && (
                  <a href={bagsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary w-full text-center block">
                    View on Bags ↗
                  </a>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
