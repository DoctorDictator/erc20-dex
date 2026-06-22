import { http, createConfig } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const hardhatLocal = {
  id: 31337,
  name: 'Hardhat Local',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
} as const

export const config = createConfig({
  chains: [mainnet, sepolia, hardhatLocal],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [hardhatLocal.id]: http(),
  },
})

export const DEPLOYMENTS: Record<number, {
  timCoin: `0x${string}`
  fixedPriceExchange: `0x${string}`
  tokenEthAMM: `0x${string}`
}> = {
  31337: {
    timCoin: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    fixedPriceExchange: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    tokenEthAMM: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  },
}

export const DEFAULT_SLIPPAGE = 0.5
export const DEFAULT_DEADLINE_MINUTES = 20
