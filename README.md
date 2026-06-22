# ERC-20 DEX

A portfolio-ready decentralized exchange (DEX) featuring a **fixed-price exchange** and a **constant-product automated market maker (AMM)** for the TimCoin (TIM) / ETH pair. Built with Solidity 0.8.27, OpenZeppelin Contracts 5, Hardhat 2 + Ignition, and a React + TypeScript + Vite frontend via Wagmi and Viem.

> **&#x26A0;&#xFE0F; UNAUDITED TESTNET SOFTWARE** — This project is for educational and testnet use only. It has not been audited and is not suitable for mainnet custody of funds.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
  - [TimCoin](#timcoin)
  - [FixedPriceExchange](#fixedpriceexchange)
  - [TokenEthAMM (AMM)](#tokenethamm-amm)
- [Economic Model](#economic-model)
- [Security](#security)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Local Development](#local-development)
  - [Compile](#compile)
  - [Test](#test)
  - [Coverage](#coverage)
  - [Lint](#lint)
  - [Sync ABIs](#sync-abis)
- [Frontend](#frontend)
  - [Features](#frontend-features)
  - [Technology Stack](#frontend-technology-stack)
  - [Components](#components)
  - [Hooks](#hooks)
  - [Utilities](#utilities)
- [Sepolia Deployment](#sepolia-deployment)
  - [Environment Setup](#environment-setup)
  - [Deploy](#deploy)
  - [Post-Deployment](#post-deployment)
- [Scripts Reference](#scripts-reference)
- [Project Structure](#project-structure)
- [CI/CD](#cicd)
- [Technology Stack Summary](#technology-stack-summary)
- [License](#license)

---

## Features

- **Fixed-Price Exchange** — Buy and sell TIM at prices set by the contract owner. Supports configurable buy/sell spread, deadline protection, max cost / min proceeds checks, and ETH overpayment refunds.
- **Automated Market Maker (AMM)** — Constant-product AMM (`x * y = k`) with a 0.3% swap fee accruing to liquidity providers. Supports ETH&#x2192;TIM and TIM&#x2192;ETH swaps, liquidity addition/removal, and ERC-20 LP token representation.
- **ERC-20 LP Tokens** — AMM liquidity is represented by transferable `TIMETH` LP tokens (18 decimals). MINIMUM_LIQUIDITY (1000) is permanently locked to `0xdead` on first deposit, matching Uniswap V2 convention.
- **Demo Seeding** — Optional ignition module provisions the local deployment with initial TIM/ETH balances, exchange reserves, and AMM liquidity to simulate a live environment.
- **Owner Controls** — Two-step ownership transfer, pausable trading, price updates, reserve deposits/withdrawals, and ETH withdrawals.
- **Comprehensive Frontend** — Full-featured React SPA with wallet connection, network switching, transaction lifecycle tracking, decoded error messages, and a responsive dark-themed UI.
- **CI/CD** — GitHub Actions workflow for contract tests, coverage, frontend build, dependency audit, and Slither static analysis.

---

## Architecture

```
&#x250C;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2510;
&#x2502;                   Frontend (React 18 / TypeScript / Vite)                   &#x2502;
&#x2502;         Wagmi 2 + Viem 2 + TanStack React Query 5 + Vitest                  &#x2502;
&#x2502;   &#x250C;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2510;
&#x2502; &#x2502;   Layout (header, network selector, wallet status, tab nav)            &#x2502;
&#x2502; &#x2502;   &#x251C;&#x2500; FixedPriceExchange (buy/sell TIM, quotes, owner controls)       &#x2502;
&#x2502; &#x2502;   &#x2514;&#x2500; TokenEthAMM (swap ETH&#x2194;TIM, add/remove liquidity, LP tracking) &#x2502;
&#x2502; &#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2518;
&#x251C;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x252C;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2510
&#x2502;                   Smart Contracts (Solidity 0.8.27)                    &#x2502;  ABI   &#x2502;
&#x2502;  &#x250C;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2510;  &#x250C;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2510;  &#x250C;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2510;  &#x2502; JSON &#x2502;
&#x2502;  &#x2502;   TimCoin    &#x2502;  &#x2502;FixedPriceEx.&#x2502;  &#x2502;TokenEthAMM&#x2502;  &#x2502;sync  &#x2502;
&#x2502;  &#x2502;  (ERC-20)    &#x2502;  &#x2502; (Exchange)  &#x2502;  &#x2502;(AMM + LP)&#x2502;  &#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2518
&#x2502;  &#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2518  &#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2518  &#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2518
&#x2502;         &#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2534;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2518
&#x2502;                       &#x2502;                                                     &#x2502;
&#x2502;              &#x250C;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2510                       &#x2502;
&#x2502;              &#x2502;   Hardhat 2 + Ignition     &#x2502;                       &#x2502;
&#x2502;              &#x2502;  (compile, deploy, test)   &#x2502;                       &#x2502;
&#x2502;              &#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2518                       &#x2502;
&#x251C;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2534;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2518
&#x2502;               Local Hardhat (chain ID 31337) / Sepolia (chain ID 11155111)       &#x2502;
&#x2514;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2500;&#x2518
```

---

## Smart Contracts

### TimCoin

| Property | Value |
|---|---|
| **File** | `contracts/TimCoin.sol` |
| **Standard** | ERC-20 (via OpenZeppelin) |
| **Name** | TimCoin |
| **Symbol** | TIM |
| **Decimals** | 18 |
| **Max Supply** | 1,000,000 TIM (`1_000_000 * 10^18`) |
| **Minting** | Entire supply minted to deployer at construction |

A simple fixed-supply ERC-20 token. No additional minting, burning, or pausing capabilities. All 1,000,000 TIM are minted to the contract deployer, who then distributes tokens to the exchange contracts and users.

### FixedPriceExchange

| Property | Value |
|---|---|
| **File** | `contracts/FixedPriceExchange.sol` |
| **Inherits** | `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| **Token** | Immutable reference to the TIM ERC-20 contract |

A fixed-price exchange where the owner sets `buyPrice` and `sellPrice` in wei per whole TIM (18 decimals). The buy price must be >= the sell price; the spread represents the exchange's profit margin.

**Key Functions:**

| Function | Description |
|---|---|
| `setPrices(buyPrice, sellPrice)` | Owner-only. Updates both prices atomically. Reverts if prices are zero or spread is invalid. |
| `depositReserves(amount)` | Anyone can deposit TIM reserves into the contract. |
| `withdrawReserves(amount)` | Owner-only. Withdraws TIM reserves. |
| `withdrawETH()` | Owner-only. Withdraws accumulated ETH from token sales. |
| `getBuyQuote(amountOut)` | View. Returns the ETH cost to buy `amountOut` TIM. |
| `getSellQuote(amountIn)` | View. Returns the ETH proceeds from selling `amountIn` TIM. |
| `buyTokens(amountOut, deadline, maxCost)` | Payable. Buys TIM at the current buy price. Refunds excess ETH. Reverts if deadline has passed or cost exceeds maxCost. |
| `sellTokens(amountIn, deadline, minProceeds)` | Sells TIM at the current sell price. Reverts if deadline has passed or proceeds are below minProceeds. |
| `pause()` / `unpause()` | Owner-only. Pauses/unpauses buying and selling. |

### TokenEthAMM (AMM)

| Property | Value |
|---|---|
| **File** | `contracts/TokenEthAMM.sol` |
| **Inherits** | `ERC20`, `Ownable2Step`, `ReentrancyGuard`, `Pausable` |
| **LP Token Name** | TIM-ETH LP |
| **LP Token Symbol** | TIMETH |
| **LP Token Decimals** | 18 |
| **Swap Fee** | 0.3% (3 / 1000) |
| **Minimum Liquidity** | 1000 (locked to `0xdead` on first deposit) |

A constant-product automated market maker for the TIM/ETH pair following the Uniswap V2 model. Liquidity providers earn a 0.3% fee on every swap, proportional to their share of the pool.

**Key Functions:**

| Function | Description |
|---|---|
| `addLiquidity(timAmount, deadline)` | Payable. Adds liquidity to the pool. On first deposit, sets the initial ratio. On subsequent deposits, uses the optimal ratio and refunds excess ETH. MINIMUM_LIQUIDITY (1000) is minted to `0xdead`. |
| `removeLiquidity(lpAmount, minEth, minTim, deadline)` | Burns LP tokens and returns proportional ETH and TIM. Slippage protection via minEth/minTim. |
| `swapExactETHForTokens(minTimOut, deadline)` | Payable. Swaps exact ETH for TIM. Calculates output using the constant product formula with 0.3% fee. |
| `swapExactTokensForETH(timIn, minEthOut, deadline)` | Swaps exact TIM for ETH with 0.3% fee. |
| `getAmountOut(inputAmount, inputReserve, outputReserve)` | Pure view. Returns the output amount for a given input and reserves using the fee-adjusted formula: `(input * 997 * outputReserve) / (inputReserve * 1000 + input * 997)`. |
| `getReserves()` | View. Returns the current ETH and TIM reserves. |
| `sync()` | Anyone can sync reserves to actual contract balances (useful after direct transfers). |
| `pause()` / `unpause()` | Owner-only. Pauses swaps and liquidity additions; LP withdrawals remain available. |

**How the AMM works:**

1. The constant product formula is `k = ethReserve * timReserve`.
2. Swaps must maintain `k` (k increases slightly due to fees, which benefits LPs).
3. A 0.3% fee is taken on each swap: 0.3% of the input is withheld, and 99.7% is traded.
4. LP tokens are minted when liquidity is added and burned when it is removed.
5. The first liquidity provider sets the initial price ratio. Subsequent providers must add liquidity at the current ratio (optimal amounts are calculated automatically; excess ETH is refunded).

---

## Economic Model

### FixedPriceExchange

- `buyPrice >= sellPrice` enforced by the contract.
- The spread (`buyPrice - sellPrice`) is the exchange's revenue.
- Prices are denominated in wei per whole TIM. For example, a buy price of `0.001 ETH` per TIM means `buyPrice = 10^15`.
- Users buy TIM from the exchange at the higher buy price and sell TIM to the exchange at the lower sell price.
- The exchange owner manages TIM reserves and can withdraw accumulated ETH.

### TokenEthAMM

- Constant product formula: `k = ethReserve * timReserve`.
- All swaps charge a 0.3% fee that stays in the pool, increasing `k` over time.
- Liquidity providers earn fees proportional to their LP token share.
- LP tokens are ERC-20 and freely transferable.
- The pool price is determined by the reserve ratio: `price = ethReserve / timReserve` (ETH per TIM).
- Swap price impact is proportional to the swap size relative to pool depth.

### Demo Seeding (Local Only)

When deploying with `--parameters '{"DemoSeeding":{"seed":true}}'`:

| Action | Details |
|---|---|
| TIM to user1 | 10,000 TIM |
| TIM to user2 | 10,000 TIM |
| ETH to user1 | 10 ETH |
| ETH to user2 | 10 ETH |
| FPE reserves | 100,000 TIM deposited |
| AMM initial liquidity | 10 ETH + 10,000 TIM (= 1,000 TIM per ETH) |

Default prices on the fixed-price exchange are `0.001 ETH` per TIM for both buy and sell (no spread). These can be updated by the owner after deployment.

---

## Security

- **`ReentrancyGuard`** — Applied to all state-mutating functions on both exchange contracts.
- **`Pausable`** — Trading (and liquidity addition on the AMM) can be paused by the owner. LP withdrawals and reserve management remain functional during pauses.
- **`Ownable2Step`** — Ownership transfers require the new owner to accept, preventing accidental transfers to incorrect addresses.
- **`SafeERC20`** — All ERC-20 transfers use OpenZeppelin's safe wrappers to handle non-standard token implementations.
- **Checks-Effects-Interactions** — State changes precede external calls throughout.
- **Custom Errors** — Gas-efficient revert messages via Solidity `error` types.
- **Slippage Protection** — Every trade and liquidity operation accepts deadline, minimum output, or maximum input parameters.
- **ETH Refunds** — Overpaid ETH is refunded atomically within the same transaction.
- **Minimum Liquidity Lock** — The first 1000 LP tokens are permanently sent to `0xdead`, preventing pool manipulation.
- **Reserve Validation** — All operations check reserve sufficiency before executing transfers.

---

## Getting Started

### Prerequisites

- **Node.js 22 LTS** (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- A wallet (e.g., [MetaMask](https://metamask.io/)) for frontend interaction
- (For Sepolia) An RPC URL, private key, and Etherscan API key

### Installation

Install all dependencies (root + frontend):

```bash
npm run install:all
```

Or install separately:

```bash
npm install
cd frontend && npm install
```

### Local Development

Run three terminals in parallel:

**Terminal 1 — Start Hardhat Network:**

```bash
npm run node
```

This starts a local Hardhat node at `http://127.0.0.1:8545` (chain ID 31337) with 20 pre-funded accounts.

**Terminal 2 — Deploy with demo seeding:**

```bash
npx hardhat ignition deploy ignition/modules/main.ts --network localhost --parameters '{"DemoSeeding":{"seed":true}}'
```

The `seed:true` parameter provisions the exchange with initial liquidity and distributes TIM/ETH to test accounts (accounts 1 and 2 from the Hardhat node).

You can also deploy without seeding:

```bash
npm run deploy:local
```

**Terminal 3 — Start the frontend:**

```bash
npm run frontend:dev
```

Open http://localhost:5173 and connect MetaMask to `http://127.0.0.1:8545` (chain ID 31337).

**Hardhat accounts for testing:**

| Account | Address (default) | Notes |
|---|---|---|
| #0 (deployer) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Owner of all contracts, receives all TIM |
| #1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Receives 10,000 TIM and 10 ETH via demo seeding |
| #2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Receives 10,000 TIM and 10 ETH via demo seeding |

### Compile

```bash
npm run compile
```

Compiles all Solidity contracts with the optimizer enabled (200 runs).

### Test

```bash
npm run test
```

Runs the full Hardhat test suite:

| Test File | Description |
|---|---|
| `test/TimCoin.test.ts` | ERC-20 compliance, supply, and ownership tests |
| `test/FixedPriceExchange.test.ts` | Buy/sell, price updates, pausing, reserve management |
| `test/TokenEthAMM.test.ts` | Liquidity operations, swaps, fee accrual, edge cases |
| `test/e2e.test.ts` | End-to-end smoke test covering the complete trading lifecycle |

### Coverage

```bash
npm run coverage
```

Generates a Solidity test coverage report using `solidity-coverage`.

### Lint

```bash
npm run lint        # Check formatting
npm run lint:fix    # Auto-fix formatting
```

Uses Prettier with the `prettier-plugin-solidity` plugin.

### Sync ABIs

```bash
npm run sync-abis
```

Compiles contracts and extracts ABI JSON files from `artifacts/contracts/` to the `abis/` directory for frontend consumption.

---

## Frontend

### Frontend Features

- Wallet connection via injected connectors (MetaMask, Brave Wallet, etc.)
- Network switching between Hardhat Local (31337), Sepolia (11155111), and Mainnet (1)
- **Fixed Price Exchange Tab:**
  - Buy/sell mode toggle
  - Real-time price quotes with slippage-adjusted max cost / min proceeds
  - Configurable deadline
  - TIM balance display
  - Owner controls: set prices, deposit/withdraw reserves, withdraw ETH, pause/unpause
  - Auto-approve flow for selling
- **AMM Tab:**
  - Swap ETH&#x2194;TIM with real-time quotes
  - Price impact calculation and display
  - Configurable slippage and deadline
  - Add liquidity with ETH and TIM inputs
  - Remove liquidity with 25%/50%/75%/100% quick-select buttons
  - LP token balance and pool share display
  - Predicted LP mint amounts and withdrawal estimates
  - Owner pause/unpause
- Transaction lifecycle tracking: idle &#x2192; pending (tx submitted) &#x2192; confirmed / failed
- Decoded smart contract error messages (custom error selector parsing)
- Responsive dark-themed UI with accessible styling
- All amounts use `bigint` arithmetic with Viem formatting (no JS floating point)

### Frontend Technology Stack

| Library | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript 5** | Type safety |
| **Vite 5** | Build tool and dev server |
| **Wagmi 2** | React hooks for Ethereum interaction |
| **Viem 2** | Low-level TypeScript Ethereum interface |
| **TanStack React Query 5** | Server state management (caching, refetching) |
| **Vitest 2** | Unit testing |
| **jsdom** | DOM environment for tests |

### Components

| Component | File | Description |
|---|---|---|
| `App` | `frontend/src/App.tsx` | Root component with tab navigation (Fixed Price / AMM) |
| `Layout` | `frontend/src/components/Layout.tsx` | App shell with header, network selector, and wallet status |
| `WalletStatus` | `frontend/src/components/WalletStatus.tsx` | Connect/disconnect button, network badge, TIM balance |
| `FixedPriceExchange` | `frontend/src/components/FixedPriceExchange.tsx` | Complete fixed-price exchange UI with trading and owner panel |
| `TokenEthAMM` | `frontend/src/components/TokenEthAMM.tsx` | Complete AMM UI with swap and liquidity management |

### Hooks

| Hook | File | Description |
|---|---|---|
| `useWallet` | `frontend/src/hooks/useWallet.ts` | Wallet connection, network switching, chain validation |
| `useContracts` | `frontend/src/hooks/useContracts.ts` | Contract address resolution and ABI definitions for all three contracts |

### Utilities

| Utility | File | Description |
|---|---|---|
| `format.ts` | `frontend/src/utils/format.ts` | Token formatting/parsing with Viem (formatUnits, parseUnits, formatEth, formatTim, formatSlippage) |
| `errors.ts` | `frontend/src/utils/errors.ts` | Contract error decoding (custom error selector mapping), address shortening, explorer URL generation |

### Frontend Tests

```bash
npm run frontend:test
```

Uses Vitest for unit tests on formatting, error parsing, and configuration.

---

## Sepolia Deployment

### Environment Setup

Copy `.env.example` to `.env` and fill in:

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
PRIVATE_KEY=YOUR_PRIVATE_KEY_WITHOUT_0x_PREFIX
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
```

> &#x26A0;&#xFE0F; Never commit `.env`. Add TIM to your wallet and acquire test ETH from a Sepolia faucet.

### Deploy

```bash
npm run deploy:sepolia
```

This runs Hardhat Ignition, which:
1. Compiles contracts (if needed)
2. Deploys all contracts deterministically to Sepolia
3. Verifies contracts on Etherscan
4. Prints the deployed addresses

### Post-Deployment

Sepolia deployment does **not** automatically seed the exchange with TIM or ETH. After deployment:

1. Transfer TIM to the `FixedPriceExchange` contract via `depositReserves()`
2. Approve TIM and add liquidity to the `TokenEthAMM` contract
3. Update `frontend/src/config.ts` with the deployed addresses for Sepolia (chain ID 11155111)

For a more robust production setup, consider generating deployment JSON from Ignition and loading it dynamically.

---

## Scripts Reference

| Script | Command | Description |
|---|---|---|
| `compile` | `npm run compile` | Compile all Solidity contracts with optimizer |
| `test` | `npm run test` | Run all Hardhat contract tests |
| `coverage` | `npm run coverage` | Run tests with Solidity coverage report |
| `lint` | `npm run lint` | Check Solidity formatting with Prettier |
| `lint:fix` | `npm run lint:fix` | Auto-fix Solidity formatting |
| `deploy:local` | `npm run deploy:local` | Deploy to local Hardhat node (localhost) |
| `deploy:sepolia` | `npm run deploy:sepolia` | Deploy to Sepolia with Etherscan verification |
| `node` | `npm run node` | Start Hardhat local network (chain ID 31337) |
| `sync-abis` | `npm run sync-abis` | Compile and extract ABI JSON to `abis/` |
| `frontend:dev` | `npm run frontend:dev` | Start Vite dev server (port 5173) |
| `frontend:build` | `npm run frontend:build` | Build frontend for production |
| `frontend:test` | `npm run frontend:test` | Run frontend unit tests (Vitest) |
| `install:all` | `npm run install:all` | Install root + frontend dependencies |
| `audit` | `npm run audit` | Run npm audit (moderate severity) |

---

## Project Structure

```
&#x250C;&#x2500;&#x2500; .env.example              # Environment variable template
&#x250C;&#x2500; .github/
&#x2502;   &#x2514;&#x2500;&#x2500; workflows/
&#x2502;       &#x2514;&#x2500;&#x2500; ci.yml               # CI pipeline (tests, coverage, frontend, audit, Slither)
&#x250C;&#x2500; abis/                       # Generated ABI JSON files (for frontend)
&#x250C;&#x2500; contracts/                  # Solidity smart contracts
&#x2502;   &#x251C;&#x2500;&#x2500; TimCoin.sol              # ERC-20 token (TIM)
&#x2502;   &#x251C;&#x2500;&#x2500; FixedPriceExchange.sol   # Fixed-price exchange
&#x2502;   &#x2514;&#x2500;&#x2500; TokenEthAMM.sol           # Constant-product AMM
&#x250C;&#x2500; frontend/                   # React + TypeScript + Vite frontend
&#x2502;   &#x251C;&#x2500;&#x2500; src/
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; App.tsx                # Root component with tab navigation
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; config.ts              # Wagmi config, deployment addresses, defaults
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; main.tsx               # Entry point
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; index.css              # Global styles (dark theme)
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; components/
&#x2502;   &#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; Layout.tsx            # App shell with header and nav
&#x2502;   &#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; WalletStatus.tsx      # Wallet connection UI
&#x2502;   &#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; FixedPriceExchange.tsx # Fixed-price exchange UI
&#x2502;   &#x2502;   &#x2502;   &#x2514;&#x2500;&#x2500; TokenEthAMM.tsx        # AMM swap/liquidity UI
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; hooks/
&#x2502;   &#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; useWallet.ts          # Wallet connection hook
&#x2502;   &#x2502;   &#x2502;   &#x2514;&#x2500;&#x2500; useContracts.ts       # Contract address/ABI hooks
&#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; utils/
&#x2502;   &#x2502;   &#x2502;   &#x251C;&#x2500;&#x2500; format.ts             # Token formatting utilities
&#x2502;   &#x2502;   &#x2502;   &#x2514;&#x2500;&#x2500; errors.ts             # Error parsing and address utilities
&#x2502;   &#x2502;   &#x2514;&#x2500;&#x2500; test/                 # Frontend unit tests (Vitest)
&#x2502;   &#x2502;       &#x251C;&#x2500;&#x2500; setup.ts
&#x2502;   &#x2502;       &#x251C;&#x2500;&#x2500; format.test.ts
&#x2502;   &#x2502;       &#x251C;&#x2500;&#x2500; errors.test.ts
&#x2502;   &#x2502;       &#x2514;&#x2500;&#x2500; config.test.ts
&#x2502;   &#x2514;&#x2500;&#x2500; vite.config.ts           # Vite configuration
&#x2502;   &#x2514;&#x2500;&#x2500; package.json
&#x250C;&#x2500; ignition/modules/            # Hardhat Ignition deployment modules
&#x2502;   &#x251C;&#x2500;&#x2500; main.ts                 # Main deployment orchestrator
&#x2502;   &#x251C;&#x2500;&#x2500; TimCoin.ts               # TimCoin deployment
&#x2502;   &#x251C;&#x2500;&#x2500; FixedPriceExchange.ts    # Fixed-price exchange deployment
&#x2502;   &#x251C;&#x2500;&#x2500; TokenEthAMM.ts           # AMM deployment
&#x2502;   &#x2514;&#x2500;&#x2500; DemoSeeding.ts           # Optional demo seeding logic
&#x250C;&#x2500; scripts/                    # Utility scripts
&#x2502;   &#x2514;&#x2500;&#x2500; sync-abis.ts            # ABI extraction script
&#x250C;&#x2500; test/                       # Hardhat test suite (TypeScript + Chai + Mocha)
&#x2502;   &#x251C;&#x2500;&#x2500; TimCoin.test.ts
&#x2502;   &#x251C;&#x2500;&#x2500; FixedPriceExchange.test.ts
&#x2502;   &#x251C;&#x2500;&#x2500; TokenEthAMM.test.ts
&#x2502;   &#x2514;&#x2500;&#x2500; e2e.test.ts
&#x250C;&#x2500; hardhat.config.ts            # Hardhat configuration
&#x250C;&#x2500; package.json                  # Root package (contracts + scripts)
&#x250C;&#x2500; tsconfig.json                 # TypeScript configuration
&#x2514;&#x2500;&#x2500; .prettierrc                  # Prettier configuration for Solidity
```

---

## CI/CD

The repository includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on every push and pull request to `main`:

| Job | Description |
|---|---|
| **Contract Tests** | Compile contracts, run all Hardhat tests, check Solidity formatting |
| **Contract Coverage** | Compile and generate Solidity coverage report |
| **Frontend Build & Lint** | Install frontend deps, build with TypeScript, run typecheck |
| **Dependency Audit** | Run `npm audit` on both root and frontend (moderate severity, failures allowed) |
| **Slither Analysis** | Install Slither via pip and run static analysis on all contracts |

---

## Technology Stack Summary

| Layer | Technology |
|---|---|
| **Smart Contracts** | Solidity 0.8.27, OpenZeppelin Contracts 5.6 |
| **Development Framework** | Hardhat 2, Hardhat Ignition 0.15 |
| **Testing** | Mocha 10, Chai 4, Hardhat Chai Matchers, Hardhat Network Helpers |
| **Type Safety** | TypeScript 5, TypeChain, Ethers v6 |
| **Coverage** | solidity-coverage |
| **Gas Reporting** | hardhat-gas-reporter |
| **Linting** | Prettier, prettier-plugin-solidity |
| **Static Analysis** | Slither |
| **Frontend Framework** | React 18 |
| **Build Tool** | Vite 5 |
| **Web3 Libraries** | Wagmi 2, Viem 2 |
| **State Management** | TanStack React Query 5 |
| **Frontend Testing** | Vitest 2, Testing Library, jsdom |
| **Deployment** | Hardhat Ignition (deterministic, Etherscan verification) |
| **CI** | GitHub Actions (Ubuntu latest, Node 22, Python 3.12) |

---

## Deployed Addresses

After local deployment, addresses are written by Hardhat Ignition. The frontend reads from `frontend/src/config.ts` which contains hardcoded addresses for the local Hardhat network (chain ID 31337):

| Contract | Address |
|---|---|
| **TimCoin** | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| **FixedPriceExchange** | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| **TokenEthAMM** | `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0` |

Default configuration: `DEFAULT_SLIPPAGE = 0.5%`, `DEFAULT_DEADLINE_MINUTES = 20`.

Update these addresses after Sepolia deployment or consider generating a deployment JSON file from Ignition and loading it dynamically for production use.

---

## License

This project is MIT licensed. See the LICENSE file for details.
