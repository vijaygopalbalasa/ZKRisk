import { http, createConfig } from 'wagmi'
import { polygonAmoy } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [polygonAmoy],
  connectors: [
    injected(),
  ],
  transports: {
    [polygonAmoy.id]: http('https://rpc-amoy.polygon.technology/'),
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