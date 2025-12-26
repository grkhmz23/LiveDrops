import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Card, Spinner } from '../components/Layout';
import { viewer as viewerApi, ApiError } from '../lib/api';
import { truncateAddress } from '../lib/solana';
import type { ViewerData, PollWithVotes } from '../types';

export default function ViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { publicKey, connected } = useWallet();
  
  const [data, setData] = useState<ViewerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Holding check
  const [meetsThreshold, setMeetsThreshold] = useState<boolean | null>(null);
  const [isCheckingHolding, setIsCheckingHolding] = useState(false);
  
  // TTS
  const [ttsMessage, setTtsMessage] = useState('');
  const [isSendingTts, setIsSendingTts] = useState(false);
  const [ttsSuccess, setTtsSuccess] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  
  // Vote
  const [isVoting, setIsVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  // Load viewer data
  const loadData = useCallback(async () => {
    if (!slug) return;
    
    try {
      const viewerData = await viewerApi.get(slug);
      setData(viewerData);
    } catch (err) {
      console.error('Failed to load viewer data:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load drop');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadData();
    // Refresh data every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Check holding when wallet connects
  useEffect(() => {
    const checkHolding = async () => {
      if (!slug || !publicKey || !data?.tokenMint) {
        setMeetsThreshold(null);
        return;
      }

      setIsCheckingHolding(true);
      try {
        const result = await viewerApi.checkHolding(slug, publicKey.toBase58());
        setMeetsThreshold(result.meetsThreshold);
      } catch (err) {
        console.error('Failed to check holding:', err);
        setMeetsThreshold(false);
      } finally {
        setIsCheckingHolding(false);
      }
    };

    checkHolding();
  }, [slug, publicKey, data?.tokenMint]);

  // Handle TTS submission
  const handleSendTts = async () => {
    if (!slug || !publicKey || !ttsMessage.trim()) return;
    
    setIsSendingTts(true);
    setTtsError(null);
    setTtsSuccess(false);

    try {
      await viewerApi.submitTts(slug, publicKey.toBase58(), ttsMessage.trim());
      setTtsSuccess(true);
      setTtsMessage('');
      setTimeout(() => setTtsSuccess(false), 3000);
    } catch (err) {
      console.error('TTS submission error:', err);
      setTtsError(err instanceof ApiError ? err.message : 'Failed to send message');
    } finally {
      setIsSendingTts(false);
    }
  };

  // Handle vote
  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!slug || !publicKey) return;
    
    setIsVoting(true);
    setVoteError(null);

    try {
      const result = await viewerApi.submitVote(slug, publicKey.toBase58(), pollId, optionIndex);
      setHasVoted(true);
      
      // Update local poll data
      if (data?.activePoll) {
        const updatedPoll: PollWithVotes = {
          ...data.activePoll,
          options: data.activePoll.options.map((opt, idx) => ({
            ...opt,
            votes: result.voteCounts[idx],
          })),
        };
        setData({ ...data, activePoll: updatedPoll });
      }
    } catch (err) {
      console.error('Vote error:', err);
      setVoteError(err instanceof ApiError ? err.message : 'Failed to vote');
    } finally {
      setIsVoting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <Card>
          <div className="text-center py-8">
            <span className="text-6xl mb-4 block">😢</span>
            <p className="text-red-400">{error || 'Drop not found'}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (data.status !== 'LAUNCHED') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <Card className="max-w-md">
          <div className="text-center py-8">
            <span className="text-6xl mb-4 block">⏳</span>
            <h1 className="text-2xl font-bold mb-2">{data.name}</h1>
            <p className="text-gray-400">This drop hasn't launched yet. Check back soon!</p>
          </div>
        </Card>
      </div>
    );
  }

  const thresholdTokens = parseInt(data.holderThresholdRaw) / 1_000_000;
  const canInteract = meetsThreshold === true;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {data.imageUrl ? (
              <img src={data.imageUrl} alt={data.name} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-xl">🪙</div>
            )}
            <div>
              <h1 className="font-bold">{data.name}</h1>
              <span className="text-sm text-gray-400">${data.symbol}</span>
            </div>
          </div>
          <WalletMultiButton />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Connection Status */}
        {!connected ? (
          <Card>
            <div className="text-center py-8">
              <span className="text-4xl mb-4 block">👛</span>
              <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
              <p className="text-gray-400 mb-4">
                Connect your wallet to participate in TTS and polls.
              </p>
              <WalletMultiButton />
            </div>
          </Card>
        ) : isCheckingHolding ? (
          <Card>
            <div className="flex items-center justify-center py-8 gap-3">
              <Spinner />
              <span className="text-gray-400">Checking token balance...</span>
            </div>
          </Card>
        ) : !meetsThreshold ? (
          <Card>
            <div className="text-center py-8">
              <span className="text-4xl mb-4 block">🔒</span>
              <h2 className="text-xl font-semibold mb-2">Hold Tokens to Participate</h2>
              <p className="text-gray-400 mb-4">
                You need at least <span className="text-white font-semibold">{thresholdTokens}</span> ${data.symbol} tokens to interact.
              </p>
              {data.bagsUrl && (
                <a
                  href={data.bagsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  Buy ${data.symbol} on Bags ↗
                </a>
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* Holding Status */}
            <div className="flex items-center gap-2 text-sm text-green-400">
              <span>✓</span>
              <span>You're eligible to participate!</span>
            </div>

            {/* TTS Form */}
            <Card>
              <h2 className="text-lg font-semibold mb-4">💬 Send TTS Message</h2>
              
              {ttsError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {ttsError}
                </div>
              )}
              
              {ttsSuccess && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
                  Message sent successfully!
                </div>
              )}

              <div className="space-y-3">
                <textarea
                  value={ttsMessage}
                  onChange={(e) => setTtsMessage(e.target.value)}
                  maxLength={200}
                  rows={3}
                  className="input"
                  placeholder="Type your message..."
                  disabled={!canInteract || isSendingTts}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{ttsMessage.length}/200</span>
                  <button
                    onClick={handleSendTts}
                    disabled={!canInteract || isSendingTts || !ttsMessage.trim()}
                    className="btn btn-primary"
                  >
                    {isSendingTts ? (
                      <>
                        <Spinner size="sm" />
                        <span className="ml-2">Sending...</span>
                      </>
                    ) : (
                      'Send Message'
                    )}
                  </button>
                </div>
              </div>
            </Card>

            {/* Poll */}
            {data.activePoll && (
              <Card>
                <h2 className="text-lg font-semibold mb-4">📊 Active Poll</h2>
                <p className="text-gray-300 mb-4">{data.activePoll.question}</p>
                
                {voteError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {voteError}
                  </div>
                )}

                <div className="space-y-2">
                  {data.activePoll.options.map((option, index) => {
                    const totalVotes = data.activePoll!.options.reduce((sum, o) => sum + o.votes, 0);
                    const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleVote(data.activePoll!.id, index)}
                        disabled={hasVoted || isVoting || !canInteract}
                        className={`w-full p-3 rounded-lg text-left transition-colors relative overflow-hidden ${
                          hasVoted
                            ? 'bg-gray-700 cursor-default'
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        {/* Progress bar background */}
                        {hasVoted && (
                          <div
                            className="absolute inset-0 bg-brand-600/30"
                            style={{ width: `${percentage}%` }}
                          />
                        )}
                        <div className="relative flex justify-between items-center">
                          <span>{option.text}</span>
                          {hasVoted && (
                            <span className="text-sm text-gray-400">
                              {option.votes} ({percentage.toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                {hasVoted && (
                  <p className="text-sm text-gray-500 mt-3 text-center">
                    You've voted! Waiting for results...
                  </p>
                )}
              </Card>
            )}
          </>
        )}

        {/* Recent TTS Messages */}
        {data.recentTts.length > 0 && (
          <Card>
            <h2 className="text-lg font-semibold mb-4">📜 Recent Messages</h2>
            <div className="space-y-2">
              {data.recentTts.map((tts) => (
                <div key={tts.id} className="p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs text-gray-400">{tts.viewerWallet}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(tts.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{tts.message}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Buy Token Link */}
        {data.bagsUrl && (
          <div className="text-center">
            <a
              href={data.bagsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:underline text-sm"
            >
              Buy ${data.symbol} on Bags ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
