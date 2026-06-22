import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("TimCoin", function () {
  async function deployTimCoinFixture() {
    const [owner, other] = await ethers.getSigners();
    const TimCoin = await ethers.getContractFactory("TimCoin");
    const timCoin = await TimCoin.deploy();
    return { timCoin, owner, other };
  }

  describe("Deployment", function () {
    it("should set the correct total supply", async function () {
      const { timCoin } = await loadFixture(deployTimCoinFixture);
      const expected = ethers.parseEther("1000000");
      expect(await timCoin.totalSupply()).to.equal(expected);
    });

    it("should assign all tokens to the deployer", async function () {
      const { timCoin, owner } = await loadFixture(deployTimCoinFixture);
      const expected = ethers.parseEther("1000000");
      expect(await timCoin.balanceOf(owner.address)).to.equal(expected);
    });
  });

  describe("Token Properties", function () {
    it("should have the correct name", async function () {
      const { timCoin } = await loadFixture(deployTimCoinFixture);
      expect(await timCoin.name()).to.equal("TimCoin");
    });

    it("should have the correct symbol", async function () {
      const { timCoin } = await loadFixture(deployTimCoinFixture);
      expect(await timCoin.symbol()).to.equal("TIM");
    });

    it("should have 18 decimals", async function () {
      const { timCoin } = await loadFixture(deployTimCoinFixture);
      expect(await timCoin.decimals()).to.equal(18);
    });
  });

  describe("Transfers", function () {
    it("should transfer tokens between accounts", async function () {
      const { timCoin, owner, other } = await loadFixture(deployTimCoinFixture);
      const amount = ethers.parseEther("100");
      await expect(() =>
        timCoin.transfer(other.address, amount)
      ).to.changeTokenBalances(timCoin, [owner, other], [-amount, amount]);
    });

    it("should emit a Transfer event", async function () {
      const { timCoin, owner, other } = await loadFixture(deployTimCoinFixture);
      const amount = ethers.parseEther("100");
      await expect(timCoin.transfer(other.address, amount))
        .to.emit(timCoin, "Transfer")
        .withArgs(owner.address, other.address, amount);
    });

    it("should revert when sender has insufficient balance", async function () {
      const { timCoin, owner, other } = await loadFixture(deployTimCoinFixture);
      const amount = ethers.parseEther("1000001");
      await expect(
        timCoin.transfer(other.address, amount)
      ).to.be.revertedWithCustomError(timCoin, "ERC20InsufficientBalance");
    });
  });

  describe("Approve / TransferFrom", function () {
    it("should approve spending and transferFrom correctly", async function () {
      const { timCoin, owner, other } = await loadFixture(deployTimCoinFixture);
      const allowance = ethers.parseEther("500");
      const transferAmount = ethers.parseEther("200");

      await timCoin.approve(other.address, allowance);
      expect(await timCoin.allowance(owner.address, other.address)).to.equal(allowance);

      await expect(() =>
        timCoin.connect(other).transferFrom(owner.address, other.address, transferAmount)
      ).to.changeTokenBalances(timCoin, [owner, other], [-transferAmount, transferAmount]);

      expect(await timCoin.allowance(owner.address, other.address)).to.equal(allowance - transferAmount);
    });

    it("should revert transferFrom when allowance is insufficient", async function () {
      const { timCoin, owner, other } = await loadFixture(deployTimCoinFixture);
      const amount = ethers.parseEther("100");

      await expect(
        timCoin.connect(other).transferFrom(owner.address, other.address, amount)
      ).to.be.revertedWithCustomError(timCoin, "ERC20InsufficientAllowance");
    });

    it("should emit Approval event", async function () {
      const { timCoin, owner, other } = await loadFixture(deployTimCoinFixture);
      const amount = ethers.parseEther("1000");
      await expect(timCoin.approve(other.address, amount))
        .to.emit(timCoin, "Approval")
        .withArgs(owner.address, other.address, amount);
    });
  });
});
