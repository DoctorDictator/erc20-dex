import { useState, useCallback, useMemo } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { useWallet } from '../hooks/useWallet'
import {
  useTimCoinContract,
  useTokenEthAMMContract,
  TIM_COIN_ABI,
  TOKEN_ETH_AMM_ABI,
} from '../hooks/useContracts'
import { DEFAULT_DEADLINE_MINUTES, DEFAULT_SLIPPAGE } from '../config'
import { parseContractError } from '../utils/errors'

type SwapMode = 'eth-to-tim' | 'tim-to-eth'
type LiqMode = 'add' | 'remove'

const SECONDS_PER_MINUTE = 60n

function computeDeadline(minutes: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000)) + BigInt(minutes) * SECONDS_PER_MINUTE
}

export default function TokenEthAMM() {
  const { address, isConnected, chainId } = useWallet()
  const [activeTab, setActiveTab] = useState<'swap' | 'liquidity'>('swap')
  const [swapMode, setSwapMode] = useState<SwapMode>('eth-to-tim')
  const [liqMode, setLiqMode] = useState<LiqMode>('add')
  const [swapInput, setSwapInput] = useState('')
  const [liqTimAmount, setLiqTimAmount] = useState('')
  const [liqEthAmount, setLiqEthAmount] = useState('')
  const [liqRemoveAmount, setLiqRemoveAmount] = useState('')
  const [deadlineMinutes, setDeadlineMinutes] = useState(DEFAULT_DEADLINE_MINUTES)
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE)

  const ammAddress = useTokenEthAMMContract(chainId)
  const timCoinAddress = useTimCoinContract(chainId)

  const { data: owner } = useReadContract({
    address: ammAddress,
    abi: TOKEN_ETH_AMM_ABI,
    functionName: 'owner',
    query: { enabled: !!ammAddress },
  })
  const { data: isPaused } = useReadContract({
    address: ammAddress,
    abi: TOKEN_ETH_AMM_ABI,
    functionName: 'paused',
    query: { enabled: !!ammAddress },
  })
  const { data: reserves } = useReadContract({
    address: ammAddress,
    abi: TOKEN_ETH_AMM_ABI,
    functionName: 'getReserves',
    query: { enabled: !!ammAddress },
  })
  const { data: totalSupply } = useReadContract({
    address: ammAddress,
    abi: TOKEN_ETH_AMM_ABI,
    functionName: 'totalSupply',
    query: { enabled: !!ammAddress },
  })
  const { data: userLpBalance } = useReadContract({
    address: ammAddress,
    abi: TOKEN_ETH_AMM_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!ammAddress },
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
    args: address && ammAddress ? [address, ammAddress] : undefined,
    query: { enabled: !!address && !!timCoinAddress && !!ammAddress },
  })

  const isOwner = !!address && !!owner && address.toLowerCase() === (owner as string).toLowerCase()
  const [ethReserve, timReserve] = reserves ? (reserves as [bigint, bigint]) : [0n, 0n]
  const lpSupply = totalSupply as bigint ?? 0n
  const userLp = userLpBalance as bigint ?? 0n
  const poolShare = lpSupply > 0n ? (Number(userLp) / Number(lpSupply)) * 100 : 0

  const parsedSwapInput = swapInput ? parseUnits(swapInput, 18) : 0n

  const { data: swapQuote } = useReadContract({
    address: ammAddress,
    abi: TOKEN_ETH_AMM_ABI,
    functionName: 'getAmountOut',
    args: swapMode === 'eth-to-tim'
      ? [parsedSwapInput, ethReserve, timReserve]
      : [parsedSwapInput, timReserve, ethReserve],
    query: { enabled: !!ammAddress && parsedSwapInput > 0n && ethReserve > 0n && timReserve > 0n },
  })

  const swapOutput = swapQuote as bigint ?? 0n

  const priceImpact = useMemo(() => {
    if (!parsedSwapInput || parsedSwapInput === 0n || !ethReserve || !timReserve) return 0
    if (swapMode === 'eth-to-tim') {
      const inputReserve = ethReserve
      if (inputReserve === 0n) return 100
      return Number((parsedSwapInput * 10000n) / (inputReserve + parsedSwapInput)) / 100
    } else {
      const inputReserve = timReserve
      if (inputReserve === 0n) return 100
      return Number((parsedSwapInput * 10000n) / (inputReserve + parsedSwapInput)) / 100
    }
  }, [parsedSwapInput, ethReserve, timReserve, swapMode])

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
  const txErrorDisplay = writeError ? parseContractError(writeError) : null

  const buttonsDisabled = !isConnected || isWritePending || isConfirming

  const handleSwapETHToTIM = useCallback(() => {
    if (!swapInput || !ammAddress) return
    const parsedIn = parseUnits(swapInput, 18)
    const deadline = computeDeadline(deadlineMinutes)
    const minOut = slippage > 0
      ? swapOutput - (swapOutput * BigInt(Math.floor(slippage * 100)) / 10000n)
      : swapOutput

    writeContract({
      address: ammAddress,
      abi: TOKEN_ETH_AMM_ABI,
      functionName: 'swapExactETHForTokens',
      args: [minOut, deadline],
      value: parsedIn,
    })
  }, [swapInput, ammAddress, deadlineMinutes, slippage, swapOutput, writeContract])

  const needsSwapApproval = swapMode === 'tim-to-eth' && !!allowance && !!parsedSwapInput && allowance < parsedSwapInput

  const handleApproveForSwap = useCallback(() => {
    if (!swapInput || !timCoinAddress || !ammAddress) return
    writeContract({
      address: timCoinAddress,
      abi: TIM_COIN_ABI,
      functionName: 'approve',
      args: [ammAddress, parseUnits(swapInput, 18)],
    })
  }, [swapInput, timCoinAddress, ammAddress, writeContract])

  const handleSwapTIMToETH = useCallback(() => {
    if (!swapInput || !ammAddress) return
    const parsedIn = parseUnits(swapInput, 18)
    const deadline = computeDeadline(deadlineMinutes)
    const minOut = slippage > 0
      ? swapOutput - (swapOutput * BigInt(Math.floor(slippage * 100)) / 10000n)
      : swapOutput

    writeContract({
      address: ammAddress,
      abi: TOKEN_ETH_AMM_ABI,
      functionName: 'swapExactTokensForETH',
      args: [parsedIn, minOut, deadline],
    })
  }, [swapInput, ammAddress, deadlineMinutes, slippage, swapOutput, writeContract])

  const handleSwap = swapMode === 'eth-to-tim' ? handleSwapETHToTIM : needsSwapApproval ? handleApproveForSwap : handleSwapTIMToETH
  const swapButtonLabel = swapMode === 'eth-to-tim' ? 'Swap ETH for TIM' : needsSwapApproval ? 'Approve TIM' : 'Swap TIM for ETH'
  const swapPendingLabel = swapMode === 'eth-to-tim' ? 'Swapping...' : needsSwapApproval ? 'Approving...' : 'Swapping...'

  const handleAddLiquidity = useCallback(() => {
    if (!liqTimAmount || !ammAddress) return
    const deadline = computeDeadline(deadlineMinutes)
    const neededTim = parseUnits(liqTimAmount, 18)
    writeContract({
      address: ammAddress,
      abi: TOKEN_ETH_AMM_ABI,
      functionName: 'addLiquidity',
      args: [neededTim, deadline],
      value: liqEthAmount ? parseUnits(liqEthAmount, 18) : 0n,
    })
  }, [liqTimAmount, liqEthAmount, ammAddress, deadlineMinutes, writeContract])

  const handleApproveForLiquidity = useCallback(() => {
    if (!liqTimAmount || !timCoinAddress || !ammAddress) return
    writeContract({
      address: timCoinAddress,
      abi: TIM_COIN_ABI,
      functionName: 'approve',
      args: [ammAddress, parseUnits(liqTimAmount, 18)],
    })
  }, [liqTimAmount, timCoinAddress, ammAddress, writeContract])

  const parsedLiqTim = liqTimAmount ? parseUnits(liqTimAmount, 18) : 0n
  const needsLiqApproval = liqMode === 'add' && !!allowance && !!parsedLiqTim && allowance < parsedLiqTim
  const liqAction = needsLiqApproval ? handleApproveForLiquidity : handleAddLiquidity
  const liqButtonLabel = needsLiqApproval ? 'Approve TIM' : 'Add Liquidity'

  const handleRemoveLiquidity = useCallback(() => {
    if (!liqRemoveAmount || !ammAddress) return
    const parsedLp = parseUnits(liqRemoveAmount, 18)
    const deadline = computeDeadline(deadlineMinutes)
    const minEth = 0n
    const minTim = 0n
    writeContract({
      address: ammAddress,
      abi: TOKEN_ETH_AMM_ABI,
      functionName: 'removeLiquidity',
      args: [parsedLp, minEth, minTim, deadline],
    })
  }, [liqRemoveAmount, ammAddress, deadlineMinutes, writeContract])

  const handleTogglePause = useCallback(() => {
    if (!ammAddress) return
    writeContract({
      address: ammAddress,
      abi: TOKEN_ETH_AMM_ABI,
      functionName: isPaused ? 'unpause' : 'pause',
    })
  }, [ammAddress, writeContract, isPaused])

  const setLiqPercentage = useCallback(
    (pct: number) => {
      if (!userLp) return
      const amount = (userLp * BigInt(Math.floor(pct * 100))) / 10000n
      setLiqRemoveAmount(formatUnits(amount, 18))
    },
    [userLp],
  )

  const predictedEthForRemove = liqRemoveAmount && lpSupply > 0n
    ? (parseUnits(liqRemoveAmount, 18) * ethReserve) / lpSupply
    : 0n
  const predictedTimForRemove = liqRemoveAmount && lpSupply > 0n
    ? (parseUnits(liqRemoveAmount, 18) * timReserve) / lpSupply
    : 0n

  const predictedLpForAdd = useMemo(() => {
    if (!parsedLiqTim || !liqEthAmount || ethReserve === 0n || timReserve === 0n) return 0n
    if (ethReserve === 0n && timReserve === 0n) {
      const ethVal = liqEthAmount ? parseUnits(liqEthAmount, 18) : 0n
      const sqrt = BigInt(Math.floor(Math.sqrt(Number(ethVal * parsedLiqTim))))
      return sqrt > 1000n ? sqrt - 1000n : 0n
    }
    const ethVal = liqEthAmount ? parseUnits(liqEthAmount, 18) : 0n
    return (ethVal * lpSupply) / ethReserve
  }, [parsedLiqTim, liqEthAmount, ethReserve, timReserve, lpSupply])

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">TIM-ETH AMM</span>
        {isPaused !== undefined && (
          <span className="network-badge" style={{
            background: isPaused ? 'rgba(248,81,73,0.1)' : 'rgba(63,185,80,0.1)',
            color: isPaused ? 'var(--status-failed)' : 'var(--status-confirmed)',
          }}>
            {isPaused ? 'Paused' : 'Active'}
          </span>
        )}
      </div>

      <div className="mode-selector">
        <button className={`mode-btn ${activeTab === 'swap' ? 'active' : ''}`} onClick={() => { setActiveTab('swap'); resetWrite() }}>
          Swap
        </button>
        <button className={`mode-btn ${activeTab === 'liquidity' ? 'active' : ''}`} onClick={() => { setActiveTab('liquidity'); resetWrite() }}>
          Liquidity
        </button>
      </div>

      <div className="info-grid">
        <div className="info-item">
          <div className="info-label">ETH Reserve</div>
          <div className="info-value">{formatUnits(ethReserve, 18)}</div>
        </div>
        <div className="info-item">
          <div className="info-label">TIM Reserve</div>
          <div className="info-value">{formatUnits(timReserve, 18)}</div>
        </div>
        <div className="info-item">
          <div className="info-label">Your LP</div>
          <div className="info-value">{formatUnits(userLp, 18)}</div>
        </div>
        <div className="info-item">
          <div className="info-label">Pool Share</div>
          <div className="info-value">{poolShare.toFixed(4)}%</div>
        </div>
      </div>

      {!isConnected && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Connect wallet to interact</p>
      )}

      {isConnected && activeTab === 'swap' && (
        <>
          <div className="mode-selector">
            <button className={`mode-btn ${swapMode === 'eth-to-tim' ? 'active' : ''}`} onClick={() => { setSwapMode('eth-to-tim'); resetWrite() }}>
              ETH → TIM
            </button>
            <button className={`mode-btn ${swapMode === 'tim-to-eth' ? 'active' : ''}`} onClick={() => { setSwapMode('tim-to-eth'); resetWrite() }}>
              TIM → ETH
            </button>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="swap-input">
              {swapMode === 'eth-to-tim' ? 'ETH Amount' : 'TIM Amount'}
            </label>
            <div className="input-with-button">
              <input
                id="swap-input"
                className="form-input"
                type="text"
                inputMode="decimal"
                placeholder="0.0"
                value={swapInput}
                onChange={(e) => setSwapInput(e.target.value)}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const bal = swapMode === 'eth-to-tim' ? undefined : timBalance
                  if (bal) setSwapInput(formatUnits(bal as bigint, 18))
                }}
              >
                Max
              </button>
            </div>
          </div>

          {swapOutput > 0n && (
            <div className="quote-display">
              <div className="quote-row">
                <span className="quote-label">{swapMode === 'eth-to-tim' ? 'You receive (TIM)' : 'You receive (ETH)'}</span>
                <span className="quote-value">{formatUnits(swapOutput, 18)}</span>
              </div>
              {priceImpact > 0 && (
                <div className="quote-row">
                  <span className="quote-label">Price Impact</span>
                  <span className={`quote-value ${priceImpact > 5 ? 'warning' : ''}`}>
                    {priceImpact.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="swap-slippage">Slippage (%)</label>
            <input
              id="swap-slippage"
              className="form-input form-input-sm"
              type="number"
              min={0.1}
              step={0.1}
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value))}
              style={{ maxWidth: '100px' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="swap-deadline">Deadline (minutes)</label>
            <input
              id="swap-deadline"
              className="form-input form-input-sm"
              type="number"
              min={1}
              value={deadlineMinutes}
              onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
              style={{ maxWidth: '120px' }}
            />
          </div>

          <button className="btn btn-primary btn-block" disabled={buttonsDisabled || !swapInput || parsedSwapInput === 0n} onClick={handleSwap}>
            {isWritePending || isConfirming ? (
              <><span className="spinner" /> {swapPendingLabel}</>
            ) : (
              swapButtonLabel
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

      {isConnected && activeTab === 'liquidity' && (
        <>
          <div className="sub-tabs">
            <button className={`sub-tab ${liqMode === 'add' ? 'active' : ''}`} onClick={() => { setLiqMode('add'); resetWrite() }}>
              Add
            </button>
            <button className={`sub-tab ${liqMode === 'remove' ? 'active' : ''}`} onClick={() => { setLiqMode('remove'); resetWrite() }}>
              Remove
            </button>
          </div>

          {liqMode === 'add' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="liq-eth">ETH Amount</label>
                <input
                  id="liq-eth"
                  className="form-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={liqEthAmount}
                  onChange={(e) => setLiqEthAmount(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="liq-tim">TIM Amount</label>
                <input
                  id="liq-tim"
                  className="form-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={liqTimAmount}
                  onChange={(e) => setLiqTimAmount(e.target.value)}
                />
              </div>

              {predictedLpForAdd > 0n && (
                <div className="quote-display">
                  <div className="quote-row">
                    <span className="quote-label">LP Tokens to Mint</span>
                    <span className="quote-value">{formatUnits(predictedLpForAdd, 18)}</span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="liq-deadline">Deadline (minutes)</label>
                <input
                  id="liq-deadline"
                  className="form-input form-input-sm"
                  type="number"
                  min={1}
                  value={deadlineMinutes}
                  onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
                  style={{ maxWidth: '120px' }}
                />
              </div>

              <button className="btn btn-primary btn-block" disabled={buttonsDisabled || !liqTimAmount || !liqEthAmount} onClick={liqAction}>
                {isWritePending || isConfirming ? (
                  <><span className="spinner" /> {needsLiqApproval ? 'Approving...' : 'Adding...'}</>
                ) : (
                  liqButtonLabel
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

          {liqMode === 'remove' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="liq-remove">LP Amount</label>
                <input
                  id="liq-remove"
                  className="form-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={liqRemoveAmount}
                  onChange={(e) => setLiqRemoveAmount(e.target.value)}
                />
                <div className="pct-buttons">
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} className="pct-btn" onClick={() => setLiqPercentage(pct)}>
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {predictedEthForRemove > 0n && (
                <div className="quote-display">
                  <div className="quote-row">
                    <span className="quote-label">ETH to Receive</span>
                    <span className="quote-value">{formatUnits(predictedEthForRemove, 18)}</span>
                  </div>
                  <div className="quote-row">
                    <span className="quote-label">TIM to Receive</span>
                    <span className="quote-value">{formatUnits(predictedTimForRemove, 18)}</span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="liq-remove-deadline">Deadline (minutes)</label>
                <input
                  id="liq-remove-deadline"
                  className="form-input form-input-sm"
                  type="number"
                  min={1}
                  value={deadlineMinutes}
                  onChange={(e) => setDeadlineMinutes(Number(e.target.value))}
                  style={{ maxWidth: '120px' }}
                />
              </div>

              <button className="btn btn-danger btn-block" disabled={buttonsDisabled || !liqRemoveAmount} onClick={handleRemoveLiquidity}>
                {isWritePending || isConfirming ? (
                  <><span className="spinner" /> Removing...</>
                ) : (
                  'Remove Liquidity'
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
        </>
      )}

      {isOwner && isConnected && (
        <div className="owner-section">
          <div className="card-title">Owner Controls</div>
          <button className="btn btn-secondary" disabled={buttonsDisabled} onClick={handleTogglePause}>
            {isPaused ? 'Unpause Contract' : 'Pause Contract'}
          </button>
        </div>
      )}
    </div>
  )
}
