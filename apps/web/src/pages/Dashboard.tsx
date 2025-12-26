import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout, Card, StatusBadge, EmptyState, Spinner } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { drops as dropsApi } from '../lib/api';
import { truncateAddress } from '../lib/solana';
import type { Drop } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Load drops
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadDrops = async () => {
      try {
        const data = await dropsApi.list();
        setDrops(data);
      } catch (err) {
        console.error('Failed to load drops:', err);
        setError('Failed to load drops');
      } finally {
        setIsLoading(false);
      }
    };

    loadDrops();
  }, [isAuthenticated]);

  if (authLoading || isLoading) {
    return (
      <Layout title="Dashboard">
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard">
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {drops.length === 0 ? (
        <Card>
          <EmptyState
            icon="🎬"
            title="No drops yet"
            description="Create your first token drop to get started with LiveDrops."
            action={
              <Link to="/create" className="btn btn-primary">
                Create Your First Drop
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-400">{drops.length} drop(s)</p>
            <Link to="/create" className="btn btn-primary">
              Create New Drop
            </Link>
          </div>

          <div className="grid gap-4">
            {drops.map((drop) => (
              <Link
                key={drop.id}
                to={`/drop/${drop.slug}`}
                className="block"
              >
                <Card className="card-hover">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {drop.imageUrl ? (
                        <img
                          src={drop.imageUrl}
                          alt={drop.name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-700 flex items-center justify-center text-2xl">
                          🪙
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold">{drop.name}</h3>
                          <span className="text-gray-500">${drop.symbol}</span>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-1">
                          {drop.description}
                        </p>
                        {drop.tokenMint && (
                          <p className="text-xs text-gray-500 mt-1">
                            Mint: {truncateAddress(drop.tokenMint, 6)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <StatusBadge status={drop.status} />
                      <div className="mt-2 text-xs text-gray-500">
                        {new Date(drop.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {drop.status === 'LAUNCHED' && (
                    <div className="mt-4 pt-4 border-t border-gray-700 flex gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Actions:</span>{' '}
                        <span className="text-white">{drop.actionCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Claims:</span>{' '}
                        <span className="text-white">{drop.claimCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Fee Split:</span>{' '}
                        <span className="text-white">
                          {drop.streamerBps / 100}% / {drop.prizePoolBps / 100}%
                        </span>
                      </div>
                    </div>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
