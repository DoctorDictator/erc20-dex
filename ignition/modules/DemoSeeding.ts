import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "ethers";
import TimCoinModule from "./TimCoin";
import FixedPriceExchangeModule from "./FixedPriceExchange";
import TokenEthAMMModule from "./TokenEthAMM";

const ONE_ETH = ethers.parseEther("1");
const ONE_THOUSAND_TIM = ethers.parseEther("1000");
const DEADLINE = Math.floor(Date.now() / 1000) + 86400;

const DemoSeedingModule = buildModule("DemoSeeding", (m) => {
  const shouldSeed = m.getParameter("seed", false);

  if (shouldSeed) {
    const { timCoin } = m.useModule(TimCoinModule);
    const { fixedPriceExchange } = m.useModule(FixedPriceExchangeModule);
    const { tokenEthAMM } = m.useModule(TokenEthAMMModule);

    const user1 = m.getAccount(1);
    const user2 = m.getAccount(2);

    const transferAmount = ONE_THOUSAND_TIM * 10n;
    m.call(timCoin, "transfer", [user1, transferAmount], {
      id: "transfer_tim_user1",
    });
    m.call(timCoin, "transfer", [user2, transferAmount], {
      id: "transfer_tim_user2",
    });

    m.send("send_eth_user1", user1, ONE_ETH * 10n);
    m.send("send_eth_user2", user2, ONE_ETH * 10n);

    const reserveAmount = ONE_THOUSAND_TIM * 100n;
    m.call(timCoin, "approve", [fixedPriceExchange, reserveAmount], {
      id: "approve_fpe",
    });
    m.call(fixedPriceExchange, "depositReserves", [reserveAmount], {
      id: "deposit_reserves",
    });

    const initialTimForAmm = ONE_THOUSAND_TIM * 10n;
    const initialEthForAmm = ONE_ETH * 10n;
    m.call(timCoin, "approve", [tokenEthAMM, initialTimForAmm], {
      id: "approve_amm",
    });
    m.call(tokenEthAMM, "addLiquidity", [initialTimForAmm, DEADLINE], {
      id: "add_liquidity",
      value: initialEthForAmm,
    });
  }

  return {};
});

export default DemoSeedingModule;
