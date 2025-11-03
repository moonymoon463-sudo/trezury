import { ethers } from 'ethers';

class HyperliquidWalletService {
  /**
   * Sign EIP-712 typed data for Hyperliquid orders
   */
  async signOrderAction(
    signer: ethers.Signer,
    action: any,
    nonce: number
  ): Promise<{ r: string; s: string; v: number }> {
    const domain = {
      name: 'Exchange',
      version: '1',
      chainId: 421614, // HyperEVM
      verifyingContract: '0x0000000000000000000000000000000000000000'
    };

    const types = {
      Agent: [
        { name: 'source', type: 'string' },
        { name: 'connectionId', type: 'bytes32' }
      ]
    };

    const value = {
      source: 'a',
      connectionId: ethers.ZeroHash
    };

    const signature = await signer.signTypedData(domain, types, value);
    const sig = ethers.Signature.from(signature);

    return {
      r: sig.r,
      s: sig.s,
      v: sig.v
    };
  }

  /**
   * Sign L1 action (for deposits/withdrawals)
   */
  async signL1Action(
    signer: ethers.Signer,
    action: any,
    nonce: number
  ): Promise<{ r: string; s: string; v: number }> {
    const domain = {
      name: 'HyperliquidSignTransaction',
      version: '1',
      chainId: 421614,
      verifyingContract: '0x0000000000000000000000000000000000000000'
    };

    const types = {
      HyperliquidTransaction: [
        { name: 'source', type: 'string' },
        { name: 'action', type: 'string' },
        { name: 'nonce', type: 'uint64' },
        { name: 'hyperliquidChain', type: 'string' }
      ]
    };

    const value = {
      source: 'a',
      action: JSON.stringify(action),
      nonce: nonce,
      hyperliquidChain: 'Mainnet'
    };

    const signature = await signer.signTypedData(domain, types, value);
    const sig = ethers.Signature.from(signature);

    return {
      r: sig.r,
      s: sig.s,
      v: sig.v
    };
  }

  /**
   * Get current nonce timestamp for orders
   */
  getNonce(): number {
    return Date.now();
  }

  /**
   * Validate Ethereum address
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * Format address for display
   */
  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}

export const hyperliquidWalletService = new HyperliquidWalletService();
