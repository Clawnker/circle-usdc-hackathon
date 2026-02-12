'use client';

import { OnchainProviders } from '@/providers/OnchainProviders';
import '@coinbase/onchainkit/styles.css';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <OnchainProviders>
      {children}
    </OnchainProviders>
  );
}
