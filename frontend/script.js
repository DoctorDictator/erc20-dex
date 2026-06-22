/*
 * DEX Frontend — connects base.html to the Ethereum blockchain via MetaMask.
 *
 * Uses ethers.js (v5) loaded from CDN. Relies on window.ethereum injected
 * by the user's browser wallet.
 */

// ─── Provider & Signer ────────────────────────────────────────────────
// Provider reads data from the chain; Signer signs transactions (user's wallet).
const provider = new ethers.providers.Web3Provider(window.ethereum);
let signer;

// ─── Token Contract ────────────────────────────────────────────────────
// Human-readable ABI — ethers.js parses these strings to encode/decode calls.
const tokenAbi = [
  "constructor(uint256 initialSupply)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function decreaseAllowance(address spender, uint256 subtractedValue) returns (bool)",
  "function increaseAllowance(address spender, uint256 addedValue) returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
];
// Address of the deployed Token contract (Hardhat localhost default)
const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
let tokenContract = null;

// ─── DEX Contract ──────────────────────────────────────────────────────
const dexAbi = [
  "constructor(address _token, uint256 _price)",
  "function associatedToken() view returns (address)",
  "function buy(uint256 numTokens) payable",
  "function getPrice(uint256 numTokens) view returns (uint256)",
  "function getTokenBalance() view returns (uint256)",
  "function sell()",
  "function withdrawFunds()",
  "function withdrawTokens()",
];
// Address of the deployed DEX contract (Hardhat localhost default)
const dexAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
let dexContract = null;

// ─── Wallet Connection ──────────────────────────────────────────────────

/**
 * Connect to MetaMask and instantiate contract objects.
 * Called at the top of every other function — skips if already connected.
 */
async function getAccess() {
  if (tokenContract) return;
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  tokenContract = new ethers.Contract(tokenAddress, tokenAbi, signer);
  dexContract = new ethers.Contract(dexAddress, dexAbi, signer);
}

// ─── General Information ───────────────────────────────────────────────

/** Fetch & display the price of 1 token (wei). Returns the price value. */
async function getPrice() {
  await getAccess();
  const price = await dexContract.getPrice(1);
  document.getElementById("tokenPrice").innerHTML = price;
  return price;
}

/** Fetch & display the connected wallet's token balance. */
async function getTokenBalance() {
  await getAccess();
  const balance = await tokenContract.balanceOf(await signer.getAddress());
  document.getElementById("tokensBalance").innerHTML = balance;
}

/** Fetch & display how many tokens the DEX currently holds. */
async function getAvailableTokens() {
  await getAccess();
  const tokens = await dexContract.getTokenBalance();
  document.getElementById("tokensAvailable").innerHTML = tokens;
}

// ─── Owner Actions ─────────────────────────────────────────────────────

/** Approve the DEX to spend the specified number of tokens. */
async function grantAccess() {
  await getAccess();
  const value = document.getElementById("tokenGrant").value;
  await tokenContract
    .approve(dexAddress, value)
    .then(() => alert("success"))
    .catch((error) => alert(error));
}

/** Sell (deposit) approved tokens into the DEX contract. */
async function sell() {
  await getAccess();
  await dexContract
    .sell()
    .then(() => alert("Success"))
    .catch((error) => alert(error));
}

// ─── User Actions ──────────────────────────────────────────────────────

/** Buy tokens from the DEX by sending the calculated amount of ETH. */
async function buy() {
  await getAccess();
  const tokenAmount = document.getElementById("tokensToBuy").value;
  const value = (await getPrice()) * tokenAmount;
  await dexContract
    .buy(tokenAmount, { value: value })
    .then(() => alert("Success"))
    .catch((error) => alert(error));
}
