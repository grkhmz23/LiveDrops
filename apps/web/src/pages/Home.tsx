import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Layout, Card } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';

export default function Home() {
  const navigate = useNavigate();
  const { connected } = useWallet();
  const { isAuthenticated, login, isLoading, error } = useAuth();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Auto-login when wallet connects
  useEffect(() => {
    if (connected && !isAuthenticated && !isLoading) {
      login();
    }
  }, [connected, isAuthenticated, isLoading, login]);

  return (
    <Layout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center">
        <div className="text-8xl mb-6">🎬</div>
        <h1 className="text-5xl font-bold mb-4">
          <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 bg-clip-text text-transparent">
            LiveDrops
          </span>
        </h1>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl">
          Launch access tokens for your stream on Solana with Bags.
          Gate viewer interactions like TTS messages and polls behind token holding.
        </p>

        <Card className="max-w-md w-full">
          <h2 className="text-xl font-semibold mb-4">Get Started</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {!connected ? (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Connect your Solana wallet to create or manage your token drops.
              </p>
              <WalletMultiButton className="w-full justify-center" />
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-brand-500" />
              <span className="ml-3 text-gray-400">Signing in...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Sign the message with your wallet to authenticate.
              </p>
              <button
                onClick={login}
                className="btn btn-primary w-full"
              >
                Sign Message to Login
              </button>
            </div>
          )}
        </Card>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
          <div className="text-center">
            <div className="text-4xl mb-3">🚀</div>
            <h3 className="font-semibold mb-2">Launch Tokens</h3>
            <p className="text-gray-400 text-sm">
              Create access tokens on Bags with custom fee splits between you and a prize pool.
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">📺</div>
            <h3 className="font-semibold mb-2">OBS Overlay</h3>
            <p className="text-gray-400 text-sm">
              Display real-time TTS messages and polls directly in your stream via browser source.
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">💰</div>
            <h3 className="font-semibold mb-2">Claim Fees</h3>
            <p className="text-gray-400 text-sm">
              Collect your share of trading fees directly to your wallet anytime.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
