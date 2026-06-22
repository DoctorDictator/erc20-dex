import { useState } from 'react'
import Layout from './components/Layout'
import FixedPriceExchange from './components/FixedPriceExchange'
import TokenEthAMM from './components/TokenEthAMM'

type Tab = 'fixed-price' | 'amm'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('fixed-price')

  return (
    <>
      <Layout>
        <nav className="app-nav">
          <button
            className={activeTab === 'fixed-price' ? 'active' : ''}
            onClick={() => setActiveTab('fixed-price')}
          >
            Fixed Price Exchange
          </button>
          <button
            className={activeTab === 'amm' ? 'active' : ''}
            onClick={() => setActiveTab('amm')}
          >
            TIM-ETH AMM
          </button>
        </nav>
        {activeTab === 'fixed-price' && <FixedPriceExchange />}
        {activeTab === 'amm' && <TokenEthAMM />}
      </Layout>
    </>
  )
}
