import { formatUnits as viemFormat, parseUnits as viemParse } from 'viem'

export function formatUnits(value: bigint, decimals: number): string {
  return viemFormat(value, decimals)
}

export function parseUnits(value: string, decimals: number): bigint {
  return viemParse(value, decimals)
}

export function formatEth(value: bigint): string {
  return viemFormat(value, 18)
}

export function formatTim(value: bigint): string {
  return viemFormat(value, 18)
}

export function formatSlippage(value: number): string {
  return `${value.toFixed(1)}%`
}
