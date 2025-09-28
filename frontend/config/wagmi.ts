import { http, createConfig } from 'wagmi'
import { polygonAmoy } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { defineChain } from 'viem'

// Define localhost chain for development
const localhost = defineChain({
  id: 31337,
  name: 'Localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'http://localhost:8545' },
  },
})

export const config = createConfig({
  chains: [polygonAmoy, localhost],
  connectors: [
    injected(),
  ],
  transports: {
    [polygonAmoy.id]: http('https://rpc-amoy.polygon.technology/'),
    [localhost.id]: http('http://127.0.0.1:8545'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}

export const TOKEN_CONFIG = {
  SHIB: {
    symbol: 'SHIB',
    name: 'Shiba Inu',
    decimals: 18,
    icon: 'https://assets.coingecko.com/coins/images/11939/thumb/shiba.png'
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: 'https://assets.coingecko.com/coins/images/6319/thumb/USD_Coin_icon.png'
  }
} as const