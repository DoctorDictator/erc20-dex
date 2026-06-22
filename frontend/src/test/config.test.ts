import { describe, it, expect } from 'vitest'
import { hardhatLocal, DEFAULT_SLIPPAGE, DEFAULT_DEADLINE_MINUTES } from '../config'

describe('hardhatLocal chain config', () => {
  it('has chain ID 31337', () => {
    expect(hardhatLocal.id).toBe(31337)
  })

  it('has ETH as native currency', () => {
    expect(hardhatLocal.nativeCurrency.symbol).toBe('ETH')
  })
})

describe('defaults', () => {
  it('slippage is 0.5%', () => {
    expect(DEFAULT_SLIPPAGE).toBe(0.5)
  })

  it('deadline is 20 minutes', () => {
    expect(DEFAULT_DEADLINE_MINUTES).toBe(20)
  })
})
