import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { type FixedPriceExchange, type TimCoin, type TokenEthAMM } from "../typechain-types";

const BUY_PRICE = ethers.parseEther("0.001");
const SELL_PRICE = ethers.parseEther("0.0009");
const DEADLINE = 2_000_000_000_000;

function getAmountOut(inputAmount: bigint, inputReserve: bigint, outputReserve: bigint): bigint {
  const inputWithFee = inputAmount * 997n;
  const numerator = inputWithFee * outputReserve;
  const denominator = inputReserve * 1000n + inputWithFee;
  return numerator / denominator;
}

describe("E2E: Full System Smoke Test", function () {
  async function deployAllFixture() {
    const [deployer, user] = await ethers.getSigners();

    const TimCoin = await ethers.getContractFactory("TimCoin");
    const timCoin = await TimCoin.deploy() as unknown as TimCoin;

    const FixedPriceExchange = await ethers.getContractFactory("FixedPriceExchange");
    const fixedExchange = await FixedPriceExchange.deploy(
      await timCoin.getAddress(),
      BUY_PRICE,
      SELL_PRICE
    ) as unknown as FixedPriceExchange;

    const TokenEthAMM = await ethers.getContractFactory("TokenEthAMM");
    const amm = await TokenEthAMM.deploy(await timCoin.getAddress()) as unknown as TokenEthAMM;

    return { timCoin, fixedExchange, amm, deployer, user };
  }

  it("should run a complete trading lifecycle", async function () {
    const { timCoin, fixedExchange, amm, deployer, user } = await loadFixture(deployAllFixture);

    const fixedAddress = await fixedExchange.getAddress();
    const ammAddress = await amm.getAddress();
    const timDecimals = 18n;

    // === 1. Seed FixedPriceExchange with TIM reserves ===
    const reserveTim = ethers.parseEther("50000");
    await timCoin.approve(fixedAddress, reserveTim);
    await fixedExchange.depositReserves(reserveTim);
    expect(await timCoin.balanceOf(fixedAddress)).to.equal(reserveTim);

    // === 2. Perform a buy on FixedPriceExchange ===
    const buyAmount = ethers.parseEther("100");
    const buyCost = await fixedExchange.getBuyQuote(buyAmount);

    await fixedExchange.connect(user).buyTokens(buyAmount, DEADLINE, buyCost, { value: buyCost });
    expect(await timCoin.balanceOf(user.address)).to.equal(buyAmount);

    // === 3. Perform a sell-back on FixedPriceExchange ===
    const sellAmount = ethers.parseEther("40");
    const sellProceeds = await fixedExchange.getSellQuote(sellAmount);
    await timCoin.connect(user).approve(fixedAddress, sellAmount);

    const userEthBeforeSell = await ethers.provider.getBalance(user.address);
    await fixedExchange.connect(user).sellTokens(sellAmount, DEADLINE, 0);
    const userEthAfterSell = await ethers.provider.getBalance(user.address);

    expect(await timCoin.balanceOf(user.address)).to.equal(buyAmount - sellAmount);
    expect(userEthAfterSell - userEthBeforeSell).to.be.closeTo(sellProceeds, ethers.parseEther("0.001"));

    // === 4. Seed the AMM with initial liquidity ===
    const ammEth = ethers.parseEther("10");
    const ammTim = ethers.parseEther("10000");
    await timCoin.connect(deployer).approve(ammAddress, ammTim);
    await amm.connect(deployer).addLiquidity(ammTim, DEADLINE, { value: ammEth });

    const [ethReserve, timReserve] = await amm.getReserves();
    expect(ethReserve).to.equal(ammEth);
    expect(timReserve).to.equal(ammTim);

    const totalLp = await amm.totalSupply();
    expect(totalLp).to.be.gt(0);
    expect(await amm.balanceOf(deployer.address)).to.equal(totalLp - 1000n);
    expect(await amm.balanceOf("0x000000000000000000000000000000000000dEaD")).to.equal(1000n);

    // === 5. Perform a swap on the AMM (ETH → TIM) ===
    const swapEthIn = ethers.parseEther("1");
    const [ethReserveBefore, timReserveBefore] = await amm.getReserves();
    const expectedTimOut = getAmountOut(swapEthIn, ethReserveBefore, timReserveBefore);

    await amm.connect(user).swapExactETHForTokens(0, DEADLINE, { value: swapEthIn });

    const [ethReserveAfter, timReserveAfter] = await amm.getReserves();
    expect(ethReserveAfter).to.equal(ethReserveBefore + swapEthIn);
    expect(timReserveAfter).to.equal(timReserveBefore - expectedTimOut);
    expect(await timCoin.balanceOf(user.address)).to.equal(buyAmount - sellAmount + expectedTimOut);

    const kBefore = ethReserveBefore * timReserveBefore;
    const kAfter = ethReserveAfter * timReserveAfter;
    expect(kAfter).to.be.greaterThan(kBefore);

    // === 6. Remove LP liquidity from the AMM ===
    const lpBalance = await amm.balanceOf(deployer.address);
    const userTimBeforeRemove = await timCoin.balanceOf(deployer.address);
    const userEthBeforeRemove = await ethers.provider.getBalance(deployer.address);

    const tx = await amm.connect(deployer).removeLiquidity(lpBalance, 0, 0, DEADLINE);
    const receipt = await tx.wait();
    const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    const userTimAfterRemove = await timCoin.balanceOf(deployer.address);
    const userEthAfterRemove = await ethers.provider.getBalance(deployer.address);

    const totalSupply = totalLp;
    const expectedEthReturn = (lpBalance * ethReserveAfter) / totalSupply;
    const expectedTimReturn = (lpBalance * timReserveAfter) / totalSupply;

    expect(userTimAfterRemove - userTimBeforeRemove).to.equal(expectedTimReturn);
    expect(userEthAfterRemove - userEthBeforeRemove + gasCost).to.equal(expectedEthReturn);

    expect(await amm.balanceOf(deployer.address)).to.equal(0n);

    // === 7. Verify final system state ===
    const [finalEth, finalTim] = await amm.getReserves();
    expect(finalEth).to.equal(ethReserveAfter - expectedEthReturn);
    expect(finalTim).to.equal(timReserveAfter - expectedTimReturn);

    const finalLpSupply = await amm.totalSupply();
    expect(finalLpSupply).to.equal(totalSupply - lpBalance);

    expect(await timCoin.balanceOf(fixedAddress)).to.equal(reserveTim - buyAmount + sellAmount);
  });
});
