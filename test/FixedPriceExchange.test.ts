import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { type FixedPriceExchange, type TimCoin } from "../typechain-types";

const BUY_PRICE = ethers.parseEther("0.001");
const SELL_PRICE = ethers.parseEther("0.0009");
const ONE_ETH = ethers.parseEther("1");
const RESERVE_AMOUNT = ethers.parseEther("10000");
const DEADLINE = 2_000_000_000_000;

describe("FixedPriceExchange", function () {
  async function deployFixture() {
    const [owner, user, attacker] = await ethers.getSigners();

    const TimCoin = await ethers.getContractFactory("TimCoin");
    const timCoin = await TimCoin.deploy() as unknown as TimCoin;

    const FixedPriceExchange = await ethers.getContractFactory("FixedPriceExchange");
    const exchange = await FixedPriceExchange.deploy(
      await timCoin.getAddress(),
      BUY_PRICE,
      SELL_PRICE
    ) as unknown as FixedPriceExchange;

    await timCoin.approve(await exchange.getAddress(), RESERVE_AMOUNT);
    await exchange.depositReserves(RESERVE_AMOUNT);

    const userTimAmount = ethers.parseEther("5000");
    await timCoin.transfer(user.address, userTimAmount);

    return { timCoin, exchange, owner, user, attacker };
  }

  describe("Deployment", function () {
    it("should set the correct token address", async function () {
      const { timCoin, exchange } = await loadFixture(deployFixture);
      expect(await exchange.token()).to.equal(await timCoin.getAddress());
    });

    it("should set the correct buy and sell prices", async function () {
      const { exchange } = await loadFixture(deployFixture);
      expect(await exchange.buyPrice()).to.equal(BUY_PRICE);
      expect(await exchange.sellPrice()).to.equal(SELL_PRICE);
    });

    it("should set the deployer as owner", async function () {
      const { exchange, owner } = await loadFixture(deployFixture);
      expect(await exchange.owner()).to.equal(owner.address);
    });

    it("should reject zero buy price on deployment", async function () {
      const TimCoin = await ethers.getContractFactory("TimCoin");
      const timCoin = await TimCoin.deploy();
      const FixedPriceExchange = await ethers.getContractFactory("FixedPriceExchange");

      await expect(
        FixedPriceExchange.deploy(
          await timCoin.getAddress(),
          0,
          SELL_PRICE
        )
      ).to.be.revertedWithCustomError(FixedPriceExchange, "ZeroPrice");
    });

    it("should reject zero sell price on deployment", async function () {
      const TimCoin = await ethers.getContractFactory("TimCoin");
      const timCoin = await TimCoin.deploy();
      const FixedPriceExchange = await ethers.getContractFactory("FixedPriceExchange");

      await expect(
        FixedPriceExchange.deploy(
          await timCoin.getAddress(),
          BUY_PRICE,
          0
        )
      ).to.be.revertedWithCustomError(FixedPriceExchange, "ZeroPrice");
    });

    it("should reject buyPrice < sellPrice on deployment", async function () {
      const TimCoin = await ethers.getContractFactory("TimCoin");
      const timCoin = await TimCoin.deploy();
      const FixedPriceExchange = await ethers.getContractFactory("FixedPriceExchange");

      await expect(
        FixedPriceExchange.deploy(
          await timCoin.getAddress(),
          ethers.parseEther("0.0008"),
          ethers.parseEther("0.0009")
        )
      ).to.be.revertedWithCustomError(FixedPriceExchange, "InvalidPriceSpread");
    });

    it("should allow buyPrice equal to sellPrice", async function () {
      const TimCoin = await ethers.getContractFactory("TimCoin");
      const timCoin = await TimCoin.deploy();
      const FixedPriceExchange = await ethers.getContractFactory("FixedPriceExchange");
      const price = ethers.parseEther("0.001");

      await expect(
        FixedPriceExchange.deploy(await timCoin.getAddress(), price, price)
      ).to.not.be.reverted;
    });
  });

  describe("Pricing Changes", function () {
    it("should allow owner to update prices", async function () {
      const { exchange } = await loadFixture(deployFixture);
      const newBuy = ethers.parseEther("0.002");
      const newSell = ethers.parseEther("0.0015");

      await exchange.setPrices(newBuy, newSell);

      expect(await exchange.buyPrice()).to.equal(newBuy);
      expect(await exchange.sellPrice()).to.equal(newSell);
    });

    it("should emit PricesUpdated event", async function () {
      const { exchange } = await loadFixture(deployFixture);
      const newBuy = ethers.parseEther("0.002");
      const newSell = ethers.parseEther("0.0015");

      await expect(exchange.setPrices(newBuy, newSell))
        .to.emit(exchange, "PricesUpdated")
        .withArgs(newBuy, newSell);
    });

    it("should enforce new prices on buy", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      const newBuy = ethers.parseEther("0.002");
      await exchange.setPrices(newBuy, SELL_PRICE);

      const amountOut = ethers.parseEther("100");
      const cost = amountOut * newBuy / ethers.parseEther("1");

      await expect(
        exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost })
      ).to.not.be.reverted;
    });

    it("should reject zero buy price", async function () {
      const { exchange } = await loadFixture(deployFixture);
      await expect(
        exchange.setPrices(0, SELL_PRICE)
      ).to.be.revertedWithCustomError(exchange, "ZeroPrice");
    });

    it("should reject zero sell price", async function () {
      const { exchange } = await loadFixture(deployFixture);
      await expect(
        exchange.setPrices(BUY_PRICE, 0)
      ).to.be.revertedWithCustomError(exchange, "ZeroPrice");
    });

    it("should reject inverted spread (buy < sell)", async function () {
      const { exchange } = await loadFixture(deployFixture);
      await expect(
        exchange.setPrices(SELL_PRICE, BUY_PRICE)
      ).to.be.revertedWithCustomError(exchange, "InvalidPriceSpread");
    });

    it("should reject price updates from non-owner", async function () {
      const { exchange, attacker } = await loadFixture(deployFixture);
      await expect(
        exchange.connect(attacker).setPrices(BUY_PRICE, SELL_PRICE)
      ).to.be.revertedWithCustomError(exchange, "OwnableUnauthorizedAccount");
    });
  });

  describe("Rounding", function () {
    it("should return zero cost for very tiny buy quote", async function () {
      const { exchange } = await loadFixture(deployFixture);
      const tiny = 1n; // 1 wei of TIM
      const cost = await exchange.getBuyQuote(tiny);
      expect(cost).to.equal(0n);
    });

    it("should return zero proceeds for very tiny sell quote", async function () {
      const { exchange } = await loadFixture(deployFixture);
      const tiny = 1n;
      const proceeds = await exchange.getSellQuote(tiny);
      expect(proceeds).to.equal(0n);
    });

    it("should round down costs", async function () {
      const { exchange } = await loadFixture(deployFixture);
      const amountOut = ethers.parseEther("999");
      const exactCost = amountOut * BUY_PRICE / ethers.parseEther("1");
      const quoted = await exchange.getBuyQuote(amountOut);
      expect(quoted).to.equal(exactCost);
    });
  });

  describe("Reserve Funding", function () {
    it("should allow anyone to deposit reserves", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("500");
      await timCoin.connect(user).approve(await exchange.getAddress(), deposit);

      await expect(() =>
        exchange.connect(user).depositReserves(deposit)
      ).to.changeTokenBalances(timCoin, [user, exchange], [-deposit, deposit]);
    });

    it("should emit ReservesDeposited on deposit", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("500");
      await timCoin.connect(user).approve(await exchange.getAddress(), deposit);

      await expect(exchange.connect(user).depositReserves(deposit))
        .to.emit(exchange, "ReservesDeposited")
        .withArgs(deposit);
    });

    it("should allow owner to withdraw reserves", async function () {
      const { timCoin, exchange } = await loadFixture(deployFixture);
      const withdrawAmount = ethers.parseEther("1000");

      await expect(() =>
        exchange.withdrawReserves(withdrawAmount)
      ).to.changeTokenBalances(timCoin, [exchange, await exchange.owner()], [-withdrawAmount, withdrawAmount]);
    });

    it("should emit ReservesWithdrawn on withdrawal", async function () {
      const { exchange } = await loadFixture(deployFixture);
      const withdrawAmount = ethers.parseEther("1000");

      await expect(exchange.withdrawReserves(withdrawAmount))
        .to.emit(exchange, "ReservesWithdrawn")
        .withArgs(withdrawAmount);
    });

    it("should reject reserve withdrawal by non-owner", async function () {
      const { exchange, attacker } = await loadFixture(deployFixture);
      await expect(
        exchange.connect(attacker).withdrawReserves(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(exchange, "OwnableUnauthorizedAccount");
    });
  });

  describe("Purchases (buyTokens)", function () {
    it("should allow purchasing tokens by sending exact cost", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      const amountOut = ethers.parseEther("100");
      const cost = await exchange.getBuyQuote(amountOut);

      await expect(() =>
        exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost })
      ).to.changeTokenBalances(timCoin, [exchange, user], [-amountOut, amountOut]);
    });

    it("should refund excess ETH sent", async function () {
      const { exchange, user } = await loadFixture(deployFixture);
      const amountOut = ethers.parseEther("100");
      const cost = await exchange.getBuyQuote(amountOut);
      const excess = ethers.parseEther("1");
      const sent = cost + excess;

      await expect(
        exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: sent })
      ).to.changeEtherBalance(user, -cost);
    });

    it("should revert when msg.value < cost", async function () {
      const { exchange, user } = await loadFixture(deployFixture);
      const amountOut = ethers.parseEther("100");
      const cost = await exchange.getBuyQuote(amountOut);

      await expect(
        exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost - 1n })
      ).to.be.revertedWithCustomError(exchange, "InsufficientPayment");
    });

    it("should revert when deadline is expired", async function () {
      const { exchange, user } = await loadFixture(deployFixture);
      const amountOut = ethers.parseEther("100");
      const cost = await exchange.getBuyQuote(amountOut);
      const pastDeadline = 1;

      await expect(
        exchange.connect(user).buyTokens(amountOut, pastDeadline, cost, { value: cost })
      ).to.be.revertedWithCustomError(exchange, "DeadlineExpired");
    });

    it("should work when deadline is in the future", async function () {
      const { timCoin, exchange, owner, user } = await loadFixture(deployFixture);
      const amountOut = ethers.parseEther("50");
      const cost = await exchange.getBuyQuote(amountOut);

      const balBefore = await timCoin.balanceOf(user.address);
      await exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost });
      expect(await timCoin.balanceOf(user.address)).to.equal(balBefore + amountOut);
    });

    it("should revert when maxCost is too low", async function () {
      const { exchange, user } = await loadFixture(deployFixture);
      const amountOut = ethers.parseEther("100");
      const cost = await exchange.getBuyQuote(amountOut);
      const lowMaxCost = cost - 1n;

      await expect(
        exchange.connect(user).buyTokens(amountOut, DEADLINE, lowMaxCost, { value: cost })
      ).to.be.revertedWithCustomError(exchange, "CostExceedsMaxCost");
    });

    it("should revert when paused", async function () {
      const { exchange, user } = await loadFixture(deployFixture);
      await exchange.pause();

      const amountOut = ethers.parseEther("100");
      const cost = await exchange.getBuyQuote(amountOut);

      await expect(
        exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost })
      ).to.be.revertedWithCustomError(exchange, "EnforcedPause");
    });

    it("should work again after unpausing", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      await exchange.pause();
      await exchange.unpause();

      const amountOut = ethers.parseEther("100");
      const cost = await exchange.getBuyQuote(amountOut);

      await expect(
        exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost })
      ).to.changeTokenBalances(timCoin, [exchange, user], [-amountOut, amountOut]);
    });

    it("should revert when contract has insufficient reserves", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      const amountOut = RESERVE_AMOUNT + 1n;
      const cost = await exchange.getBuyQuote(amountOut);

      await expect(
        exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost })
      ).to.be.revertedWithCustomError(timCoin, "ERC20InsufficientBalance");
    });

    it("should emit TokensPurchased event", async function () {
      const { exchange, user } = await loadFixture(deployFixture);
      const amountOut = ethers.parseEther("100");
      const cost = await exchange.getBuyQuote(amountOut);

      await expect(
        exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost })
      )
        .to.emit(exchange, "TokensPurchased")
        .withArgs(user.address, amountOut, cost);
    });
  });

  describe("Sell-backs (sellTokens)", function () {
    async function buyAndGetTokens(
      exchange: FixedPriceExchange,
      timCoin: TimCoin,
      user: any,
      amountOut: bigint
    ) {
      const cost = await exchange.getBuyQuote(amountOut);
      await exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost });
    }

    it("should allow selling tokens for ETH", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      const buyAmount = ethers.parseEther("200");
      await buyAndGetTokens(exchange, timCoin, user, buyAmount);
      const sellAmount = ethers.parseEther("100");
      const proceeds = await exchange.getSellQuote(sellAmount);

      await timCoin.connect(user).approve(await exchange.getAddress(), sellAmount);

      const userBalBefore = await timCoin.balanceOf(user.address);
      const ethBalBefore = await ethers.provider.getBalance(user.address);

      const tx = await exchange.connect(user).sellTokens(sellAmount, DEADLINE, 0);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      const userBalAfter = await timCoin.balanceOf(user.address);
      const ethBalAfter = await ethers.provider.getBalance(user.address);

      expect(userBalAfter - userBalBefore).to.equal(-sellAmount);
      expect(ethBalAfter - ethBalBefore + gasCost).to.equal(proceeds);
    });

    it("should revert when minProceeds is too high", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      const buyAmount = ethers.parseEther("200");
      await buyAndGetTokens(exchange, timCoin, user, buyAmount);
      const sellAmount = ethers.parseEther("100");

      await timCoin.connect(user).approve(await exchange.getAddress(), sellAmount);

      const proceeds = await exchange.getSellQuote(sellAmount);
      const highMinProceeds = proceeds + 1n;

      await expect(
        exchange.connect(user).sellTokens(sellAmount, DEADLINE, highMinProceeds)
      ).to.be.revertedWithCustomError(exchange, "ProceedsBelowMin");
    });

    it("should revert when deadline is expired", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      const buyAmount = ethers.parseEther("200");
      await buyAndGetTokens(exchange, timCoin, user, buyAmount);
      const sellAmount = ethers.parseEther("100");

      await timCoin.connect(user).approve(await exchange.getAddress(), sellAmount);

      await expect(
        exchange.connect(user).sellTokens(sellAmount, 1, 0)
      ).to.be.revertedWithCustomError(exchange, "DeadlineExpired");
    });

    it("should revert when paused", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      const buyAmount = ethers.parseEther("200");
      await buyAndGetTokens(exchange, timCoin, user, buyAmount);
      await exchange.pause();
      const sellAmount = ethers.parseEther("100");

      await timCoin.connect(user).approve(await exchange.getAddress(), sellAmount);

      await expect(
        exchange.connect(user).sellTokens(sellAmount, DEADLINE, 0)
      ).to.be.revertedWithCustomError(exchange, "EnforcedPause");
    });

    it("should emit TokensSold event", async function () {
      const { timCoin, exchange, user } = await loadFixture(deployFixture);
      const buyAmount = ethers.parseEther("200");
      await buyAndGetTokens(exchange, timCoin, user, buyAmount);
      const sellAmount = ethers.parseEther("100");
      const proceeds = await exchange.getSellQuote(sellAmount);

      await timCoin.connect(user).approve(await exchange.getAddress(), sellAmount);

      await expect(
        exchange.connect(user).sellTokens(sellAmount, DEADLINE, 0)
      )
        .to.emit(exchange, "TokensSold")
        .withArgs(user.address, sellAmount, proceeds);
    });
  });

  describe("Spread Enforcement", function () {
    it("should enforce buyPrice >= sellPrice on deployment", async function () {
      const TimCoin = await ethers.getContractFactory("TimCoin");
      const timCoin = await TimCoin.deploy();
      const FixedPriceExchange = await ethers.getContractFactory("FixedPriceExchange");

      await expect(
        FixedPriceExchange.deploy(
          await timCoin.getAddress(),
          SELL_PRICE,
          BUY_PRICE
        )
      ).to.be.revertedWithCustomError(FixedPriceExchange, "InvalidPriceSpread");
    });

    it("should allow buyPrice == sellPrice via setPrices", async function () {
      const { exchange } = await loadFixture(deployFixture);
      const equalPrice = ethers.parseEther("0.001");

      await exchange.setPrices(equalPrice, equalPrice);
      expect(await exchange.buyPrice()).to.equal(equalPrice);
      expect(await exchange.sellPrice()).to.equal(equalPrice);
    });
  });

  describe("Authorization", function () {
    it("should reject setPrices from non-owner", async function () {
      const { exchange, attacker } = await loadFixture(deployFixture);
      await expect(
        exchange.connect(attacker).setPrices(BUY_PRICE, SELL_PRICE)
      ).to.be.revertedWithCustomError(exchange, "OwnableUnauthorizedAccount");
    });

    it("should reject pause from non-owner", async function () {
      const { exchange, attacker } = await loadFixture(deployFixture);
      await expect(
        exchange.connect(attacker).pause()
      ).to.be.revertedWithCustomError(exchange, "OwnableUnauthorizedAccount");
    });

    it("should reject unpause from non-owner", async function () {
      const { exchange, attacker } = await loadFixture(deployFixture);
      await exchange.pause();
      await expect(
        exchange.connect(attacker).unpause()
      ).to.be.revertedWithCustomError(exchange, "OwnableUnauthorizedAccount");
    });

    it("should reject withdrawReserves from non-owner", async function () {
      const { exchange, attacker } = await loadFixture(deployFixture);
      await expect(
        exchange.connect(attacker).withdrawReserves(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(exchange, "OwnableUnauthorizedAccount");
    });

    it("should reject withdrawETH from non-owner", async function () {
      const { exchange, attacker } = await loadFixture(deployFixture);
      await expect(
        exchange.connect(attacker).withdrawETH()
      ).to.be.revertedWithCustomError(exchange, "OwnableUnauthorizedAccount");
    });
  });

  describe("Withdrawals", function () {
    it("should allow owner to withdraw accumulated ETH", async function () {
      const { exchange, owner, user } = await loadFixture(deployFixture);
      const amountOut = ethers.parseEther("500");
      const cost = await exchange.getBuyQuote(amountOut);
      await exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost });

      const exchangeBalance = await ethers.provider.getBalance(await exchange.getAddress());

      await expect(
        exchange.withdrawETH()
      ).to.changeEtherBalance(owner, exchangeBalance);
    });

    it("should emit ETHWithdrawn event", async function () {
      const { exchange, user } = await loadFixture(deployFixture);
      const amountOut = ethers.parseEther("500");
      const cost = await exchange.getBuyQuote(amountOut);
      await exchange.connect(user).buyTokens(amountOut, DEADLINE, cost, { value: cost });

      const exchangeBalance = await ethers.provider.getBalance(await exchange.getAddress());

      await expect(exchange.withdrawETH())
        .to.emit(exchange, "ETHWithdrawn")
        .withArgs(exchangeBalance);
    });

    it("should allow owner to withdraw excess tokens", async function () {
      const { timCoin, exchange } = await loadFixture(deployFixture);
      const withdrawAmount = ethers.parseEther("2000");

      await expect(() =>
        exchange.withdrawReserves(withdrawAmount)
      ).to.changeTokenBalances(timCoin, [exchange, await exchange.owner()], [-withdrawAmount, withdrawAmount]);
    });
  });
});
