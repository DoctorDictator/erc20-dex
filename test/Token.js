/*
 * Token contract tests — uses Mocha (describe/it) + Chai (expect).
 *
 * Tests:
 *   1. Deployment: deployer receives the entire total supply.
 *   2. Transactions: successful transfer + insufficient-balance revert.
 */

const { expect } = require("chai");

describe("Token", () => {
  let tokenSupply = "100";
  let token;
  let owner;
  let addr1;
  let addr2;

  // Deploy a fresh Token contract once before all tests
  before(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy(tokenSupply);
  });

  describe("Deployment", () => {
    it("Should assign total supply of tokens to the owner/deployer", async () => {
      const ownerBalance = await token.balanceOf(owner.address);
      // The totalSupply should equal the deployer's balance (all tokens minted to them)
      expect(await token.totalSupply()).to.equal(ownerBalance);
    });
  });

  describe("Transactions", () => {
    it("Should transfer tokens between accounts", async () => {
      // Transfer 50 tokens from owner → addr1
      await token.transfer(addr1.address, 50);
      const addr1Balance = await token.balanceOf(addr1.address);
      expect(addr1Balance).to.equal(50);
    });

    it("Should NOT allow transfer if sender has insufficient balance", async () => {
      // addr1 only has 50 tokens, but tries to send 51 → should revert
      await expect(token.connect(addr1).transfer(addr2.address, 51)).to.be.reverted;
    });
  });
});
