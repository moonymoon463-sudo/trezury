import { ethers } from 'ethers';
import { hyperliquidSigningService } from './hyperliquidSigningService';

class UnifiedHyperliquidSigner {
  /**
   * Sign order with whatever wallet is active (MetaMask or generated)
   */
  async signOrderAction(
    walletSource: 'generated' | 'external',
    userId: string,
    password: string | null,
    action: any,
    nonce: number
  ): Promise<{ r: string; s: string; v: number }> {
    
    if (walletSource === 'external') {
      return this.signWithMetaMask(action, nonce);
    } else {
      if (!password) {
        throw new Error('Password required for generated wallet');
      }
      return this.signWithGeneratedWallet(userId, password, action, nonce);
    }
  }
  
  /**
   * Sign using MetaMask (EIP-712)
   */
  private async signWithMetaMask(action: any, nonce: number): Promise<{ r: string; s: string; v: number }> {
    const provider = window.ethereum;
    if (!provider) {
      throw new Error('MetaMask not found');
    }
    
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      throw new Error('No MetaMask account connected');
    }
    const address = accounts[0];
    
    const domain = {
      name: 'Exchange',
      version: '1',
      chainId: 421614,
      verifyingContract: '0x0000000000000000000000000000000000000000'
    };
    
    const types = {
      Agent: [
        { name: 'source', type: 'string' },
        { name: 'connectionId', type: 'bytes32' }
      ]
    };
    
    const message = {
      source: 'a',
      connectionId: ethers.ZeroHash
    };
    
    // Request MetaMask signature
    const signature = await provider.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify({ domain, types, message })]
    });
    
    const sig = ethers.Signature.from(signature);
    return { r: sig.r, s: sig.s, v: sig.v };
  }
  
  /**
   * Sign using generated wallet (existing logic)
   */
  private async signWithGeneratedWallet(
    userId: string, 
    password: string, 
    action: any, 
    nonce: number
  ): Promise<{ r: string; s: string; v: number }> {
    return hyperliquidSigningService.signOrderAction(userId, password, action, nonce);
  }
}

export const unifiedHyperliquidSigner = new UnifiedHyperliquidSigner();
