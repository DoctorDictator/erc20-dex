import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TimCoinModule = buildModule("TimCoin", (m) => {
  const timCoin = m.contract("TimCoin");

  return { timCoin };
});

export default TimCoinModule;
