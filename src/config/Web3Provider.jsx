import React, { useState, useEffect } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { connectorsForWallets, RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
  trustWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { defineChain } from 'viem';
import { CONFIG } from './index';

// Define the custom Brokex Chain using the user's config
export const brokexChain = defineChain({
  id: CONFIG.chainId,
  name: 'Pharos Atlantic',
  nativeCurrency: {
    name: 'Prosper',
    symbol: 'PROS',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [CONFIG.rpcUrl],
    },
    public: {
      http: [CONFIG.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: 'Explorer',
      url: 'https://atlantic.dplabs-internal.com/explorer',
    },
  },
  testnet: true,
});

// Configure explicit RainbowKit Connectors
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Wallets',
      wallets: [metaMaskWallet, rainbowWallet, trustWallet, coinbaseWallet, walletConnectWallet],
    },
  ],
  {
    appName: 'Brokex',
    projectId: 'a40cb8f886f376483584742e973e20ec',
  }
);

// Create Wagmi Config using createConfig for maximum reliability
export const wagmiConfig = createConfig({
  connectors,
  chains: [brokexChain],
  transports: {
    [brokexChain.id]: http(CONFIG.rpcUrl),
  },
  ssr: false,
});

// Create the Query Client for React Query
const queryClient = new QueryClient();

// Premium Theme matching Brokex Gold & Dark colors
const premiumDarkTheme = darkTheme({
  accentColor: '#BC8961', // Brokex Gold
  accentColorForeground: '#000000', // Black text on gold background
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

// Premium Theme matching Brokex Gold & Light colors
const premiumLightTheme = lightTheme({
  accentColor: '#BC8961', // Brokex Gold
  accentColorForeground: '#ffffff', // White text on gold background
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

export function Web3Provider({ children }) {
  const [isLightMode, setIsLightMode] = useState(() =>
    typeof document !== 'undefined' ? document.body.classList.contains('light-mode') : false
  );

  useEffect(() => {
    // Sync initial state
    setIsLightMode(document.body.classList.contains('light-mode'));

    // Reactive MutationObserver to watch class changes on document.body
    const observer = new MutationObserver(() => {
      setIsLightMode(document.body.classList.contains('light-mode'));
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={isLightMode ? premiumLightTheme : premiumDarkTheme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default Web3Provider;
