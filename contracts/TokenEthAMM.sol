// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract TokenEthAMM is ERC20, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    error DeadlineExpired();
    error ZeroAmount();
    error InsufficientLiquidity();
    error InsufficientOutput();
    error InsufficientReserves();
    error ETHTransferFailed();

    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    uint256 public constant SWAP_FEE = 3;
    uint256 public constant FEE_DENOMINATOR = 1000;

    IERC20 public immutable token;
    uint256 public ethReserve;
    uint256 public timReserve;

    event LiquidityAdded(address indexed provider, uint256 ethAmount, uint256 timAmount, uint256 lpMinted);
    event LiquidityRemoved(address indexed provider, uint256 ethAmount, uint256 timAmount, uint256 lpBurned);
    event Swap(address indexed sender, uint256 ethIn, uint256 timIn, uint256 ethOut, uint256 timOut);

    constructor(IERC20 _token) ERC20("TIM-ETH LP", "TIMETH") Ownable(msg.sender) {
        token = _token;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getReserves() external view returns (uint256, uint256) {
        return (ethReserve, timReserve);
    }

    function getAmountOut(uint256 inputAmount, uint256 inputReserve, uint256 outputReserve) public pure returns (uint256) {
        if (inputAmount == 0) revert ZeroAmount();
        if (inputReserve == 0 || outputReserve == 0) revert InsufficientReserves();
        uint256 inputWithFee = inputAmount * (FEE_DENOMINATOR - SWAP_FEE);
        uint256 numerator = inputWithFee * outputReserve;
        uint256 denominator = inputReserve * FEE_DENOMINATOR + inputWithFee;
        return numerator / denominator;
    }

    function addLiquidity(uint256 timAmount, uint256 deadline) external payable nonReentrant whenNotPaused {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (msg.value == 0 || timAmount == 0) revert ZeroAmount();

        uint256 ethUsed;
        uint256 timUsed;
        uint256 liquidity;

        if (ethReserve == 0 && timReserve == 0) {
            ethUsed = msg.value;
            timUsed = timAmount;
            liquidity = Math.sqrt(ethUsed * timUsed);
            if (liquidity <= MINIMUM_LIQUIDITY) revert InsufficientLiquidity();
            _mint(address(0xdead), MINIMUM_LIQUIDITY);
            uint256 lpMinted = liquidity - MINIMUM_LIQUIDITY;
            _mint(msg.sender, lpMinted);
            emit LiquidityAdded(msg.sender, ethUsed, timUsed, lpMinted);
        } else {
            uint256 optimalTim = (msg.value * timReserve) / ethReserve;
            if (optimalTim <= timAmount) {
                timUsed = optimalTim;
                ethUsed = msg.value;
                if (msg.value > ethUsed) {
                    (bool refundSent, ) = payable(msg.sender).call{value: msg.value - ethUsed}("");
                    if (!refundSent) revert ETHTransferFailed();
                }
            } else {
                timUsed = timAmount;
                ethUsed = (timAmount * ethReserve) / timReserve;
                if (msg.value > ethUsed) {
                    (bool refundSent, ) = payable(msg.sender).call{value: msg.value - ethUsed}("");
                    if (!refundSent) revert ETHTransferFailed();
                }
            }
            liquidity = (ethUsed * totalSupply()) / ethReserve;
            _mint(msg.sender, liquidity);
            emit LiquidityAdded(msg.sender, ethUsed, timUsed, liquidity);
        }

        ethReserve += ethUsed;
        timReserve += timUsed;

        token.safeTransferFrom(msg.sender, address(this), timUsed);
    }

    function removeLiquidity(uint256 lpAmount, uint256 minEth, uint256 minTim, uint256 deadline) external nonReentrant {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (lpAmount == 0) revert ZeroAmount();

        uint256 total = totalSupply();
        uint256 ethAmount = (lpAmount * ethReserve) / total;
        uint256 timAmount = (lpAmount * timReserve) / total;

        if (ethAmount < minEth || timAmount < minTim) revert InsufficientOutput();
        if (ethAmount > address(this).balance) revert InsufficientReserves();

        ethReserve -= ethAmount;
        timReserve -= timAmount;

        _burn(msg.sender, lpAmount);

        token.safeTransfer(msg.sender, timAmount);
        (bool sent, ) = payable(msg.sender).call{value: ethAmount}("");
        if (!sent) revert ETHTransferFailed();

        emit LiquidityRemoved(msg.sender, ethAmount, timAmount, lpAmount);
    }

    function swapExactETHForTokens(uint256 minTimOut, uint256 deadline) external payable nonReentrant whenNotPaused {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (msg.value == 0) revert ZeroAmount();

        uint256 timOut = getAmountOut(msg.value, ethReserve, timReserve);
        if (timOut < minTimOut) revert InsufficientOutput();
        if (timOut > timReserve) revert InsufficientReserves();

        ethReserve += msg.value;
        timReserve -= timOut;

        token.safeTransfer(msg.sender, timOut);
        emit Swap(msg.sender, msg.value, 0, 0, timOut);
    }

    function swapExactTokensForETH(uint256 timIn, uint256 minEthOut, uint256 deadline) external nonReentrant whenNotPaused {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (timIn == 0) revert ZeroAmount();

        uint256 ethOut = getAmountOut(timIn, timReserve, ethReserve);
        if (ethOut < minEthOut) revert InsufficientOutput();
        if (ethOut > address(this).balance) revert InsufficientReserves();

        timReserve += timIn;
        ethReserve -= ethOut;

        token.safeTransferFrom(msg.sender, address(this), timIn);
        (bool sent, ) = payable(msg.sender).call{value: ethOut}("");
        if (!sent) revert ETHTransferFailed();

        emit Swap(msg.sender, 0, timIn, ethOut, 0);
    }

    function sync() external {
        ethReserve = address(this).balance;
        timReserve = token.balanceOf(address(this));
    }

    receive() external payable {}
}
