import { describe, it, expect } from 'vitest'
import { shortenAddress, getExplorerUrl, parseContractError } from '../utils/errors'

describe('shortenAddress', () => {
  it('shortens a hex address', () => {
    expect(shortenAddress('0x1234567890123456789012345678901234567890')).toBe('0x1234...7890')
  })

  it('returns short strings as-is', () => {
    expect(shortenAddress('0x1234')).toBe('0x1234')
  })

  it('handles empty string', () => {
    expect(shortenAddress('')).toBe('')
  })
})

describe('getExplorerUrl', () => {
  it('returns etherscan url for mainnet', () => {
    expect(getExplorerUrl(1, '0xtx')).toBe('https://etherscan.io/tx/0xtx')
  })

  it('returns sepolia url for sepolia', () => {
    expect(getExplorerUrl(11155111, '0xtx')).toBe('https://sepolia.etherscan.io/tx/0xtx')
  })

  it('returns empty for unknown chain', () => {
    expect(getExplorerUrl(31337, '0xtx')).toBe('')
  })
})

describe('parseContractError', () => {
  it('returns Unknown error for falsy input', () => {
    expect(parseContractError(null)).toBe('Unknown error')
  })

  it('returns string as-is', () => {
    expect(parseContractError('some error')).toBe('some error')
  })
})
