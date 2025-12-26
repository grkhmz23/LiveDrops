import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { Layout, Card, Spinner } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { drops as dropsApi, ApiError } from '../lib/api';
import { solToLamports } from '../lib/solana';

interface FormData {
  name: string;
  symbol: string;
  description: string;
  prizePoolWallet: string;
  streamerPercent: number;
  holderThreshold: string;
  initialBuySol: string;
  imageUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  telegramUrl: string;
}

const initialFormData: FormData = {
  name: '',
  symbol: '',
  description: '',
  prizePoolWallet: '',
  streamerPercent: 50,
  holderThreshold: '0',
  initialBuySol: '0.01',
  imageUrl: '',
  twitterUrl: '',
  websiteUrl: '',
  telegramUrl: '',
};

export default function CreateDrop() {
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleStreamerPercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
    setFormData((prev) => ({ ...prev, streamerPercent: value }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.length > 32) {
      errors.name = 'Name must be 32 characters or less';
    }

    if (!formData.symbol.trim()) {
      errors.symbol = 'Symbol is required';
    } else if (formData.symbol.length > 10) {
      errors.symbol = 'Symbol must be 10 characters or less';
    } else if (!/^[A-Za-z0-9]+$/.test(formData.symbol)) {
      errors.symbol = 'Symbol can only contain letters and numbers';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.length > 500) {
      errors.description = 'Description must be 500 characters or less';
    }

    if (!formData.prizePoolWallet.trim()) {
      errors.prizePoolWallet = 'Prize pool wallet is required';
    } else if (formData.prizePoolWallet.length < 32 || formData.prizePoolWallet.length > 44) {
      errors.prizePoolWallet = 'Invalid Solana address';
    }

    const initialBuy = parseFloat(formData.initialBuySol);
    if (isNaN(initialBuy) || initialBuy < 0) {
      errors.initialBuySol = 'Invalid SOL amount';
    }

    if (formData.imageUrl && !formData.imageUrl.startsWith('http')) {
      errors.imageUrl = 'Image URL must start with http:// or https://';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const streamerBps = formData.streamerPercent * 100;
      const prizePoolBps = (100 - formData.streamerPercent) * 100;
      
      // Convert holder threshold to base units (assuming 6 decimals)
      const thresholdFloat = parseFloat(formData.holderThreshold) || 0;
      const holderThresholdRaw = Math.floor(thresholdFloat * 1_000_000).toString();

      const initialBuyLamports = solToLamports(parseFloat(formData.initialBuySol) || 0);

      const result = await dropsApi.create({
        name: formData.name.trim(),
        symbol: formData.symbol.trim().toUpperCase(),
        description: formData.description.trim(),
        prizePoolWallet: formData.prizePoolWallet.trim(),
        streamerBps,
        prizePoolBps,
        holderThresholdRaw,
        initialBuyLamports,
        imageUrl: formData.imageUrl.trim() || undefined,
        twitterUrl: formData.twitterUrl.trim() || undefined,
        websiteUrl: formData.websiteUrl.trim() || undefined,
        telegramUrl: formData.telegramUrl.trim() || undefined,
      });

      navigate(`/drop/${result.slug}`);
    } catch (err) {
      console.error('Create drop error:', err);
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details?.fieldErrors) {
          setFieldErrors(err.details.fieldErrors as Record<string, string>);
        }
      } else {
        setError('Failed to create drop. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <Layout title="Create Drop">
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Create Drop">
      <div className="max-w-2xl mx-auto">
        <Card>
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Token Info */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Token Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`input ${fieldErrors.name ? 'input-error' : ''}`}
                    placeholder="My Stream Token"
                    maxLength={32}
                  />
                  {fieldErrors.name && (
                    <p className="text-red-400 text-xs mt-1">{fieldErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Symbol *</label>
                  <input
                    type="text"
                    name="symbol"
                    value={formData.symbol}
                    onChange={handleChange}
                    className={`input ${fieldErrors.symbol ? 'input-error' : ''}`}
                    placeholder="STREAM"
                    maxLength={10}
                  />
                  {fieldErrors.symbol && (
                    <p className="text-red-400 text-xs mt-1">{fieldErrors.symbol}</p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Description *</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className={`input ${fieldErrors.description ? 'input-error' : ''}`}
                  placeholder="Access token for my stream. Hold to participate in TTS and polls!"
                  maxLength={500}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  {fieldErrors.description ? (
                    <span className="text-red-400">{fieldErrors.description}</span>
                  ) : (
                    <span />
                  )}
                  <span>{formData.description.length}/500</span>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Image URL</label>
                <input
                  type="url"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={handleChange}
                  className={`input ${fieldErrors.imageUrl ? 'input-error' : ''}`}
                  placeholder="https://example.com/token-image.png"
                />
                {fieldErrors.imageUrl && (
                  <p className="text-red-400 text-xs mt-1">{fieldErrors.imageUrl}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Optional. Supports PNG, JPG, GIF, WebP (max 15MB)
                </p>
              </div>
            </div>

            {/* Fee Split */}
            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-lg font-semibold mb-4">Fee Split</h3>
              
              <div>
                <label className="block text-sm font-medium mb-1">Prize Pool Wallet *</label>
                <input
                  type="text"
                  name="prizePoolWallet"
                  value={formData.prizePoolWallet}
                  onChange={handleChange}
                  className={`input font-mono text-sm ${fieldErrors.prizePoolWallet ? 'input-error' : ''}`}
                  placeholder="Base58 Solana address for prize pool"
                />
                {fieldErrors.prizePoolWallet && (
                  <p className="text-red-400 text-xs mt-1">{fieldErrors.prizePoolWallet}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Use a dedicated wallet, not your main wallet
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">
                  Fee Split: {formData.streamerPercent}% Streamer / {100 - formData.streamerPercent}% Prize Pool
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.streamerPercent}
                  onChange={handleStreamerPercentChange}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0% Streamer</span>
                  <span>100% Streamer</span>
                </div>
              </div>
            </div>

            {/* Launch Settings */}
            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-lg font-semibold mb-4">Launch Settings</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Initial Buy (SOL)</label>
                  <input
                    type="number"
                    name="initialBuySol"
                    value={formData.initialBuySol}
                    onChange={handleChange}
                    step="0.001"
                    min="0"
                    className={`input ${fieldErrors.initialBuySol ? 'input-error' : ''}`}
                  />
                  {fieldErrors.initialBuySol && (
                    <p className="text-red-400 text-xs mt-1">{fieldErrors.initialBuySol}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Amount to buy at launch (0 = no initial buy)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Holder Threshold</label>
                  <input
                    type="number"
                    name="holderThreshold"
                    value={formData.holderThreshold}
                    onChange={handleChange}
                    step="1"
                    min="0"
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Min tokens to participate (0 = no minimum)
                  </p>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-lg font-semibold mb-4">Social Links (Optional)</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Twitter/X URL</label>
                  <input
                    type="url"
                    name="twitterUrl"
                    value={formData.twitterUrl}
                    onChange={handleChange}
                    className="input"
                    placeholder="https://twitter.com/yourhandle"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Website URL</label>
                  <input
                    type="url"
                    name="websiteUrl"
                    value={formData.websiteUrl}
                    onChange={handleChange}
                    className="input"
                    placeholder="https://yourwebsite.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Telegram URL</label>
                  <input
                    type="url"
                    name="telegramUrl"
                    value={formData.telegramUrl}
                    onChange={handleChange}
                    className="input"
                    placeholder="https://t.me/yourchannel"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="border-t border-gray-700 pt-6 flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" />
                    <span className="ml-2">Creating...</span>
                  </>
                ) : (
                  'Create Drop'
                )}
              </button>
            </div>
          </form>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-4">
          Your wallet: {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
        </p>
      </div>
    </Layout>
  );
}
