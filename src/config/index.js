// Brokex Smart Contract Configuration (Dynamic Switcher)

const currentNetwork = (typeof window !== 'undefined' && localStorage.getItem('brokex_network')) || 'mainnet';
const isMainnet = currentNetwork === 'mainnet';
export const NETWORK_NAME = currentNetwork;

export const RPC_URL = isMainnet 
  ? (import.meta.env.VITE_MAINNET_RPC_URL || 'https://rpc.brokex.trade')
  : (import.meta.env.VITE_TESTNET_RPC_URL || 'https://atlantic.dplabs-internal.com');

export const WS_URL = isMainnet
  ? (import.meta.env.VITE_MAINNET_WS_URL || 'wss://ws.brokex.trade')
  : (import.meta.env.VITE_TESTNET_WS_URL || 'wss://atlantic.dplabs-internal.com');

export const CHAIN_ID = Number(isMainnet
  ? (import.meta.env.VITE_MAINNET_CHAIN_ID || '688688')
  : (import.meta.env.VITE_TESTNET_CHAIN_ID || '688689'));

export const API_URL = isMainnet
  ? (import.meta.env.VITE_MAINNET_API_URL || 'https://api.brokex.trade')
  : (import.meta.env.VITE_TESTNET_API_URL || 'https://api.brokex.trade');

export const EXPLORER_URL = isMainnet
  ? (import.meta.env.VITE_MAINNET_EXPLORER_URL || 'https://pharos.socialscan.io')
  : (import.meta.env.VITE_TESTNET_EXPLORER_URL || 'https://pharos-testnet.socialscan.io');

// Smart Contract Addresses
export const CORE_ADDRESS = isMainnet
  ? (import.meta.env.VITE_MAINNET_CORE_ADDRESS || '0x0000000000000000000000000000000000000000')
  : (import.meta.env.VITE_TESTNET_CORE_ADDRESS || '0xd2bD5f41beEe50629F909B9c697D511ad7c43517');

export const LENS_ADDRESS = isMainnet
  ? (import.meta.env.VITE_MAINNET_LENS_ADDRESS || '0x0000000000000000000000000000000000000000')
  : (import.meta.env.VITE_TESTNET_LENS_ADDRESS || '0x67577B59D0C8bD0b7AC79A00A112e681AC9aA4d9');

export const USDC_ADDRESS = isMainnet
  ? (import.meta.env.VITE_MAINNET_USDC_ADDRESS || '0x0000000000000000000000000000000000000000')
  : (import.meta.env.VITE_TESTNET_USDC_ADDRESS || '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b');

export const VAULT_ADDRESS = isMainnet
  ? (import.meta.env.VITE_MAINNET_VAULT_ADDRESS || '0x589178934112DbBa96C17384079206a21B4F20DA')
  : (import.meta.env.VITE_TESTNET_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000');

export const CONFIG = {
  rpcUrl: RPC_URL,
  wsUrl: WS_URL,
  chainId: CHAIN_ID,
  apiUrl: API_URL,
  explorerUrl: EXPLORER_URL,
  network: NETWORK_NAME,
  addresses: {
    core: CORE_ADDRESS,
    lens: LENS_ADDRESS,
    usdc: USDC_ADDRESS,
    vault: VAULT_ADDRESS,
  }
};

export default CONFIG;
