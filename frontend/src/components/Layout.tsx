import { ReactNode } from 'react'
import { useWallet } from '../hooks/useWallet'
import WalletStatus from './WalletStatus'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { chainId, switchNetwork } = useWallet()

  return (
    <>
      <header className="app-header">
        <h1>ERC-20 DEX</h1>
        <div className="header-actions">
          {chainId && (
            <select
              className="network-select"
              value={chainId}
              onChange={(e) => switchNetwork(Number(e.target.value))}
              aria-label="Select network"
            >
              <option value={31337}>Hardhat Local</option>
              <option value={11155111}>Sepolia</option>
              <option value={1}>Ethereum Mainnet</option>
            </select>
          )}
          <WalletStatus />
        </div>
      </header>
      <main className="app-main">{children}</main>
    </>
  )
}
