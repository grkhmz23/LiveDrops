import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { overlay as overlayApi } from '../lib/api';
import type { OverlayData, TtsMessage, PollWithVotes, WebSocketMessage } from '../types';

export default function OverlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<OverlayData | null>(null);
  const [ttsQueue, setTtsQueue] = useState<TtsMessage[]>([]);
  const [currentTts, setCurrentTts] = useState<TtsMessage | null>(null);
  const [poll, setPoll] = useState<PollWithVotes | null>(null);

  // Load initial data
  useEffect(() => {
    if (!slug) return;

    const loadData = async () => {
      try {
        const overlayData = await overlayApi.get(slug);
        setData(overlayData);
        setTtsQueue(overlayData.ttsQueue);
        setPoll(overlayData.poll);
      } catch (err) {
        console.error('Failed to load overlay data:', err);
      }
    };

    loadData();
  }, [slug]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'TTS':
        const tts = message.data as TtsMessage;
        setTtsQueue(prev => [tts, ...prev].slice(0, 5));
        break;
      
      case 'VOTE':
        const voteData = message.data as { pollId: string; optionIndex: number; voteCounts: number[] };
        setPoll(prev => {
          if (!prev || prev.id !== voteData.pollId) return prev;
          return {
            ...prev,
            options: prev.options.map((opt, idx) => ({
              ...opt,
              votes: voteData.voteCounts[idx],
            })),
            totalVotes: voteData.voteCounts.reduce((a, b) => a + b, 0),
          };
        });
        break;
      
      case 'POLL_CREATED':
        const pollData = message.data as { pollId: string; question: string; options: string[] };
        setPoll({
          id: pollData.pollId,
          question: pollData.question,
          options: pollData.options.map(text => ({ text, votes: 0 })),
          totalVotes: 0,
        });
        break;
      
      case 'POLL_CLOSED':
        setPoll(null);
        break;
      
      case 'THRESHOLD_UPDATED':
        // Could update threshold display if needed
        break;
      
      case 'DROP_LAUNCHED':
        // Reload full data
        if (slug) {
          overlayApi.get(slug).then(setData);
        }
        break;
    }
  }, [slug]);

  // WebSocket connection
  const { isConnected } = useWebSocket({
    slug: slug || '',
    onMessage: handleWebSocketMessage,
  });

  // Cycle through TTS messages
  useEffect(() => {
    if (ttsQueue.length === 0) {
      setCurrentTts(null);
      return;
    }

    // Show the first message
    setCurrentTts(ttsQueue[0]);

    // Auto-dismiss after 8 seconds
    const timer = setTimeout(() => {
      setTtsQueue(prev => prev.slice(1));
    }, 8000);

    return () => clearTimeout(timer);
  }, [ttsQueue]);

  if (!data) {
    return (
      <div className="overlay-container bg-transparent">
        {/* Loading state - transparent for OBS */}
      </div>
    );
  }

  if (data.status !== 'LAUNCHED') {
    return (
      <div className="overlay-container bg-transparent flex items-center justify-center">
        <div className="bg-gray-900/90 backdrop-blur rounded-2xl p-8 text-white text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-gray-400">Coming soon...</p>
        </div>
      </div>
    );
  }

  const totalVotes = poll?.options.reduce((sum, opt) => sum + opt.votes, 0) || 0;

  return (
    <div className="overlay-container bg-transparent text-white font-sans">
      {/* Token Info Card - Top Right */}
      <div className="absolute top-8 right-8 w-80">
        <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-gray-700/50">
          <div className="flex items-center gap-3">
            {data.imageUrl ? (
              <img src={data.imageUrl} alt={data.name} className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-2xl">
                🪙
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{data.name}</span>
                <span className="text-gray-400">${data.symbol}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-gray-400">
                  {data.counts.tts} messages • {data.counts.votes} votes
                </span>
              </div>
            </div>
          </div>
          
          {data.bagsUrl && (
            <div className="mt-3 pt-3 border-t border-gray-700/50">
              <div className="text-xs text-gray-400">Buy on bags.fm</div>
              <div className="text-sm font-mono text-purple-400 truncate">
                {data.tokenMint?.slice(0, 20)}...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TTS Message - Bottom Center */}
      {currentTts && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-[800px] animate-pulse-soft">
          <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-purple-500/30">
            <div className="flex items-start gap-4">
              <div className="text-4xl">💬</div>
              <div className="flex-1">
                <div className="text-sm text-purple-400 mb-1">{currentTts.viewerWallet}</div>
                <div className="text-xl font-medium leading-relaxed">{currentTts.message}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Poll - Left Side */}
      {poll && (
        <div className="absolute top-1/2 left-8 -translate-y-1/2 w-96">
          <div className="bg-gray-900/90 backdrop-blur-md rounded-2xl p-6 shadow-2xl border border-gray-700/50">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">📊</span>
              <span className="font-semibold text-lg">Live Poll</span>
            </div>
            <div className="text-lg font-medium mb-4">{poll.question}</div>
            
            <div className="space-y-3">
              {poll.options.map((option, index) => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{option.text}</span>
                      <span className="text-gray-400">{option.votes} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700/50 text-center text-sm text-gray-400">
              {totalVotes} total votes
            </div>
          </div>
        </div>
      )}

      {/* Recent Messages Queue - Right Side Below Token Info */}
      {ttsQueue.length > 1 && (
        <div className="absolute top-36 right-8 w-80 space-y-2">
          <div className="text-xs text-gray-500 mb-2">Queue ({ttsQueue.length - 1})</div>
          {ttsQueue.slice(1, 4).map((tts, index) => (
            <div
              key={tts.id}
              className="bg-gray-900/70 backdrop-blur-sm rounded-lg p-3 text-sm opacity-70"
              style={{ opacity: 1 - index * 0.2 }}
            >
              <div className="text-xs text-gray-500 mb-1">{tts.viewerWallet}</div>
              <div className="line-clamp-2">{tts.message}</div>
            </div>
          ))}
        </div>
      )}

      {/* Instructions - Bottom Right (for setup, can be hidden in production) */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-600 opacity-50">
        OBS: 1920x1080 • LiveDrops Overlay
      </div>
    </div>
  );
}
