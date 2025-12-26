import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { AuthProvider } from './hooks/useAuth';

// Pages
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import CreateDrop from './pages/CreateDrop';
import DropDetail from './pages/DropDetail';
import ViewerPage from './pages/ViewerPage';
import OverlayPage from './pages/OverlayPage';

// Wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

function App() {
  // Configure wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Home />} />
              <Route path="/d/:slug" element={<ViewerPage />} />
              <Route path="/overlay/:slug" element={<OverlayPage />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/create" element={<CreateDrop />} />
              <Route path="/drop/:slug" element={<DropDetail />} />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
