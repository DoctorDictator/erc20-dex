import { type BaseError, ContractFunctionRevertedError } from 'viem'

const errorSelectors: Record<string, string> = {
  '0x0b8f21f8': 'ZeroPrice',
  '0x5f2c4ec1': 'InvalidPriceSpread',
  '0x72abf421': 'DeadlineExpired',
  '0x558a5087': 'CostExceedsMaxCost',
  '0xbb1ad9c7': 'InsufficientPayment',
  '0x0a4a3fbf': 'ProceedsBelowMin',
  '0x5079153b': 'ETHTransferFailed',
  '0xf1eae29a': 'ZeroAmount',
  '0xbbcdb2d0': 'InsufficientLiquidity',
  '0x9a39c11a': 'InsufficientOutput',
  '0x7c076f41': 'InsufficientReserves',
}

export function parseContractError(error: unknown): string {
  if (!error) return 'Unknown error'

  if (typeof error === 'string') return error

  if (error instanceof Error) {
    const baseError = error as BaseError

    const revertError = baseError.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revertError instanceof ContractFunctionRevertedError) {
      const data = revertError.data as any
      if (data && typeof data === 'object' && 'args' in data && Array.isArray(data.args)) {
        return data.args.join(', ')
      }
      if (typeof data === 'string' && data.startsWith('0x')) {
        const selector = data.slice(0, 10) as keyof typeof errorSelectors
        if (errorSelectors[selector]) {
          return errorSelectors[selector]
        }
      }
      const errName = revertError.metaMessages?.join(' ')
      if (errName) return errName
      return revertError.shortMessage || revertError.message
    }

    const shortMessage = (error as any).shortMessage
    if (shortMessage) return shortMessage

    const message = error.message
    if (message.includes('User rejected') || message.includes('user rejected')) {
      return 'Transaction rejected by user'
    }
    return message || 'Unknown error'
  }

  return String(error)
}

export function shortenAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  switch (chainId) {
    case 1:
      return `https://etherscan.io/tx/${txHash}`
    case 11155111:
      return `https://sepolia.etherscan.io/tx/${txHash}`
    default:
      return ''
  }
}
