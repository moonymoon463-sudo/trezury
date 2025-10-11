// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@gelatonetwork/relay-context/contracts/GelatoRelayContext.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title GelatoSwapRelay
 * @notice Enables gasless token swaps using Gelato Relay + 0x Protocol
 * @dev Users can swap tokens without holding ETH for gas fees
 */
contract GelatoSwapRelay is GelatoRelayContext, ReentrancyGuard {
    address public constant PLATFORM_FEE_WALLET = 0xb46DA2C95D65e3F24B48653F1AaFe8BDA7c64835;
    uint256 public constant PLATFORM_FEE_BPS = 80; // 0.8%
    
    event GaslessSwapExecuted(
        address indexed user,
        address sellToken,
        address buyToken,
        uint256 amountIn,
        uint256 amountOut,
        uint256 platformFee,
        uint256 gelatoFee
    );
    
    /**
     * @notice Execute 0x swap with Gelato relay (SyncFee mode)
     * @dev Gelato fee is deducted from output tokens
     * @param zeroXSwapTarget The 0x exchange proxy address
     * @param swapCalldata The encoded 0x swap call
     * @param sellToken Token being sold
     * @param buyToken Token being bought
     * @param sellAmount Amount to sell
     */
    function executeSwapWithSyncFee(
        address zeroXSwapTarget,
        bytes calldata swapCalldata,
        address sellToken,
        address buyToken,
        uint256 sellAmount
    ) external onlyGelatoRelay nonReentrant {
        address user = _msgSender(); // Get real user, not Gelato relay address
        
        // 1. Pull tokens from user
        require(
            IERC20(sellToken).transferFrom(user, address(this), sellAmount),
            "GelatoSwapRelay: Transfer from user failed"
        );
        
        // 2. Approve 0x to spend tokens
        IERC20(sellToken).approve(zeroXSwapTarget, sellAmount);
        
        // 3. Execute 0x swap - receive output tokens here
        (bool success, ) = zeroXSwapTarget.call(swapCalldata);
        require(success, "GelatoSwapRelay: 0x swap failed");
        
        // 4. Calculate platform fee (0.8% of output)
        uint256 outputBalance = IERC20(buyToken).balanceOf(address(this));
        uint256 platformFee = (outputBalance * PLATFORM_FEE_BPS) / 10000;
        uint256 afterPlatformFee = outputBalance - platformFee;
        
        // 5. Transfer platform fee
        IERC20(buyToken).transfer(PLATFORM_FEE_WALLET, platformFee);
        
        // 6. Transfer Gelato relay fee (deducted from output) - THIS IS KEY
        _transferRelayFee();
        
        // 7. Transfer remaining tokens to user
        uint256 finalBalance = IERC20(buyToken).balanceOf(address(this));
        require(finalBalance > 0, "GelatoSwapRelay: No tokens remaining after fees");
        IERC20(buyToken).transfer(user, finalBalance);
        
        emit GaslessSwapExecuted(
            user,
            sellToken,
            buyToken,
            sellAmount,
            finalBalance,
            platformFee,
            afterPlatformFee - finalBalance
        );
    }
    
    /**
     * @notice Execute 0x swap with Gelato relay (Sponsored mode)
     * @dev Platform covers all gas costs
     * @param zeroXSwapTarget The 0x exchange proxy address
     * @param swapCalldata The encoded 0x swap call
     * @param sellToken Token being sold
     * @param buyToken Token being bought
     * @param sellAmount Amount to sell
     */
    function executeSwapSponsored(
        address zeroXSwapTarget,
        bytes calldata swapCalldata,
        address sellToken,
        address buyToken,
        uint256 sellAmount
    ) external onlyGelatoRelay nonReentrant {
        address user = _msgSender();
        
        // Same steps 1-4 as SyncFee
        require(
            IERC20(sellToken).transferFrom(user, address(this), sellAmount),
            "GelatoSwapRelay: Transfer failed"
        );
        
        IERC20(sellToken).approve(zeroXSwapTarget, sellAmount);
        (bool success, ) = zeroXSwapTarget.call(swapCalldata);
        require(success, "GelatoSwapRelay: Swap failed");
        
        uint256 outputBalance = IERC20(buyToken).balanceOf(address(this));
        uint256 platformFee = (outputBalance * PLATFORM_FEE_BPS) / 10000;
        uint256 netOutput = outputBalance - platformFee;
        
        IERC20(buyToken).transfer(PLATFORM_FEE_WALLET, platformFee);
        
        // 5. Send full net output to user (no Gelato fee deduction - we pay)
        IERC20(buyToken).transfer(user, netOutput);
        
        emit GaslessSwapExecuted(user, sellToken, buyToken, sellAmount, netOutput, platformFee, 0);
    }
    
    /**
     * @notice Emergency token withdrawal (owner only)
     */
    function emergencyWithdraw(address token, uint256 amount) external {
        require(_msgSender() == PLATFORM_FEE_WALLET, "GelatoSwapRelay: Only platform");
        IERC20(token).transfer(PLATFORM_FEE_WALLET, amount);
    }
}
