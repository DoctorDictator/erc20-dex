import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import TimCoinModule from "./TimCoin";

const TokenEthAMMModule = buildModule("TokenEthAMM", (m) => {
  const { timCoin } = m.useModule(TimCoinModule);

  const tokenEthAMM = m.contract("TokenEthAMM", [timCoin]);

  return { tokenEthAMM };
});

export default TokenEthAMMModule;
