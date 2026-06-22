/*
 * DEX contract tests — covers Sell, Getters, Buy, WithdrawTokens, WithdrawFunds.
 *
 * Setup: deploy Token (supply = 100) + DEX (price = 100 wei/token).
 * Three accounts: owner, addr1 (buyer), addr2 (third party).
 */

const { expect } = require("chai");

describe("DEX", () => {
  let tokenSupply = "100";
  let token;
  let dex;
  let price = 100;
  let owner;
  let addr1;
  let addr2;

  before(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy(tokenSupply);
    const DEX = await ethers.getContractFactory("DEX");
    dex = await DEX.deploy(token.address, price);
  });

  // ─── Sell (deposit tokens to DEX) ──────────────────────────────────────
  describe("Sell", () => {
    it("Should fail if contract is not approved", async () => {
      // No approval yet → sell() should revert
      await expect(dex.sell()).to.be.reverted;
    });

    it("Should allow DEX to transfer tokens", async () => {
      // Owner approves DEX to spend 100 tokens
      await token.approve(dex.address, 100);
    });

    it("Should not allow non-owner to call sell()", async () => {
      await expect(dex.connect(addr1).sell()).to.be.reverted;
    });

    it("Sell should transfer tokens from owner to contract", async () => {
      // After approval, sell() pulls 100 tokens from owner → DEX
      await expect(dex.sell()).to.changeTokenBalances(
        token,
        [owner.address, dex.address],
        [-100, 100]
      );
    });
  });

  // ─── Getters ───────────────────────────────────────────────────────────
  describe("Getters", () => {
    it("Should return correct token balance", async () => {
      expect(await dex.getTokenBalance()).to.equal(100);
    });

    it("Should return correct token price", async () => {
      // price = 100 → getPrice(10) should return 1000
      expect(await dex.getPrice(10)).to.equal(price * 10);
    });
  });

  // ─── Buy (purchase tokens from DEX) ────────────────────────────────────
  describe("Buy", () => {
    it("User can buy tokens", async () => {
      // addr1 buys 10 tokens, paying 10 * 100 = 1000 wei
      await expect(
        dex.connect(addr1).buy(10, { value: 1000 })
      ).to.changeTokenBalances(token, [dex.address, addr1.address], [-10, 10]);
    });

    it("User cannot buy invalid number of tokens", async () => {
      // DEX now has 90 tokens; trying to buy 91 should revert
      await expect(dex.connect(addr1).buy(91, { value: 9100 })).to.be.reverted;
    });

    it("User cannot buy with invalid value", async () => {
      // Sending 510 wei for 5 tokens (should be exactly 500) → revert
      await expect(dex.connect(addr1).buy(5, { value: 510 })).to.be.reverted;
    });
  });

  // ─── Withdraw Tokens ───────────────────────────────────────────────────
  describe("Withdraw tokens", () => {
    it("Non-owner cannot withdraw tokens", async () => {
      await expect(dex.connect(addr1).withdrawTokens()).to.be.reverted;
    });

    it("Owner can withdraw tokens", async () => {
      // DEX has 90 tokens remaining → owner withdraws all
      await expect(dex.withdrawTokens()).to.changeTokenBalances(
        token,
        [dex.address, owner.address],
        [-90, 90]
      );
    });
  });

  // ─── Withdraw Funds (ETH) ──────────────────────────────────────────────
  describe("Withdraw funds", () => {
    it("Owner can withdraw token proceeds", async () => {
      // addr1 paid 1000 wei for tokens; owner collects it
      await expect(dex.withdrawFunds()).to.changeEtherBalances(
        [owner.address, dex.address],
        [1000, -1000]
      );
    });

    it("Non-owner cannot withdraw token proceeds", async () => {
      await expect(dex.connect(addr1).withdrawFunds()).to.be.reverted;
    });
  });
});
