import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts", "contracts");
const ABIS_DIR = path.join(__dirname, "..", "abis");

const CONTRACTS = ["TimCoin.sol", "FixedPriceExchange.sol", "TokenEthAMM.sol"];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function syncAbis() {
  ensureDir(ABIS_DIR);

  for (const contract of CONTRACTS) {
    const jsonFile = contract.replace(".sol", ".json");
    const artifactPath = path.join(ARTIFACTS_DIR, contract, jsonFile);
    const abiPath = path.join(ABIS_DIR, jsonFile);

    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
      const abi = JSON.stringify(artifact.abi, null, 2);
      fs.writeFileSync(abiPath, abi, "utf-8");
      console.log(`Synced ABI for ${contract}`);
    } else {
      console.warn(`Artifact not found for ${contract} at ${artifactPath}`);
    }
  }

  console.log("ABI synchronization complete.");
}

try {
  execSync("npx hardhat compile", { cwd: path.join(__dirname, ".."), stdio: "pipe" });
} catch {
  console.log("Compilation step skipped or already compiled.");
}

syncAbis();
