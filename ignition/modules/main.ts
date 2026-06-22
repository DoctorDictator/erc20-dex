import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import TimCoinModule from "./TimCoin";
import FixedPriceExchangeModule from "./FixedPriceExchange";
import TokenEthAMMModule from "./TokenEthAMM";
import DemoSeedingModule from "./DemoSeeding";

const MainModule = buildModule("MainModule", (m) => {
  const { timCoin } = m.useModule(TimCoinModule);
  const { fixedPriceExchange } = m.useModule(FixedPriceExchangeModule);
  const { tokenEthAMM } = m.useModule(TokenEthAMMModule);
  m.useModule(DemoSeedingModule);

  return { timCoin, fixedPriceExchange, tokenEthAMM };
});

export default MainModule;
