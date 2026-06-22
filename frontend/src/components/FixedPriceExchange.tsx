import { useState, useCallback, useEffect } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { useWallet } from '../hooks/useWallet'
import {
  useTimCoinContract,
  useFixedPriceExchangeContract,
  TIM_COIN_ABI,
  FIXED_PRICE_EXCHANGE_ABI,
} from '../hooks/useContracts'
import { DEFAULT_DEADLINE_MINUTES, DEFAULT_SLIPPAGE } from '../config'
import { parseContractError } from '../utils/errors'

type Mode = 'buy' | 'sell'

const SECONDS_PER_MINUTE = 60n

function computeDeadline(minutes: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000)) + BigInt(minutes) * SECONDS_PER_MINUTE
}

export default function FixedPriceExchange() {
  const { address, isConnected, chainId } = useWallet()
  const [mode, setMode] = useState<Mode>('buy')
  const [amount, setAmount] = useState('')
  const [deadlineMinutes, setDeadlineMinutes] = useState(DEFAULT_DEADLINE_MINUTES)
  const [slippage] = useState(DEFAULT_SLIPPAGE)

  const fixedPriceAddress = useFixedPriceExchangeContract(chainId)
  const timCoinAddress = useTimCoinContract(chainId)

  const { data: buyPrice } = useReadContract({
    address: fixedPriceAddress,
    abi: FIXED_PRICE_EXCHANGE_ABI,
    functionName: 'buyPrice',
    query: { enabled: !!fixedPriceAddress },
  })
  const { data: sellPrice } = useReadContract({
    address: fixedPriceAddress,
    abi: FIXED_PRICE_EXCHANGE_ABI,
    functionName: 'sellPrice',
    query: { enabled: !!fixedPriceAddress },
  })
  const { data: owner } = useReadContract({
    address: fixedPriceAddress,
    abi: FIXED_PRICE_EXCHANGE_ABI,
    functionName: 'owner',
    query: { enabled: !!fixedPriceAddress },
  })
  const { data: isPaused } = useReadContract({
    address: fixedPriceAddress,
    abi: FIXED_PRICE_EXCHANGE_ABI,
    functionName: 'paused',
    query: { enabled: !!fixedPriceAddress },
  })

  const { data: timBalance } = useReadContract({
    address: timCoinAddress,
    abi: TIM_COIN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!timCoinAddress },
  })

  const { data: allowance } = useReadContract({
    address: timCoinAddress,
    abi: TIM_COIN_ABI,
    functionName: 'allowance',
    args: address && fixedPriceAddress ? [address, fixedPriceAddress] : undefined,
    query: { enabled: !!address && !!timCoinAddress && !!fixedPriceAddress },
  })

  const isOwner = !!address && !!owner && address.toLowerCase() === (owner as string).toLowerCase()

  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  const txStatus = isWritePending ? 'pending' : isConfirming ? 'pending' : isConfirmed ? 'confirmed' : writeError ? 'failed' : 'idle'
  const displayStatus = txStatus !== 'idle' ? txStatus : null

  const parsedAmount = amount ? parseUnits(amount, 18) : 0n

  const { data: quote } = useReadContract({
    address: fixedPriceAddress,
    abi: FIXED_PRICE_EXCHANGE_ABI,
    functionName: mode === 'buy' ? 'getBuyQuote' : 'getSellQuote',
    args: parsedAmount ? [parsedAmount] : undefined,
    query: { enabled: !!fixedPriceAddress && parsedAmount > 0n },
  })

  const needsApproval = mode === 'sell' && !!allowance && !!parsedAmount && allowance < parsedAmount

  const handleBuy = useCallback(() => {
    if (!amount || !fixedPriceAddress) return
    const parsedAmt = parseUnits(amount, 18)
    const deadline = computeDeadline(deadlineMinutes)
    const cost = (quote as bigint) ?? 0n
    const maxCost = slippage > 0
      ? cost + (cost * BigInt(Math.floor(slippage * 100)) / 10000n)
      : cost

    writeContract({
      address: fixedPriceAddress,
      abi: FIXED_PRICE_EXCHANGE_ABI,
      functionName: 'buyTokens',
      args: [parsedAmt, deadline, maxCost],
      value: maxCost,
    })
  }, [amount, fixedPriceAddress, deadlineMinutes, quote, slippage, writeContract])

  const handleApprove = useCallback(() => {
    if (!amount || !timCoinAddress || !fixedPriceAddress) return
    const parsedAmt = parseUnits(amount, 18)
    writeContract({
      address: timCoinAddress,
      abi: TIM_COIN_ABI,
      functionName: 'approve',
      args: [fixedPriceAddress, parsedAmt],
    })
  }, [amount, timCoinAddress, fixedPriceAddress, writeContract])

  const handleSell = useCallback(() => {
    if (!amount || !fixedPriceAddress || !timCoinAddress) return
    const parsedAmt = parseUnits(amount, 18)
    const deadline = computeDeadline(deadlineMinutes)
    const proceeds = (quote as bigint) ?? 0n
    const minProceeds = slippage > 0
      ? proceeds - (proceeds * BigInt(Math.floor(slippage * 100)) / 10000n)
      : proceeds

    writeContract({
      address: fixedPriceAddress,
      abi: FIXED_PRICE_EXCHANGE_ABI,
      functionName: 'sellTokens',
      args: [parsedAmt, deadline, minProceeds],
    })
  }, [amount, fixedPriceAddress, deadlineMinutes, quote, slippage, writeContract, timCoinAddress])

  const handleAction = mode === 'buy' ? handleBuy : needsApproval ? handleApprove : handleSell
  const actionLabel = mode === 'buy' ? 'Buy TIM' : needsApproval ? 'Approve TIM' : 'Sell TIM'
  const txErrorDisplay = writeError ? parseContractError(writeError) : null

  const [newBuyPrice, setNewBuyPrice] = useState('')
  const [newSellPrice, setNewSellPrice] = useState('')
  const [depositAmount, setDepositAmount] = useState('')

  const handleSetPrices = useCallback(() => {
    if (!newBuyPrice || !newSellPrice || !fixedPriceAddress) return
    writeContract({
      address: fixedPriceAddress,
      abi: FIXED_PRICE_EXCHANGE_ABI,
      functionName: 'setPrices',
      args: [parseUnits(newBuyPrice, 18), parseUnits(newSellPrice, 18)],
    })
  }, [newBuyPrice, newSellPrice, fixedPriceAddress, writeContract])

  const handleDepositReserves = useCallback(() => {
    if (!depositAmount || !fixedPriceAddress || !timCoinAddress) return
    const parsed = parseUnits(depositAmount, 18)
    writeContract({
      address: timCoinAddress,
      abi: TIM_COIN_ABI,
      functionName: 'approve',
      args: [fixedPriceAddress, parsed],
    })
  }, [depositAmount, fixedPriceAddress, timCoinAddress, writeContract])

  const handleWithdrawReserves = useCallback(() => {
    if (!depositAmount || !fixedPriceAddress) return
    writeContract({
      address: fixedPriceAddress,
      abi: FIXED_PRICE_EXCHANGE_ABI,
      functionName: 'withdrawReserves',
      args: [parseUnits(depositAmount, 18)],
    })
  }, [depositAmount, fixedPriceAddress, writeContract])

  const handleWithdrawETH = useCallback(() => {
    if (!fixedPriceAddress) return
    writeContract({
      address: fixedPriceAddress,
      abi: FIXED_PRICE_EXCHANGE_ABI,
      functionName: 'withdrawETH',
    })
  }, [fixedPriceAddress, writeContract])

  const handleTogglePause = useCallback(() => {
    if (!fixedPriceAddress) return
    writeContract({
      address: fixedPriceAddress,
      abi: FIXED_PRICE_EXCHANGE_ABI,
      functionName: isPaused ? 'unpause' : 'pause',
    })
  }, [fixedPriceAddress, writeContract, isPaused])

  const handleDepositReservesAfterApprove = useCallback(() => {
    if (!depositAmount || !fixedPriceAddress) return
    writeContract({
      address: fixedPriceAddress,
      abi: FIXED_PRICE_EXCHANGE_ABI,
      functionName: 'depositReserves',
      args: [parseUnits(depositAmount, 18)],
    })
  }, [depositAmount, fixedPriceAddress, writeContract])

  const buttonsDisabled = !isConnected || isWritePending || isConfirming

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Fixed Price Exchange</span>
        {isPaused !== undefined && (
          <span className={`network-badge ${isPaused ? '' : ''}`} style={{ background: isPaused ? 'rgba(248,81,73,0.1)' : 'rgba(63,185,80,0.1)', color: isPaused ? 'var(--status-failed)' : 'var(--status-confirmed)' }}>
            {isPaused ? 'Paused' : 'Active'}
          </span>
        )}
      </div>

      {!isConnected && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Connect wallet to trade</p>
      )}

      {isConnected && (
        <>
          <div className="mode-selector">
            <button className={`mode-btn ${mode === 'buy' ? 'active' : ''}`} onClick={() => { setMode('buy'); resetWrite() }}>Buy TIM</button>
            <button className={`mode-btn ${mode === 'sell' ? 'active' : ''}`} onClick={() => { setMode('sell'); resetWrite() }}>Sell TIM</button>
          </div>

          {(buyPrice !== undefined || sellPrice !== undefined) && (
            <div className="info-grid">
              {buyPrice !== undefined && (
                <div className="info-item">
                  <div className="info-label">Buy Price</div>
                  <div className="info-value">{formatUnits(buyPrice as bigint, 18)} ETH</div>
                </div>
              )}
              {sellPrice !== undefined && (
                <div className="info-item">
                  <div className="info-label">Sell Price</div>
                  <div className="info-value">{formatUnits(sellPrice as bigint, 18)} ETH</div>
                </div>
              )}
              <div className="info-item">
                <div className="info-label">TIM Balance</div>
                <div className="info-value">{timBalance !== undefined ? formatUnits(timBalance as bigint, 18) : '...'}</div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="tim-amount">
              {mode === 'buy' ? 'TIM to Buy' : 'TIM to Sell'}
            </label>
            <div className="input-with-button">
              <input
                id="tim-amount"
                className="form-input"
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button className="btn btn-secondary btn-sm" onClick={() => timBalance && setAmount(formatUnits(timBalance as bigint, 18))}>
                Max
              </button>
            </div>
          </div>

          {quote !== undefined && parsedAmount > 0n && (
            <div className="quote-display">
              <div className="quote-row">
                <span className="quote-label">{mode === 'buy' ? 'Cost (ETH)' : 'Proceeds (ETH)'}</span>
                <span className="quote-value">{formatUnits(quote as bigint, 18)} ETH</span>
              </div>
              {mode === 'buy' && slippage > 0 && (
                <div className="quote-row">
                  <span className="quote-label">Max Cost ({slippage}% slippage)</span>
                  <span className="quote-value">
                    {formatUnits((quote as bigint) + ((quote as bigint) * BigInt(Math.floor(slippage * 100)) / 10000n), 18)} ETH
                  </span>
                </div>
              )}
              {mode === 'sell' && slippage > 0 && (
                <div className="quote-row">
                  <span className="quote-label">Min Proceeds ({slippage}% slippage)</span>
                  <span className="quote-value">
                    {formatUnits((quote as bigint) - ((quote as bigint) * BigInt(Math.floor(slippage * 100)) / 10000n), 18)} ETH
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="deadline">Deadline (minutes)</label>
            <input
              id="deadline"
              className="form-input form-input-sm"
              type="number"
              min={1}
              value={deadlineMinutes}
              onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
              style={{ maxWidth: '120px' }}
            />
          </div>

          <button className="btn btn-primary btn-block" disabled={buttonsDisabled || !amount || parsedAmount === 0n} onClick={handleAction}>
            {isWritePending || isConfirming ? (
              <><span className="spinner" /> {mode === 'buy' ? 'Buying...' : needsApproval ? 'Approving...' : 'Selling...'}</>
            ) : (
              actionLabel
            )}
          </button>

          {displayStatus && (
            <div className={`tx-status ${displayStatus}`}>
              {displayStatus === 'pending' && <><span className="spinner" /> Transaction submitted...</>}
              {displayStatus === 'confirmed' && <>Transaction confirmed!</>}
              {displayStatus === 'failed' && <>Transaction failed</>}
            </div>
          )}

          {txErrorDisplay && <div className="error-display">{txErrorDisplay}</div>}
        </>
      )}

      {isOwner && isConnected && (
        <div className="owner-section">
          <div className="card-title">Owner Controls</div>

          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">Buy Price (wei)</div>
              <div className="info-value">{buyPrice !== undefined ? (buyPrice as bigint).toString() : '...'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Sell Price (wei)</div>
              <div className="info-value">{sellPrice !== undefined ? (sellPrice as bigint).toString() : '...'}</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">New Buy Price (ETH per TIM)</label>
            <input className="form-input" type="text" inputMode="decimal" placeholder="0.0" value={newBuyPrice} onChange={(e) => setNewBuyPrice(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">New Sell Price (ETH per TIM)</label>
            <input className="form-input" type="text" inputMode="decimal" placeholder="0.0" value={newSellPrice} onChange={(e) => setNewSellPrice(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" disabled={buttonsDisabled || !newBuyPrice || !newSellPrice} onClick={handleSetPrices}>
            Set Prices
          </button>

          <div style={{ height: '1rem' }} />

          <div className="form-group">
            <label className="form-label">Reserve Amount (TIM)</label>
            <input className="form-input" type="text" inputMode="decimal" placeholder="0.0" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" disabled={buttonsDisabled || !depositAmount} onClick={handleDepositReserves}>
              Approve & Deposit
            </button>
            <button className="btn btn-danger" disabled={buttonsDisabled || !depositAmount} onClick={handleWithdrawReserves}>
              Withdraw
            </button>
          </div>

          <div style={{ height: '0.75rem' }} />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" disabled={buttonsDisabled} onClick={handleTogglePause}>
              {isPaused ? 'Unpause' : 'Pause'}
            </button>
            <button className="btn btn-secondary" disabled={buttonsDisabled} onClick={handleWithdrawETH}>
              Withdraw ETH
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
