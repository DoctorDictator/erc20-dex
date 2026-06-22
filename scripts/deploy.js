/*
 * Hardhat deployment script — deploys Token and DEX contracts, then saves
 * deployment metadata (address, ABI, signer) to JSON files.
 *
 * Run: npx hardhat run scripts/deploy.js [--network <name>]
 */

const hre = require("hardhat");
const fs = require("fs/promises");

async function main() {
  // ─── Step 1: Deploy Token ────────────────────────────────────────────
  // ContractFactory loads compiled artifacts and binds to the deployer wallet.
  const Token = await hre.ethers.getContractFactory("Token");
  // Deploy with initial supply of 100 tokens (18 decimal places → 100 * 10^18)
  const token = await Token.deploy("100");
  console.log(`Token deployed at: ${token.address}`);

  // ─── Step 2: Deploy DEX ──────────────────────────────────────────────
  // The DEX needs the token address and a per-token price in wei.
  const DEX = await hre.ethers.getContractFactory("DEX");
  const dex = await DEX.deploy(token.address, 100);  // price = 100 wei/token
  console.log(`DEX deployed at: ${dex.address}`);

  // ─── Step 3: Wait for confirmations ──────────────────────────────────
  await token.deployed();
  await dex.deployed();

  // ─── Step 4: Save deployment info to JSON files ──────────────────────
  // Used by the frontend to know contract addresses and ABIs.
  await writeDeploymentInfo(token, "token.json");
  await writeDeploymentInfo(dex, "dex.json");

  console.log("\nDeployment complete.");
  console.log(`Token: ${token.address}`);
  console.log(`DEX:   ${dex.address}`);
}

/**
 * Write contract metadata (network, address, signer, ABI) to a JSON file.
 * @param {Object} contract - ethers.Contract instance (deployed)
 * @param {string} filename - Output file path
 */
async function writeDeploymentInfo(contract, filename = "") {
  const data = {
    network: hre.network.name,
    contract: {
      address: contract.address,
      signerAddress: contract.signer.address,
      abi: contract.interface.format(),
    },
  };
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(filename, content, { encoding: "utf-8" });
  console.log(`  Info saved → ${filename}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
