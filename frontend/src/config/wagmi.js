import { ethers } from 'ethers'

// Real network configurations for production
export const polygonAmoyTestnet = {
  id: 80002,
  name: 'Polygon Amoy Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'POL',
    symbol: 'POL',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
    public: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
  },
  blockExplorers: {
    default: {
      name: 'PolygonScan',
      url: 'https://amoy.polygonscan.com'
    },
  },
  testnet: true,
  contracts: {
    // Real contract addresses will be injected here after deployment
    zkRiskLoan: '0x0000000000000000000000000000000000000000', // Will be updated
    realOracle: '0x0000000000000000000000000000000000000000', // Will be updated
    x402Payment: '0x0000000000000000000000000000000000000000', // Will be updated
    selfBridge: '0x0000000000000000000000000000000000000000', // Will be updated
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Real USDC on Polygon Amoy
  }
}

export const celoAlfajoresTestnet = {
  id: 44787,
  name: 'Celo Alfajores Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'CELO',
    symbol: 'CELO',
  },
  rpcUrls: {
    default: {
      http: ['https://alfajores-forno.celo-testnet.org'],
    },
    public: {
      http: ['https://alfajores-forno.celo-testnet.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'CeloScan',
      url: 'https://alfajores.celoscan.io'
    },
  },
  testnet: true,
  contracts: {
    selfVerifier: '0x742d35Cc6e64B2C5c8e4F1234567890123456789', // Self Protocol verifier
    hyperlaneMailbox: '0x742d35Cc6e64B2C5c8e4F1234567890123456789', // Hyperlane mailbox
  }
}

// Ethereum providers
export const getProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum)
  }
  // Fallback to read-only provider
  return new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology')
}

// Contract addresses - will be updated after deployment
export const CONTRACT_ADDRESSES = {
  [polygonAmoyTestnet.id]: {
    zkRiskLoan: process.env.VITE_LOAN_CONTRACT || '0x0000000000000000000000000000000000000000',
    realOracle: process.env.VITE_ORACLE_CONTRACT || '0x0000000000000000000000000000000000000000',
    x402Payment: process.env.VITE_X402_CONTRACT || '0x0000000000000000000000000000000000000000',
    selfBridge: process.env.VITE_SELF_BRIDGE_CONTRACT || '0x0000000000000000000000000000000000000000',
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Real USDC
  },
  [celoAlfajoresTestnet.id]: {
    selfVerifier: process.env.VITE_SELF_VERIFIER || '0x742d35Cc6e64B2C5c8e4F1234567890123456789',
    hyperlaneMailbox: process.env.VITE_HYPERLANE_MAILBOX || '0x742d35Cc6e64B2C5c8e4F1234567890123456789',
  }
}

// Network switching utilities
export const SUPPORTED_NETWORKS = {
  POLYGON_AMOY: polygonAmoyTestnet.id,
  CELO_ALFAJORES: celoAlfajoresTestnet.id,
}

export const NETWORK_NAMES = {
  [polygonAmoyTestnet.id]: 'Polygon Amoy',
  [celoAlfajoresTestnet.id]: 'Celo Alfajores',
}

export const getNetworkConfig = (chainId) => {
  switch (chainId) {
    case polygonAmoyTestnet.id:
      return polygonAmoyTestnet
    case celoAlfajoresTestnet.id:
      return celoAlfajoresTestnet
    default:
      return polygonAmoyTestnet // Default to Polygon Amoy
  }
}

export const isNetworkSupported = (chainId) => {
  return Object.values(SUPPORTED_NETWORKS).includes(chainId)
}

// External service endpoints
export const EXTERNAL_SERVICES = {
  FLUENCE_AI_ENDPOINT: process.env.VITE_FLUENCE_ENDPOINT || 'http://localhost:5001',
  PYTH_HERMES_WS: 'wss://hermes.pyth.network/ws',
  PYTH_HERMES_HTTP: 'https://hermes.pyth.network',
  SELF_PROTOCOL_API: process.env.VITE_SELF_API || 'https://api.self.xyz',
}

// Token configurations
export const TOKEN_CONFIG = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
  },
  POL: {
    symbol: 'POL',
    name: 'Polygon',
    decimals: 18,
    icon: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
  },
  CELO: {
    symbol: 'CELO',
    name: 'Celo',
    decimals: 18,
    icon: 'https://cryptologos.cc/logos/celo-celo-logo.png',
  }
}