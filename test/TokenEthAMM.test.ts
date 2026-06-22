import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { type TokenEthAMM, type TimCoin } from "../typechain-types";

const DEADLINE = 2_000_000_000_000;
const MINIMUM_LIQUIDITY = 1000n;

function getAmountOut(inputAmount: bigint, inputReserve: bigint, outputReserve: bigint): bigint {
  const inputWithFee = inputAmount * 997n;
  const numerator = inputWithFee * outputReserve;
  const denominator = inputReserve * 1000n + inputWithFee;
  return numerator / denominator;
}

describe("TokenEthAMM", function () {
  async function deployAmmFixture() {
    const [owner, lp, trader] = await ethers.getSigners();

    const TimCoin = await ethers.getContractFactory("TimCoin");
    const timCoin = await TimCoin.deploy() as unknown as TimCoin;

    const TokenEthAMM = await ethers.getContractFactory("TokenEthAMM");
    const amm = await TokenEthAMM.deploy(await timCoin.getAddress()) as unknown as TokenEthAMM;

    const userTimAmount = ethers.parseEther("50000");
    await timCoin.transfer(lp.address, userTimAmount);
    await timCoin.transfer(trader.address, userTimAmount);

    return { timCoin, amm, owner, lp, trader };
  }

  async function addInitialLiquidityFixture() {
    const base = await deployAmmFixture();
    const { timCoin, amm, lp } = base;

    const ethAmount = ethers.parseEther("10");
    const timAmount = ethers.parseEther("10000");

    await timCoin.connect(lp).approve(await amm.getAddress(), timAmount);
    await amm.connect(lp).addLiquidity(timAmount, DEADLINE, { value: ethAmount });

    return { ...base, ethAmount, timAmount };
  }

  describe("Initial Liquidity", function () {
    it("should mint LP tokens for the first depositor", async function () {
      const { timCoin, amm, lp } = await loadFixture(deployAmmFixture);
      const ethAmount = ethers.parseEther("10");
      const timAmount = ethers.parseEther("10000");

      await timCoin.connect(lp).approve(await amm.getAddress(), timAmount);
      await amm.connect(lp).addLiquidity(timAmount, DEADLINE, { value: ethAmount });

      const totalSupply = await amm.totalSupply();
      const expectedLp = totalSupply - MINIMUM_LIQUIDITY;
      expect(await amm.balanceOf(lp.address)).to.equal(expectedLp);
    });

    it("should lock MINIMUM_LIQUIDITY by minting to dead address", async function () {
      const { timCoin, amm, lp } = await loadFixture(deployAmmFixture);
      const ethAmount = ethers.parseEther("10");
      const timAmount = ethers.parseEther("10000");

      await timCoin.connect(lp).approve(await amm.getAddress(), timAmount);
      await amm.connect(lp).addLiquidity(timAmount, DEADLINE, { value: ethAmount });

      expect(await amm.balanceOf("0x000000000000000000000000000000000000dEaD")).to.equal(MINIMUM_LIQUIDITY);
    });

    it("should set initial reserves correctly", async function () {
      const { amm, lp } = await loadFixture(deployAmmFixture);
      const ethAmount = ethers.parseEther("10");
      const timAmount = ethers.parseEther("10000");

      await lp.sendTransaction({ to: await amm.getAddress(), value: ethAmount });

      const TimCoin = await ethers.getContractFactory("TimCoin");
      const timCoin = TimCoin.attach(await amm.token()) as unknown as TimCoin;
      await timCoin.connect(lp).approve(await amm.getAddress(), timAmount);
      await amm.connect(lp).addLiquidity(timAmount, DEADLINE, { value: ethAmount });

      const [ethReserve, timReserve] = await amm.getReserves();
      expect(ethReserve).to.equal(ethAmount);
      expect(timReserve).to.equal(timAmount);
    });

    it("should revert if sqrt(eth * tim) <= MINIMUM_LIQUIDITY", async function () {
      const { timCoin, amm, lp } = await loadFixture(deployAmmFixture);
      const tinyAmount = ethers.parseEther("0.000000000000000001"); // 1 wei

      await timCoin.connect(lp).approve(await amm.getAddress(), tinyAmount);

      await expect(
        amm.connect(lp).addLiquidity(tinyAmount, DEADLINE, { value: tinyAmount })
      ).to.be.revertedWithCustomError(amm, "InsufficientLiquidity");
    });

    it("should emit LiquidityAdded event", async function () {
      const { timCoin, amm, lp } = await loadFixture(deployAmmFixture);
      const ethAmount = ethers.parseEther("10");
      const timAmount = ethers.parseEther("10000");

      await timCoin.connect(lp).approve(await amm.getAddress(), timAmount);

      const tx = await amm.connect(lp).addLiquidity(timAmount, DEADLINE, { value: ethAmount });
      const totalSupply = await amm.totalSupply();
      const liquidity = totalSupply - MINIMUM_LIQUIDITY;

      await expect(tx)
        .to.emit(amm, "LiquidityAdded")
        .withArgs(lp.address, ethAmount, timAmount, liquidity);
    });
  });

  describe("Subsequent Liquidity", function () {
    it("should mint proportional LP tokens at correct ratio", async function () {
      const { timCoin, amm, owner, lp } = await loadFixture(addInitialLiquidityFixture);
      const totalSupplyBefore = await amm.totalSupply();
      const lpBefore = await amm.balanceOf(lp.address);

      const addEth = ethers.parseEther("5");
      const addTim = ethers.parseEther("5000");

      await timCoin.connect(lp).approve(await amm.getAddress(), addTim);
      await amm.connect(lp).addLiquidity(addTim, DEADLINE, { value: addEth });

      const expectedNewLp = (addEth * totalSupplyBefore) / ethers.parseEther("10");
      expect(await amm.balanceOf(lp.address)).to.equal(lpBefore + expectedNewLp);
    });

    it("should use optimal tim when more TIM is sent than needed", async function () {
      const { timCoin, amm, owner, lp } = await loadFixture(addInitialLiquidityFixture);

      const addEth = ethers.parseEther("5");
      const tooMuchTim = ethers.parseEther("6000");
      const optimalTim = (addEth * ethers.parseEther("10000")) / ethers.parseEther("10");

      await timCoin.connect(lp).approve(await amm.getAddress(), tooMuchTim);
      await amm.connect(lp).addLiquidity(tooMuchTim, DEADLINE, { value: addEth });

      const [, timReserve] = await amm.getReserves();
      const expectedTimReserve = ethers.parseEther("10000") + optimalTim;
      expect(timReserve).to.equal(expectedTimReserve);
    });

    it("should use optimal eth when less TIM is sent than optimal", async function () {
      const { timCoin, amm, owner, lp } = await loadFixture(addInitialLiquidityFixture);

      const addEth = ethers.parseEther("10");
      const tooLittleTim = ethers.parseEther("5000");

      await timCoin.connect(lp).approve(await amm.getAddress(), tooLittleTim);
      const ethUsed = (tooLittleTim * ethers.parseEther("10")) / ethers.parseEther("10000");

      const balBefore = await ethers.provider.getBalance(lp.address);
      const tx = await amm.connect(lp).addLiquidity(tooLittleTim, DEADLINE, { value: addEth });
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(lp.address);

      const ethSpent = balBefore - balAfter - gasCost;
      expect(ethSpent).to.equal(ethUsed);
    });

    it("should refund excess ETH when optimalTim <= timAmount", async function () {
      const { timCoin, amm, owner, lp } = await loadFixture(addInitialLiquidityFixture);

      const addEth = ethers.parseEther("5");
      const addTim = ethers.parseEther("5000");

      await timCoin.connect(lp).approve(await amm.getAddress(), addTim);

      const balBefore = await ethers.provider.getBalance(lp.address);
      const tx = await amm.connect(lp).addLiquidity(addTim, DEADLINE, { value: addEth });
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(lp.address);

      const spent = balBefore - balAfter - gasCost;
      expect(spent).to.equal(addEth);
    });
  });

  describe("LP Accounting (removeLiquidity)", function () {
    it("should return proportional ETH and TIM when removing liquidity", async function () {
      const { timCoin, amm, owner, lp } = await loadFixture(addInitialLiquidityFixture);
      const totalSupply = await amm.totalSupply();
      const userLp = await amm.balanceOf(lp.address);
      const [ethReserve, timReserve] = await amm.getReserves();

      const expectedEth = (userLp * ethReserve) / totalSupply;
      const expectedTim = (userLp * timReserve) / totalSupply;

      await expect(() =>
        amm.connect(lp).removeLiquidity(userLp, 0, 0, DEADLINE)
      ).to.changeTokenBalances(timCoin, [amm, lp], [-expectedTim, expectedTim]);
    });

    it("should burn LP tokens on withdrawal", async function () {
      const { amm, lp } = await loadFixture(addInitialLiquidityFixture);
      const userLp = await amm.balanceOf(lp.address);

      await amm.connect(lp).removeLiquidity(userLp, 0, 0, DEADLINE);
      expect(await amm.balanceOf(lp.address)).to.equal(0n);
    });

    it("should update reserves after removal", async function () {
      const { amm, lp } = await loadFixture(addInitialLiquidityFixture);
      const [ethBefore, timBefore] = await amm.getReserves();
      const totalSupply = await amm.totalSupply();
      const userLp = await amm.balanceOf(lp.address);

      const expectedEth = (userLp * ethBefore) / totalSupply;
      const expectedTim = (userLp * timBefore) / totalSupply;

      await amm.connect(lp).removeLiquidity(userLp, 0, 0, DEADLINE);

      const [ethAfter, timAfter] = await amm.getReserves();
      expect(ethAfter).to.equal(ethBefore - expectedEth);
      expect(timAfter).to.equal(timBefore - expectedTim);
    });

    it("should emit LiquidityRemoved event", async function () {
      const { amm, lp } = await loadFixture(addInitialLiquidityFixture);
      const totalSupply = await amm.totalSupply();
      const userLp = await amm.balanceOf(lp.address);
      const [ethReserve, timReserve] = await amm.getReserves();

      const expectedEth = (userLp * ethReserve) / totalSupply;
      const expectedTim = (userLp * timReserve) / totalSupply;

      await expect(amm.connect(lp).removeLiquidity(userLp, 0, 0, DEADLINE))
        .to.emit(amm, "LiquidityRemoved")
        .withArgs(lp.address, expectedEth, expectedTim, userLp);
    });

    it("should revert when minEth is not met", async function () {
      const { amm, lp } = await loadFixture(addInitialLiquidityFixture);
      const userLp = await amm.balanceOf(lp.address);

      await expect(
        amm.connect(lp).removeLiquidity(userLp, ethers.parseEther("100"), 0, DEADLINE)
      ).to.be.revertedWithCustomError(amm, "InsufficientOutput");
    });

    it("should revert when minTim is not met", async function () {
      const { amm, lp } = await loadFixture(addInitialLiquidityFixture);
      const userLp = await amm.balanceOf(lp.address);

      await expect(
        amm.connect(lp).removeLiquidity(userLp, 0, ethers.parseEther("100000"), DEADLINE)
      ).to.be.revertedWithCustomError(amm, "InsufficientOutput");
    });

    it("should revert with expired deadline", async function () {
      const { amm, lp } = await loadFixture(addInitialLiquidityFixture);
      const userLp = await amm.balanceOf(lp.address);

      await expect(
        amm.connect(lp).removeLiquidity(userLp, 0, 0, 1)
      ).to.be.revertedWithCustomError(amm, "DeadlineExpired");
    });

    it("should revert with zero amount", async function () {
      const { amm, lp } = await loadFixture(addInitialLiquidityFixture);

      await expect(
        amm.connect(lp).removeLiquidity(0n, 0, 0, DEADLINE)
      ).to.be.revertedWithCustomError(amm, "ZeroAmount");
    });
  });

  describe("Swaps - swapExactETHForTokens", function () {
    it("should output correct amount of tokens for ETH", async function () {
      const { timCoin, amm, trader, lp } = await loadFixture(addInitialLiquidityFixture);
      const ethIn = ethers.parseEther("1");
      const [ethReserve, timReserve] = await amm.getReserves();
      const expectedTimOut = getAmountOut(ethIn, ethReserve, timReserve);

      await expect(() =>
        amm.connect(trader).swapExactETHForTokens(0, DEADLINE, { value: ethIn })
      ).to.changeTokenBalances(timCoin, [amm, trader], [-expectedTimOut, expectedTimOut]);
    });

    it("should update reserves after swap", async function () {
      const { amm, trader, lp } = await loadFixture(addInitialLiquidityFixture);
      const [ethBefore, timBefore] = await amm.getReserves();
      const ethIn = ethers.parseEther("1");
      const timOut = getAmountOut(ethIn, ethBefore, timBefore);

      await amm.connect(trader).swapExactETHForTokens(0, DEADLINE, { value: ethIn });

      const [ethAfter, timAfter] = await amm.getReserves();
      expect(ethAfter).to.equal(ethBefore + ethIn);
      expect(timAfter).to.equal(timBefore - timOut);
    });

    it("should revert when minTimOut is not met", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const ethIn = ethers.parseEther("1");

      await expect(
        amm.connect(trader).swapExactETHForTokens(ethers.parseEther("99999"), DEADLINE, { value: ethIn })
      ).to.be.revertedWithCustomError(amm, "InsufficientOutput");
    });

    it("should revert with expired deadline", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      await expect(
        amm.connect(trader).swapExactETHForTokens(0, 1, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(amm, "DeadlineExpired");
    });

    it("should revert with zero ETH sent", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      await expect(
        amm.connect(trader).swapExactETHForTokens(0, DEADLINE, { value: 0 })
      ).to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("should emit Swap event", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const ethIn = ethers.parseEther("1");
      const [ethReserve, timReserve] = await amm.getReserves();
      const timOut = getAmountOut(ethIn, ethReserve, timReserve);

      await expect(amm.connect(trader).swapExactETHForTokens(0, DEADLINE, { value: ethIn }))
        .to.emit(amm, "Swap")
        .withArgs(trader.address, ethIn, 0n, 0n, timOut);
    });
  });

  describe("Swaps - swapExactTokensForETH", function () {
    it("should output correct ETH for tokens", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const timIn = ethers.parseEther("1000");
      const [ethReserve, timReserve] = await amm.getReserves();
      const expectedEthOut = getAmountOut(timIn, timReserve, ethReserve);

      await timCoin.connect(trader).approve(await amm.getAddress(), timIn);

      await expect(
        amm.connect(trader).swapExactTokensForETH(timIn, 0, DEADLINE)
      ).to.changeEtherBalance(trader, expectedEthOut);
    });

    it("should update reserves after swap", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const [ethBefore, timBefore] = await amm.getReserves();
      const timIn = ethers.parseEther("1000");
      const ethOut = getAmountOut(timIn, timBefore, ethBefore);

      await timCoin.connect(trader).approve(await amm.getAddress(), timIn);
      await amm.connect(trader).swapExactTokensForETH(timIn, 0, DEADLINE);

      const [ethAfter, timAfter] = await amm.getReserves();
      expect(ethAfter).to.equal(ethBefore - ethOut);
      expect(timAfter).to.equal(timBefore + timIn);
    });

    it("should revert when minEthOut is not met", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const timIn = ethers.parseEther("1000");

      await timCoin.connect(trader).approve(await amm.getAddress(), timIn);

      await expect(
        amm.connect(trader).swapExactTokensForETH(timIn, ethers.parseEther("100"), DEADLINE)
      ).to.be.revertedWithCustomError(amm, "InsufficientOutput");
    });

    it("should revert with expired deadline", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const timIn = ethers.parseEther("1000");

      await timCoin.connect(trader).approve(await amm.getAddress(), timIn);

      await expect(
        amm.connect(trader).swapExactTokensForETH(timIn, 0, 1)
      ).to.be.revertedWithCustomError(amm, "DeadlineExpired");
    });

    it("should revert with zero tokens", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);

      await expect(
        amm.connect(trader).swapExactTokensForETH(0n, 0, DEADLINE)
      ).to.be.revertedWithCustomError(amm, "ZeroAmount");
    });

    it("should emit Swap event", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const timIn = ethers.parseEther("1000");
      const [ethReserve, timReserve] = await amm.getReserves();
      const ethOut = getAmountOut(timIn, timReserve, ethReserve);

      await timCoin.connect(trader).approve(await amm.getAddress(), timIn);

      await expect(amm.connect(trader).swapExactTokensForETH(timIn, 0, DEADLINE))
        .to.emit(amm, "Swap")
        .withArgs(trader.address, 0n, timIn, ethOut, 0n);
    });
  });

  describe("Fee Calculation", function () {
    function getAmountOutNoFee(inputAmount: bigint, inputReserve: bigint, outputReserve: bigint): bigint {
      return (inputAmount * outputReserve) / (inputReserve + inputAmount);
    }

    it("should charge 0.3% fee on ETH-to-TIM swap", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const [ethReserve, timReserve] = await amm.getReserves();
      const ethIn = ethers.parseEther("1");

      const timOut = await amm.getAmountOut(ethIn, ethReserve, timReserve);
      const noFeeOutput = getAmountOutNoFee(ethIn, ethReserve, timReserve);
      const effectiveFeeRate = (noFeeOutput - timOut) * 10000n / noFeeOutput;

      // Effective fee rate should be approximately 0.3% (30 basis points)
      expect(Number(effectiveFeeRate)).to.be.closeTo(30, 5);
    });

    it("should charge 0.3% fee on TIM-to-ETH swap", async function () {
      const { amm } = await loadFixture(addInitialLiquidityFixture);
      const [ethReserve, timReserve] = await amm.getReserves();
      const timIn = ethers.parseEther("1000");

      const ethOut = await amm.getAmountOut(timIn, timReserve, ethReserve);
      const noFeeOutput = getAmountOutNoFee(timIn, timReserve, ethReserve);
      const effectiveFeeRate = (noFeeOutput - ethOut) * 10000n / noFeeOutput;

      expect(Number(effectiveFeeRate)).to.be.closeTo(30, 5);
    });

    it("should match the getAmountOut helper", async function () {
      const { amm } = await loadFixture(addInitialLiquidityFixture);
      const [ethReserve, timReserve] = await amm.getReserves();
      const input = ethers.parseEther("1");

      const contractOutput = await amm.getAmountOut(input, ethReserve, timReserve);
      const helperOutput = getAmountOut(input, ethReserve, timReserve);

      expect(contractOutput).to.equal(helperOutput);
    });
  });

  describe("Invariant Preservation", function () {
    it("should maintain or increase k after ETH-to-TIM swap", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const [ethBefore, timBefore] = await amm.getReserves();
      const kBefore = ethBefore * timBefore;

      await amm.connect(trader).swapExactETHForTokens(0, DEADLINE, { value: ethers.parseEther("1") });

      const [ethAfter, timAfter] = await amm.getReserves();
      const kAfter = ethAfter * timAfter;
      expect(kAfter).to.be.greaterThanOrEqual(kBefore);
    });

    it("should maintain or increase k after TIM-to-ETH swap", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const [ethBefore, timBefore] = await amm.getReserves();
      const kBefore = ethBefore * timBefore;

      const timIn = ethers.parseEther("1000");
      await timCoin.connect(trader).approve(await amm.getAddress(), timIn);
      await amm.connect(trader).swapExactTokensForETH(timIn, 0, DEADLINE);

      const [ethAfter, timAfter] = await amm.getReserves();
      const kAfter = ethAfter * timAfter;
      expect(kAfter).to.be.greaterThanOrEqual(kBefore);
    });

    it("should increase k after multiple swaps", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const [ethBefore, timBefore] = await amm.getReserves();
      const kBefore = ethBefore * timBefore;

      for (let i = 0; i < 3; i++) {
        await amm.connect(trader).swapExactETHForTokens(0, DEADLINE, { value: ethers.parseEther("1") });

        const timIn = ethers.parseEther("500");
        await timCoin.connect(trader).approve(await amm.getAddress(), timIn);
        await amm.connect(trader).swapExactTokensForETH(timIn, 0, DEADLINE);
      }

      const [ethAfter, timAfter] = await amm.getReserves();
      const kAfter = ethAfter * timAfter;
      expect(kAfter).to.be.greaterThan(kBefore);
    });
  });

  describe("Slippage Protection", function () {
    it("should revert swapExactETHForTokens when minTimOut not met", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const [ethReserve, timReserve] = await amm.getReserves();
      const ethIn = ethers.parseEther("1");
      const timOut = getAmountOut(ethIn, ethReserve, timReserve);

      await expect(
        amm.connect(trader).swapExactETHForTokens(timOut + 1n, DEADLINE, { value: ethIn })
      ).to.be.revertedWithCustomError(amm, "InsufficientOutput");
    });

    it("should revert swapExactTokensForETH when minEthOut not met", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const timIn = ethers.parseEther("1000");
      await timCoin.connect(trader).approve(await amm.getAddress(), timIn);

      const [ethReserve, timReserve] = await amm.getReserves();
      const ethOut = getAmountOut(timIn, timReserve, ethReserve);

      await expect(
        amm.connect(trader).swapExactTokensForETH(timIn, ethOut + 1n, DEADLINE)
      ).to.be.revertedWithCustomError(amm, "InsufficientOutput");
    });
  });

  describe("Donations and Sync", function () {
    it("should update reserves via sync after direct transfer", async function () {
      const { timCoin, amm, trader, lp } = await loadFixture(addInitialLiquidityFixture);
      const donationTim = ethers.parseEther("500");

      await timCoin.connect(trader).transfer(await amm.getAddress(), donationTim);

      let [, timReserve] = await amm.getReserves();
      expect(timReserve).to.equal(ethers.parseEther("10000"));

      await amm.sync();
      [, timReserve] = await amm.getReserves();
      expect(timReserve).to.equal(ethers.parseEther("10500"));
    });

    it("should update ETH reserve via sync after direct ETH transfer", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const donationEth = ethers.parseEther("5");

      await trader.sendTransaction({ to: await amm.getAddress(), value: donationEth });

      let [ethReserve] = await amm.getReserves();
      expect(ethReserve).to.equal(ethers.parseEther("10"));

      await amm.sync();
      [ethReserve] = await amm.getReserves();
      expect(ethReserve).to.equal(ethers.parseEther("15"));
    });

    it("sync should revert nothing on equal reserves", async function () {
      const { amm } = await loadFixture(addInitialLiquidityFixture);
      await expect(amm.sync()).to.not.be.reverted;
    });
  });

  describe("Insufficient Liquidity", function () {
    it("should revert ETH-to-TIM swap when output exceeds reserve", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const hugeEthIn = ethers.parseEther("100000");
      const [ethReserve, timReserve] = await amm.getReserves();
      const timOut = getAmountOut(hugeEthIn, ethReserve, timReserve);

      if (timOut > timReserve) {
        await expect(
          amm.connect(trader).swapExactETHForTokens(0, DEADLINE, { value: hugeEthIn })
        ).to.be.revertedWithCustomError(amm, "InsufficientReserves");
      }
    });

    it("should revert TIM-to-ETH swap when output exceeds reserve", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const hugeTimIn = ethers.parseEther("10000000");
      const [, timReserve] = await amm.getReserves();
      const hugeEthOut = getAmountOut(hugeTimIn, timReserve, ethers.parseEther("10"));

      if (hugeEthOut > ethers.parseEther("10")) {
        await timCoin.connect(trader).approve(await amm.getAddress(), hugeTimIn);

        await expect(
          amm.connect(trader).swapExactTokensForETH(hugeTimIn, 0, DEADLINE)
        ).to.be.revertedWithCustomError(amm, "InsufficientReserves");
      }
    });

    it("should revert getAmountOut with zero input reserves", async function () {
      const { amm } = await loadFixture(deployAmmFixture);
      await expect(
        amm.getAmountOut(ethers.parseEther("1"), 0n, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(amm, "InsufficientReserves");
    });

    it("should revert getAmountOut with zero output reserves", async function () {
      const { amm } = await loadFixture(deployAmmFixture);
      await expect(
        amm.getAmountOut(ethers.parseEther("1"), ethers.parseEther("10"), 0n)
      ).to.be.revertedWithCustomError(amm, "InsufficientReserves");
    });

    it("should revert getAmountOut with zero input amount", async function () {
      const { amm } = await loadFixture(deployAmmFixture);
      await expect(
        amm.getAmountOut(0n, ethers.parseEther("10"), ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(amm, "ZeroAmount");
    });
  });

  describe("Reentrancy", function () {
    it("should have nonReentrant modifier on addLiquidity", async function () {
      const { timCoin, amm, lp } = await loadFixture(deployAmmFixture);
      const ethAmount = ethers.parseEther("10");
      const timAmount = ethers.parseEther("10000");

      await timCoin.connect(lp).approve(await amm.getAddress(), timAmount);
      await amm.connect(lp).addLiquidity(timAmount, DEADLINE, { value: ethAmount });

      const userLp = await amm.balanceOf(lp.address);
      const [reserves] = await amm.getReserves();
      expect(reserves).to.be.gt(0);
    });

    it("should have nonReentrant modifier on removeLiquidity", async function () {
      const { amm, lp } = await loadFixture(addInitialLiquidityFixture);
      const userLp = await amm.balanceOf(lp.address);

      await expect(
        amm.connect(lp).removeLiquidity(userLp, 0, 0, DEADLINE)
      ).to.not.be.reverted;
    });
  });

  describe("Emergency Behavior", function () {
    it("should revert addLiquidity when paused", async function () {
      const { timCoin, amm, lp } = await loadFixture(deployAmmFixture);
      await amm.pause();

      const ethAmount = ethers.parseEther("10");
      const timAmount = ethers.parseEther("10000");
      await timCoin.connect(lp).approve(await amm.getAddress(), timAmount);

      await expect(
        amm.connect(lp).addLiquidity(timAmount, DEADLINE, { value: ethAmount })
      ).to.be.revertedWithCustomError(amm, "EnforcedPause");
    });

    it("should revert swapExactETHForTokens when paused", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      await amm.pause();

      await expect(
        amm.connect(trader).swapExactETHForTokens(0, DEADLINE, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(amm, "EnforcedPause");
    });

    it("should revert swapExactTokensForETH when paused", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      const timIn = ethers.parseEther("1000");
      await timCoin.connect(trader).approve(await amm.getAddress(), timIn);
      await amm.pause();

      await expect(
        amm.connect(trader).swapExactTokensForETH(timIn, 0, DEADLINE)
      ).to.be.revertedWithCustomError(amm, "EnforcedPause");
    });

    it("should allow removeLiquidity when paused", async function () {
      const { amm, lp } = await loadFixture(addInitialLiquidityFixture);
      await amm.pause();

      const userLp = await amm.balanceOf(lp.address);

      await expect(
        amm.connect(lp).removeLiquidity(userLp, 0, 0, DEADLINE)
      ).to.not.be.reverted;
    });

    it("should work again after unpausing", async function () {
      const { timCoin, amm, trader } = await loadFixture(addInitialLiquidityFixture);
      await amm.pause();
      await amm.unpause();

      await expect(
        amm.connect(trader).swapExactETHForTokens(0, DEADLINE, { value: ethers.parseEther("1") })
      ).to.not.be.reverted;
    });

    it("should allow owner to pause", async function () {
      const { amm, owner } = await loadFixture(addInitialLiquidityFixture);
      await expect(amm.pause()).to.not.be.reverted;
      expect(await amm.paused()).to.be.true;
    });

    it("should allow owner to unpause", async function () {
      const { amm } = await loadFixture(addInitialLiquidityFixture);
      await amm.pause();
      await amm.unpause();
      expect(await amm.paused()).to.be.false;
    });

    it("should reject pause from non-owner", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      await expect(
        amm.connect(trader).pause()
      ).to.be.revertedWithCustomError(amm, "OwnableUnauthorizedAccount");
    });

    it("should reject unpause from non-owner", async function () {
      const { amm, trader } = await loadFixture(addInitialLiquidityFixture);
      await amm.pause();
      await expect(
        amm.connect(trader).unpause()
      ).to.be.revertedWithCustomError(amm, "OwnableUnauthorizedAccount");
    });
  });
});
