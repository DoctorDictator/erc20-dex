// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FixedPriceExchange is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroPrice();
    error InvalidPriceSpread();
    error DeadlineExpired();
    error CostExceedsMaxCost();
    error InsufficientPayment();
    error ProceedsBelowMin();
    error ETHTransferFailed();

    IERC20 public immutable token;
    uint256 public buyPrice;
    uint256 public sellPrice;

    event PricesUpdated(uint256 buyPrice, uint256 sellPrice);
    event TokensPurchased(address indexed buyer, uint256 amountOut, uint256 cost);
    event TokensSold(address indexed seller, uint256 amountIn, uint256 proceeds);
    event ReservesDeposited(uint256 amount);
    event ReservesWithdrawn(uint256 amount);
    event ETHWithdrawn(uint256 amount);

    constructor(IERC20 _token, uint256 _buyPrice, uint256 _sellPrice) Ownable(msg.sender) {
        if (_buyPrice == 0 || _sellPrice == 0) revert ZeroPrice();
        if (_buyPrice < _sellPrice) revert InvalidPriceSpread();
        token = _token;
        buyPrice = _buyPrice;
        sellPrice = _sellPrice;
    }

    function setPrices(uint256 newBuyPrice, uint256 newSellPrice) external onlyOwner {
        if (newBuyPrice == 0 || newSellPrice == 0) revert ZeroPrice();
        if (newBuyPrice < newSellPrice) revert InvalidPriceSpread();
        buyPrice = newBuyPrice;
        sellPrice = newSellPrice;
        emit PricesUpdated(newBuyPrice, newSellPrice);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function depositReserves(uint256 amount) external {
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit ReservesDeposited(amount);
    }

    function withdrawReserves(uint256 amount) external onlyOwner {
        token.safeTransfer(msg.sender, amount);
        emit ReservesWithdrawn(amount);
    }

    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool sent, ) = payable(msg.sender).call{value: balance}("");
        if (!sent) revert ETHTransferFailed();
        emit ETHWithdrawn(balance);
    }

    function getBuyQuote(uint256 amountOut) public view returns (uint256 cost) {
        return amountOut * buyPrice / 1e18;
    }

    function getSellQuote(uint256 amountIn) public view returns (uint256 proceeds) {
        return amountIn * sellPrice / 1e18;
    }

    function buyTokens(uint256 amountOut, uint256 deadline, uint256 maxCost) external payable nonReentrant whenNotPaused {
        if (block.timestamp > deadline) revert DeadlineExpired();
        uint256 cost = getBuyQuote(amountOut);
        if (cost > maxCost) revert CostExceedsMaxCost();
        if (msg.value < cost) revert InsufficientPayment();

        uint256 excess = msg.value - cost;
        if (excess > 0) {
            (bool refundSent, ) = payable(msg.sender).call{value: excess}("");
            if (!refundSent) revert ETHTransferFailed();
        }

        token.safeTransfer(msg.sender, amountOut);
        emit TokensPurchased(msg.sender, amountOut, cost);
    }

    function sellTokens(uint256 amountIn, uint256 deadline, uint256 minProceeds) external nonReentrant whenNotPaused {
        if (block.timestamp > deadline) revert DeadlineExpired();
        uint256 proceeds = getSellQuote(amountIn);
        if (proceeds < minProceeds) revert ProceedsBelowMin();

        token.safeTransferFrom(msg.sender, address(this), amountIn);
        (bool sent, ) = payable(msg.sender).call{value: proceeds}("");
        if (!sent) revert ETHTransferFailed();
        emit TokensSold(msg.sender, amountIn, proceeds);
    }
}
