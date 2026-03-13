'use client';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';
import { useEffect, useState } from 'react';
import { getNetworkConfig, getStoredNetworkMode, NETWORK_MODE_EVENT, type NetworkMode } from '@/lib/networkMode';

const config = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    coinbaseWallet({
      appName: 'Hivemind Protocol',
      preference: 'smartWalletOnly', // Forces Smart Wallet (email OTP auth)
    }),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});

const queryClient = new QueryClient();

export function OnchainProviders({ children }: { children: React.ReactNode }) {
  const [networkMode, setNetworkMode] = useState<NetworkMode>(getStoredNetworkMode);
  const network = getNetworkConfig(networkMode);

  useEffect(() => {
    const handleModeChange = (event?: Event) => {
      const nextMode = (event as CustomEvent<NetworkMode> | undefined)?.detail;
      setNetworkMode(nextMode || getStoredNetworkMode());
    };

    handleModeChange();
    window.addEventListener(NETWORK_MODE_EVENT, handleModeChange as EventListener);
    window.addEventListener('storage', handleModeChange as EventListener);
    return () => {
      window.removeEventListener(NETWORK_MODE_EVENT, handleModeChange as EventListener);
      window.removeEventListener('storage', handleModeChange as EventListener);
    };
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          key={networkMode}
          chain={network.chain}
          config={{
            appearance: {
              mode: 'dark', // Match our dark theme
              theme: 'cyberpunk', // or 'default'
            },
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
