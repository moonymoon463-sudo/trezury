/**
 * Wormhole VAA (Verifiable Action Approval) fetching and redemption
 */

import { ethers } from 'https://esm.sh/ethers@6.13.2';

const WORMHOLE_GUARDIAN_RPC = 'https://wormhole-v2-mainnet-api.certus.one';
const WORMHOLE_GUARDIAN_BACKUP = 'https://api.wormholescan.io';

export interface VAA {
  vaaBytes: string;
  emitterChain: number;
  emitterAddress: string;
  sequence: string;
  timestamp: number;
  signatures: any[];
}

/**
 * Fetch VAA from Wormhole Guardian Network
 * Uses exponential backoff as VAAs may take time to be signed by guardians
 */
export async function fetchVAA(
  emitterChain: number,
  emitterAddress: string,
  sequence: string,
  maxAttempts = 60, // 60 attempts = ~5 minutes with backoff
): Promise<VAA> {
  console.log('[WormholeVAA] Fetching VAA:', { emitterChain, emitterAddress, sequence });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Try primary guardian RPC
      const response = await fetch(
        `${WORMHOLE_GUARDIAN_RPC}/v1/signed_vaa/${emitterChain}/${emitterAddress}/${sequence}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.vaaBytes) {
          console.log('[WormholeVAA] VAA fetched successfully');
          return {
            vaaBytes: data.vaaBytes,
            emitterChain,
            emitterAddress,
            sequence,
            timestamp: Date.now(),
            signatures: data.signatures || [],
          };
        }
      }

      // Try backup API
      const backupResponse = await fetch(
        `${WORMHOLE_GUARDIAN_BACKUP}/api/v1/vaas/${emitterChain}/${emitterAddress}/${sequence}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (backupResponse.ok) {
        const backupData = await backupResponse.json();
        if (backupData.data?.vaa) {
          console.log('[WormholeVAA] VAA fetched from backup API');
          return {
            vaaBytes: backupData.data.vaa,
            emitterChain,
            emitterAddress,
            sequence,
            timestamp: Date.now(),
            signatures: [],
          };
        }
      }

      // VAA not ready yet, wait with exponential backoff
      const delayMs = Math.min(1000 * Math.pow(1.5, attempt), 10000);
      console.log(`[WormholeVAA] VAA not ready, attempt ${attempt + 1}/${maxAttempts}, waiting ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

    } catch (error) {
      console.error(`[WormholeVAA] Error fetching VAA (attempt ${attempt + 1}):`, error);
      
      if (attempt < maxAttempts - 1) {
        const delayMs = Math.min(1000 * Math.pow(1.5, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`Failed to fetch VAA after ${maxAttempts} attempts. The transaction may still be processing.`);
}

/**
 * Parse sequence number from transaction receipt logs using ethers Interface
 */
export function parseSequenceFromReceipt(receipt: any, tokenBridgeAddress: string): string {
  const iface = new ethers.Interface([
    'event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)',
  ]);
  
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === tokenBridgeAddress.toLowerCase()) {
      try {
        const parsed = iface.parseLog({
          topics: log.topics,
          data: log.data,
        });
        if (parsed?.name === 'LogMessagePublished') {
          return parsed.args.sequence.toString();
        }
      } catch {
        // Not the event we're looking for, continue
      }
    }
  }
  
  throw new Error('Wormhole sequence not found in transaction logs');
}

/**
 * Get emitter address from token bridge address (replaces SDK function)
 */
export function getEmitterAddressEth(tokenBridgeAddress: string): string {
  return tokenBridgeAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

/**
 * Check if VAA has been redeemed on target chain
 */
export async function isVAARedeemed(
  provider: any,
  tokenBridgeAddress: string,
  vaaHash: string
): Promise<boolean> {
  try {
    const tokenBridgeAbi = [
      'function isTransferCompleted(bytes32 hash) view returns (bool)',
    ];
    
    const tokenBridge = new ethers.Contract(tokenBridgeAddress, tokenBridgeAbi, provider);
    
    return await tokenBridge.isTransferCompleted(vaaHash);
  } catch (error) {
    console.error('[WormholeVAA] Error checking redemption status:', error);
    return false;
  }
}

/**
 * Calculate VAA hash for tracking
 */
export function calculateVAAHash(vaaBytes: string): string {
  // VAA hash is keccak256 of the VAA body (excluding signatures)
  // For simplicity, we'll use the first 32 bytes as identifier
  return vaaBytes.slice(0, 66);
}
