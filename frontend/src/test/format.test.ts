import { describe, it, expect } from 'vitest'
import { formatUnits, parseUnits, formatEth, formatTim } from '../utils/format'

describe('formatUnits', () => {
  it('formats wei to ETH string', () => {
    expect(formatUnits(1000000000000000000n, 18)).toBe('1')
  })

  it('formats zero', () => {
    expect(formatUnits(0n, 18)).toBe('0')
  })

  it('handles small values', () => {
    expect(formatUnits(1n, 18)).toBe('0.000000000000000001')
  })

  it('formats large values with decimals', () => {
    expect(formatUnits(1500000000000000000n, 18)).toBe('1.5')
  })
})

describe('parseUnits', () => {
  it('parses ETH string to wei', () => {
    expect(parseUnits('1', 18)).toBe(1000000000000000000n)
  })

  it('parses zero', () => {
    expect(parseUnits('0', 18)).toBe(0n)
  })
})

describe('formatEth', () => {
  it('formats wei as ETH', () => {
    expect(formatEth(1000000000000000000n)).toBe('1')
  })
})

describe('formatTim', () => {
  it('formats wei as TIM', () => {
    expect(formatTim(1000000000000000000n)).toBe('1')
  })
})
