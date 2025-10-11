// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title TrezuryVault
 * @notice Platform vault for:
 * - Holding ETH to pay for gas fees
 * - Accumulating platform fees from swaps (0.8%)
 * - Managing approved tokens
 * - Controlled by Trezury platform
 * 
 * NOTE: This vault does NOT execute swaps directly.
 * Swaps are handled externally via 0x Protocol aggregator.
 */
contract TrezuryVault is Ownable, ReentrancyGuard {
    uint256 public constant PLATFORM_FEE_BPS = 80; // 0.8%
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Approved tokens for fee collection
    mapping(address => bool) public approvedTokens;
    
    // Accumulated fees per token
    mapping(address => uint256) public accumulatedFees;
    
    // Total number of fee collections
    uint256 public totalFeeCollections;
    
    event FeeCollected(
        address indexed token,
        uint256 amount,
        address indexed from
    );
    
    event FeeWithdrawn(address indexed token, uint256 amount, address indexed recipient);
    event ETHDeposited(address indexed sender, uint256 amount);
    event ETHWithdrawn(address indexed recipient, uint256 amount);
    event TokenApproved(address indexed token, bool approved);
    
    constructor() {
        // No pre-approved tokens
        // Owner must explicitly approve tokens via setTokenApproval()
    }
    
    /**
     * @notice Approve/revoke token for fee collection
     * @param token Token address to approve or revoke
     * @param approved True to approve, false to revoke
     */
    function setTokenApproval(address token, bool approved) external onlyOwner {
        approvedTokens[token] = approved;
        emit TokenApproved(token, approved);
    }
    
    /**
     * @notice Collect platform fees from external source
     * @param token Token address
     * @param amount Amount to collect
     * @param from Address to collect from (must have approved this vault)
     */
    function collectFees(address token, uint256 amount, address from) external onlyOwner nonReentrant {
        require(approvedTokens[token], "Token not approved");
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer fees to vault
        require(IERC20(token).transferFrom(from, address(this), amount), "Fee collection failed");
        
        // Track accumulated fees
        accumulatedFees[token] += amount;
        totalFeeCollections++;
        
        emit FeeCollected(token, amount, from);
    }
    
    /**
     * @notice Withdraw accumulated platform fees
     * @param token Token address
     * @param amount Amount to withdraw
     * @param recipient Address to send fees to
     */
    function withdrawFees(address token, uint256 amount, address recipient) external onlyOwner {
        require(amount <= accumulatedFees[token], "Insufficient accumulated fees");
        
        accumulatedFees[token] -= amount;
        require(IERC20(token).transfer(recipient, amount), "Fee withdrawal failed");
        
        emit FeeWithdrawn(token, amount, recipient);
    }
    
    /**
     * @notice Withdraw all accumulated fees for a token
     * @param token Token address
     * @param recipient Address to send fees to
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
     * @param recipient Address to send ETH to
     * @param amount Amount of ETH to withdraw
     */
    function withdrawETH(address payable recipient, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient ETH balance");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ETH withdrawal failed");
        
        emit ETHWithdrawn(recipient, amount);
    }
    
    /**
     * @notice Emergency token recovery
     * @param token Token address
     * @param amount Amount to withdraw
     * @param recipient Address to send tokens to
     */
    function emergencyWithdrawToken(address token, uint256 amount, address recipient) external onlyOwner {
        require(IERC20(token).transfer(recipient, amount), "Emergency withdrawal failed");
    }
    
    /**
     * @notice Get vault health status for specific tokens
     * @param tokens Array of token addresses to check
     * @return ethBalance Vault's ETH balance
     * @return tokenAddresses Array of token addresses queried
     * @return fees Array of accumulated fees for each token
     * @return totalCollections Total number of fee collections
     */
    function getVaultHealth(address[] calldata tokens) external view returns (
        uint256 ethBalance,
        address[] memory tokenAddresses,
        uint256[] memory fees,
        uint256 totalCollections
    ) {
        uint256[] memory feeAmounts = new uint256[](tokens.length);
        
        for (uint i = 0; i < tokens.length; i++) {
            feeAmounts[i] = accumulatedFees[tokens[i]];
        }
        
        return (
            address(this).balance,
            tokens,
            feeAmounts,
            totalFeeCollections
        );
    }
    
    /**
     * @notice Get accumulated fees for a specific token
     * @param token Token address
     * @return Accumulated fees for the token
     */
    function getAccumulatedFees(address token) external view returns (uint256) {
        return accumulatedFees[token];
    }
    
    /**
     * @notice Accept ETH deposits for gas
     */
    receive() external payable {
        emit ETHDeposited(msg.sender, msg.value);
    }
}
