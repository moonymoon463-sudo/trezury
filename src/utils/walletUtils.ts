import { ethers } from "ethers";

/**
 * Derives the wallet address from a private key
 */
export function getWalletAddressFromPrivateKey(privateKey: string): string {
  try {
    // Ensure private key has 0x prefix
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const wallet = new ethers.Wallet(formattedKey);
    return wallet.address;
  } catch (error) {
    throw new Error(`Invalid private key: ${error}`);
  }
}

/**
 * Formats a private key to ensure proper 0x prefix
 */
export function formatPrivateKey(privateKey: string): string {
  return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
}