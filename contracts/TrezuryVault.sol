// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IERC3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/**
 * @title TrezuryVault
 * @notice Single smart contract wallet that:
 * - Holds ETH to pay for all gas fees
 * - Accepts gasless token transfers via EIP-3009/EIP-2612
 * - Executes swaps on Uniswap V3
 * - Automatically retains 0.8% platform fee
 * - Sends net output to users
 * - Controlled by Trezury relayer
 */
contract TrezuryVault is Ownable, ReentrancyGuard {
    uint256 public constant PLATFORM_FEE_BPS = 80; // 0.8%
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    address public constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant XAUT = 0x68749665FF8D2d112Fa859AA293F07A622782F38;
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    
    // Approved tokens for swaps
    mapping(address => bool) public approvedTokens;
    
    // Accumulated fees per token
    mapping(address => uint256) public accumulatedFees;
    
    // Total swaps executed
    uint256 public totalSwapsExecuted;
    
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 platformFee
    );
    
    event FeeWithdrawn(address indexed token, uint256 amount, address indexed recipient);
    event ETHDeposited(address indexed sender, uint256 amount);
    event ETHWithdrawn(address indexed recipient, uint256 amount);
    event TokenApproved(address indexed token, bool approved);
    
    constructor() {
        // Approve initial tokens
        approvedTokens[USDC] = true;
        approvedTokens[XAUT] = true;
        approvedTokens[WETH] = true;
    }
    
    /**
     * @notice Execute swap using EIP-3009 authorization (for USDC)
     * @param from User's address
     * @param value Amount to swap
     * @param validAfter Timestamp after which authorization is valid
     * @param validBefore Timestamp before which authorization is valid
     * @param nonce Unique nonce for authorization
     * @param v Signature component
     * @param r Signature component
     * @param s Signature component
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param fee Uniswap pool fee tier
     * @param amountOutMinimum Minimum output amount (slippage protection)
     */
    function executeSwapWithEIP3009(
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOutMinimum
    ) external onlyOwner nonReentrant returns (uint256 amountOut) {
        require(approvedTokens[tokenIn], "Token not approved");
        require(approvedTokens[tokenOut], "Token not approved");
        require(tokenIn == USDC, "EIP-3009 only for USDC");
        
        // Pull tokens from user using EIP-3009 authorization
        IERC3009(tokenIn).transferWithAuthorization(
            from,
            address(this),
            value,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
        
        // Execute swap and collect fee
        amountOut = _executeSwapInternal(from, tokenIn, tokenOut, value, fee, amountOutMinimum);
        
        emit SwapExecuted(from, tokenIn, tokenOut, value, amountOut, accumulatedFees[tokenOut]);
    }
    
    /**
     * @notice Execute swap using EIP-2612 permit (for XAUT, WETH, etc.)
     * @param from User's address
     * @param value Amount to swap
     * @param deadline Permit deadline
     * @param v Permit signature component
     * @param r Permit signature component
     * @param s Permit signature component
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param fee Uniswap pool fee tier
     * @param amountOutMinimum Minimum output amount
     */
    function executeSwapWithPermit(
        address from,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountOutMinimum
    ) external onlyOwner nonReentrant returns (uint256 amountOut) {
        require(approvedTokens[tokenIn], "Token not approved");
        require(approvedTokens[tokenOut], "Token not approved");
        
        // Use permit to approve this contract
        IERC20Permit(tokenIn).permit(from, address(this), value, deadline, v, r, s);
        
        // Pull tokens from user
        require(IERC20(tokenIn).transferFrom(from, address(this), value), "Transfer failed");
        
        // Execute swap and collect fee
        amountOut = _executeSwapInternal(from, tokenIn, tokenOut, value, fee, amountOutMinimum);
        
        emit SwapExecuted(from, tokenIn, tokenOut, value, amountOut, accumulatedFees[tokenOut]);
    }
    
    /**
     * @dev Internal swap execution with automatic fee collection
     */
    function _executeSwapInternal(
        address recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee,
        uint256 amountOutMinimum
    ) private returns (uint256 amountOut) {
        // Approve Uniswap router if needed
        uint256 currentAllowance = IERC20(tokenIn).allowance(address(this), UNISWAP_V3_ROUTER);
        if (currentAllowance < amountIn) {
            IERC20(tokenIn).approve(UNISWAP_V3_ROUTER, type(uint256).max);
        }
        
        // Execute swap - output comes to this contract first
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this), // Receive here to calculate fee
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = ISwapRouter(UNISWAP_V3_ROUTER).exactInputSingle(params);
        
        // Calculate platform fee (0.8% of output)
        uint256 platformFee = (amountOut * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netAmountOut = amountOut - platformFee;
        
        // Keep fee in this contract
        accumulatedFees[tokenOut] += platformFee;
        
        // Send net amount to user
        require(IERC20(tokenOut).transfer(recipient, netAmountOut), "Transfer to user failed");
        
        totalSwapsExecuted++;
        
        return netAmountOut;
    }
    
    /**
     * @notice Approve/revoke token for swaps
     */
    function setTokenApproval(address token, bool approved) external onlyOwner {
        approvedTokens[token] = approved;
        emit TokenApproved(token, approved);
    }
    
    /**
     * @notice Withdraw accumulated platform fees
     */
    function withdrawFees(address token, uint256 amount, address recipient) external onlyOwner {
        require(amount <= accumulatedFees[token], "Insufficient accumulated fees");
        
        accumulatedFees[token] -= amount;
        require(IERC20(token).transfer(recipient, amount), "Fee withdrawal failed");
        
        emit FeeWithdrawn(token, amount, recipient);
    }
    
    /**
     * @notice Withdraw all accumulated fees for a token
     */
    function withdrawAllFees(address token, address recipient) external onlyOwner {
        uint256 amount = accumulatedFees[token];
        require(amount > 0, "No fees to withdraw");
        
        accumulatedFees[token] = 0;
        require(IERC20(token).transfer(recipient, amount), "Fee withdrawal failed");
        
        emit FeeWithdrawn(token, amount, recipient);
    }
    
    /**
     * @notice Withdraw ETH (for gas management)
     */
    function withdrawETH(address payable recipient, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient ETH balance");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ETH withdrawal failed");
        
        emit ETHWithdrawn(recipient, amount);
    }
    
    /**
     * @notice Emergency token recovery
     */
    function emergencyWithdrawToken(address token, uint256 amount, address recipient) external onlyOwner {
        require(IERC20(token).transfer(recipient, amount), "Emergency withdrawal failed");
    }
    
    /**
     * @notice Get vault health status
     */
    function getVaultHealth() external view returns (
        uint256 ethBalance,
        uint256 usdcFees,
        uint256 xautFees,
        uint256 wethFees,
        uint256 totalSwaps
    ) {
        return (
            address(this).balance,
            accumulatedFees[USDC],
            accumulatedFees[XAUT],
            accumulatedFees[WETH],
            totalSwapsExecuted
        );
    }
    
    /**
     * @notice Accept ETH deposits for gas
     */
    receive() external payable {
        emit ETHDeposited(msg.sender, msg.value);
    }
}
