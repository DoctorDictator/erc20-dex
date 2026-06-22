/*
 * Hardhat configuration for compiling and testing Solidity smart contracts.
 * The hardhat-toolbox plugin bundles commonly used plugins (ethers, Chai, etc.).
 */
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // Solidity compiler version — 0.8.x has built-in overflow protection
  solidity: "0.8.17",
};
