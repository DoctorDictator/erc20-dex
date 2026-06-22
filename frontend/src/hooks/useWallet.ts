import { useCallback } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'

const SUPPORTED_CHAIN_IDS = [1, 11155111, 31337]

export function useWallet() {
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  const isCorrectNetwork = isConnected && chainId !== undefined && SUPPORTED_CHAIN_IDS.includes(chainId)

  const connectWallet = useCallback(() => {
    const injectedConnector = connectors.find((c) => c.id === 'injected')
    if (injectedConnector) {
      connect({ connector: injectedConnector })
    }
  }, [connect, connectors])

  const switchNetwork = useCallback(
    (targetChainId?: number) => {
      const id = targetChainId ?? 31337
      switchChain({ chainId: id })
    },
    [switchChain],
  )

  return {
    address,
    isConnected,
    chainId,
    isCorrectNetwork,
    connect: connectWallet,
    disconnect,
    switchNetwork,
    supportedChains: SUPPORTED_CHAIN_IDS,
  }
}
