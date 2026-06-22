import { useWallet } from '../hooks/useWallet'
import { useBalance, useReadContract } from 'wagmi'
import { useTimCoinContract, TIM_COIN_ABI } from '../hooks/useContracts'
import { shortenAddress } from '../utils/errors'
import { formatUnits } from 'viem'

export default function WalletStatus() {
  const { address, isConnected, chainId, isCorrectNetwork, connect, disconnect } = useWallet()
  const timCoinAddress = useTimCoinContract(chainId)

  const { data: timBalance } = useReadContract({
    address: timCoinAddress ?? undefined,
    abi: TIM_COIN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!timCoinAddress },
  })

  const { data: ethBalance } = useReadContract({
    address: timCoinAddress ?? undefined,
    abi: TIM_COIN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: false },
  })

  if (!isConnected) {
    return (
      <button className="wallet-btn" onClick={connect}>
        Connect Wallet
      </button>
    )
  }

  if (!isCorrectNetwork) {
    return (
      <button className="wallet-btn" onClick={() => connect()}>
        <span className="wallet-status-dot wrong-network" />
        Wrong Network
      </button>
    )
  }

  const chainName =
    chainId === 31337 ? 'Hardhat' :
    chainId === 11155111 ? 'Sepolia' :
    chainId === 1 ? 'Mainnet' :
    `Chain ${chainId}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
      <span className="network-badge">{chainName}</span>
      {timBalance !== undefined && (
        <span className="network-badge" style={{ background: 'rgba(63,185,80,0.1)', color: 'var(--accent-green)' }}>
          TIM: {formatUnits(timBalance, 18)}
        </span>
      )}
      <button className="wallet-btn connected" onClick={() => disconnect()}>
        <span className="wallet-status-dot connected" />
        {shortenAddress(address ?? '')}
      </button>
    </div>
  )
}
