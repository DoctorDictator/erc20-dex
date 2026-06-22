import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "ethers";
import TimCoinModule from "./TimCoin";

const FixedPriceExchangeModule = buildModule("FixedPriceExchange", (m) => {
  const { timCoin } = m.useModule(TimCoinModule);

  const buyPrice = m.getParameter("buyPrice", ethers.parseEther("0.001"));
  const sellPrice = m.getParameter("sellPrice", ethers.parseEther("0.001"));

  const fixedPriceExchange = m.contract("FixedPriceExchange", [
    timCoin,
    buyPrice,
    sellPrice,
  ]);

  return { fixedPriceExchange };
});

export default FixedPriceExchangeModule;
