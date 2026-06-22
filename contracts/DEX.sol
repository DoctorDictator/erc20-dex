// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/*
 * Import only the IERC20 interface (not the full implementation).
 * The DEX only needs to call functions on an existing ERC20 token,
 * not inherit its behavior — this keeps the contract smaller.
 */
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DEX (Decentralized Exchange)
 * @notice Fixed-price exchange for a single ERC-20 token.
 *
 * How it works:
 *   - OWNER deposits tokens via sell() (requires prior token.approve())
 *   - USERS buy tokens from the DEX's inventory by sending ETH
 *   - Owner can withdraw accumulated ETH (withdrawFunds) or tokens (withdrawTokens)
 *
 * State variables:
 *   associatedToken — The ERC-20 token being traded
 *   price           — Fixed price per token in wei (set once in constructor)
 *   owner           — Contract deployer; has admin rights
 */
contract DEX {
    IERC20 public associatedToken;
    uint256 private price;
    address private owner;

    /** @param _token  The ERC-20 token contract address
     *  @param _price  Price per token in wei */
    constructor(IERC20 _token, uint256 _price) {
        associatedToken = _token;
        owner = msg.sender;
        price = _price;
    }

    /** @dev Reverts the transaction if the caller is not the contract owner. */
    modifier onlyOwner() {
        require(msg.sender == owner, "you are not the owner");
        _;
    }

    // ─── Owner Functions ────────────────────────────────────────────────

    /**
     * @notice Transfer the owner's APPROVED tokens into the DEX inventory.
     * @dev Requires the owner to have called token.approve(dex, amount) first.
     *      Transfers the full approved allowance in one go.
     */
    function sell() external onlyOwner {
        // Check how many tokens the owner approved this DEX to spend
        uint256 allowance = associatedToken.allowance(msg.sender, address(this));
        require(allowance > 0, "you must allow this contract access to at least one token");

        // Pull the tokens from owner → DEX contract
        bool sent = associatedToken.transferFrom(msg.sender, address(this), allowance);
        require(sent, "failed to send");
    }

    /**
     * @notice Withdraw all tokens held by the DEX back to the owner.
     */
    function withdrawTokens() external onlyOwner {
        uint256 balance = associatedToken.balanceOf(address(this));
        associatedToken.transfer(msg.sender, balance);
    }

    /**
     * @notice Withdraw all ETH (from token sales) to the owner.
     * @dev Uses low-level .call() instead of .transfer() because .call()
     *      forwards all gas and works with any receiver type.
     */
    function withdrawFunds() external onlyOwner {
        (bool sent, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(sent);
    }

    // ─── View / Pure Functions ──────────────────────────────────────────

    /** @return Total cost in wei for `numTokens` tokens  */
    function getPrice(uint256 numTokens) public view returns (uint256) {
        return numTokens * price;
    }

    /** @return The DEX's current token inventory  */
    function getTokenBalance() public view returns (uint256) {
        return associatedToken.balanceOf(address(this));
    }

    // ─── User Functions ─────────────────────────────────────────────────

    /**
     * @notice Buy tokens from the DEX by sending the exact amount of ETH.
     * @param numTokens Number of tokens to purchase
     * @dev Payable — ETH is sent via msg.value.
     *      Validates: (a) enough inventory, (b) exact payment amount.
     */
    function buy(uint256 numTokens) external payable {
        // Check the DEX has enough tokens in stock
        require(numTokens <= getTokenBalance(), "not enough tokens");

        // Calculate total cost and verify the caller sent the exact amount
        uint256 priceForTokens = getPrice(numTokens);
        require(msg.value == priceForTokens, "invalid value sent");

        // Transfer tokens from DEX to buyer
        associatedToken.transfer(msg.sender, numTokens);
    }
}
