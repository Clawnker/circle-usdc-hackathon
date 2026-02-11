'use client';

import { WalletProvider } from '@/contexts/WalletContext';
import { OnchainProviders } from '@/providers/OnchainProviders';
import '@coinbase/onchainkit/styles.css';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OnchainProviders>
      <WalletProvider>
        {children}
      </WalletProvider>
    </OnchainProviders>
  );
}
