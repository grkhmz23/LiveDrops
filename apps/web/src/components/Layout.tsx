import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
}

export function Layout({ children, title, showNav = true }: LayoutProps) {
  const location = useLocation();
  const { isAuthenticated, logout, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {showNav && (
        <nav className="border-b border-gray-800 bg-gray-900/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold">
              <span className="text-2xl">🎬</span>
              <span className="bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
                LiveDrops
              </span>
            </Link>

            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      location.pathname === '/dashboard'
                        ? 'bg-brand-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/create"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      location.pathname === '/create'
                        ? 'bg-brand-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    Create Drop
                  </Link>
                  <button
                    onClick={logout}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <WalletMultiButton />
              )}
            </div>
          </div>
        </nav>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">
        {title && (
          <h1 className="text-3xl font-bold mb-8">{title}</h1>
        )}
        {children}
      </main>
    </div>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-gray-800 rounded-xl p-6 ${className}`}>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const statusStyles: Record<string, string> = {
    DRAFT: 'badge-draft',
    TOKEN_INFO_CREATED: 'badge-token-info',
    CONFIG_CREATED: 'badge-config',
    LAUNCHED: 'badge-launched',
  };

  const statusLabels: Record<string, string> = {
    DRAFT: 'Draft',
    TOKEN_INFO_CREATED: 'Token Created',
    CONFIG_CREATED: 'Config Ready',
    LAUNCHED: 'Launched',
  };

  return (
    <span className={`badge ${statusStyles[status] || 'badge-draft'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-600 border-t-brand-500`} />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12">
      <span className="text-6xl mb-4 block">{icon}</span>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 mb-4">{description}</p>
      {action}
    </div>
  );
}
