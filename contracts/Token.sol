// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/*
 * Import OpenZeppelin's ERC20 base contract.
 * Provides standard ERC-20 functions: name, symbol, decimals, totalSupply,
 * balanceOf, transfer, approve, transferFrom, allowance.
 */
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Token
 * @notice A simple ERC-20 token named "TimCoin" (symbol "TIM").
 * @dev Mints the entire initial supply to the contract deployer.
 */
contract Token is ERC20 {
    /** @param initialSupply Total tokens to mint (10^18 base units). */
    constructor(uint256 initialSupply) ERC20("TimCoin", "TIM") {
        _mint(msg.sender, initialSupply);
    }
}
