import { useMemo } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { getContract } from 'viem'
import { useWalletClient } from 'wagmi'
import { DEPLOYMENTS } from '../config'

const TIM_COIN_ABI = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'allowance', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'approve', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'transfer', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'transferFrom', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'MAX_SUPPLY', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

const FIXED_PRICE_EXCHANGE_ABI = [
  { type: 'function', name: 'buyPrice', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'sellPrice', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'token', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'paused', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'setPrices', inputs: [{ type: 'uint256' }, { type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'pause', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'unpause', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'depositReserves', inputs: [{ type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'withdrawReserves', inputs: [{ type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'withdrawETH', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'getBuyQuote', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getSellQuote', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'buyTokens', inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'sellTokens', inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
] as const

const TOKEN_ETH_AMM_ABI = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'token', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'ethReserve', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'timReserve', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'paused', inputs: [], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'MINIMUM_LIQUIDITY', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'SWAP_FEE', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'FEE_DENOMINATOR', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getReserves', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getAmountOut', inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'pure' },
  { type: 'function', name: 'addLiquidity', inputs: [{ type: 'uint256' }, { type: 'uint256' }], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'removeLiquidity', inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'swapExactETHForTokens', inputs: [{ type: 'uint256' }, { type: 'uint256' }], outputs: [], stateMutability: 'payable' },
  { type: 'function', name: 'swapExactTokensForETH', inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'sync', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'pause', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'unpause', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const

function useDeployedAddress(chainId?: number) {
  return useMemo(() => {
    if (!chainId) return undefined
    return DEPLOYMENTS[chainId] ?? undefined
  }, [chainId])
}

export function useTimCoinContract(chainId?: number): `0x${string}` | undefined {
  const addresses = useDeployedAddress(chainId)
  return addresses?.timCoin
}

export function useFixedPriceExchangeContract(chainId?: number): `0x${string}` | undefined {
  const addresses = useDeployedAddress(chainId)
  return addresses?.fixedPriceExchange
}

export function useTokenEthAMMContract(chainId?: number): `0x${string}` | undefined {
  const addresses = useDeployedAddress(chainId)
  return addresses?.tokenEthAMM
}

export {
  TIM_COIN_ABI,
  FIXED_PRICE_EXCHANGE_ABI,
  TOKEN_ETH_AMM_ABI,
}
