/**
 * 01 Protocol Client
 * Core API client for interacting with 01 Exchange
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { ZoConfig, ZoMarket, ZoApiResponse } from './types';

export class ZoClient {
  private connection: Connection;
  private config: ZoConfig;
  private keypair?: Keypair;

  constructor(config: ZoConfig, keypair?: Keypair) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
    this.keypair = keypair;
  }

  /**
   * Initialize client with wallet
   */
  async connectWallet(keypair: Keypair): Promise<void> {
    this.keypair = keypair;
    console.log('[01Protocol] Wallet connected:', keypair.publicKey.toBase58());
  }

  /**
   * Get Solana connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get wallet public key
   */
  getPublicKey(): PublicKey | null {
    return this.keypair?.publicKey || null;
  }

  /**
   * Check SOL balance
   */
  async getSolBalance(): Promise<number> {
    if (!this.keypair) {
      throw new Error('Wallet not connected');
    }

    const balance = await this.connection.getBalance(this.keypair.publicKey);
    return balance / 1e9; // Convert lamports to SOL
  }

  /**
   * Get cluster name
   */
  getCluster(): string {
    return this.config.cluster;
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return !!this.keypair;
  }

  /**
   * Get keypair (for signing)
   */
  getKeypair(): Keypair {
    if (!this.keypair) {
      throw new Error('Wallet not connected');
    }
    return this.keypair;
  }
}

/**
 * Create 01 Protocol client instance
 */
export function createZoClient(
  cluster: 'mainnet-beta' | 'devnet' = 'mainnet-beta',
  keypair?: Keypair
): ZoClient {
  const config: ZoConfig = {
    cluster,
    rpcUrl: cluster === 'mainnet-beta' 
      ? 'https://api.mainnet-beta.solana.com'
      : 'https://api.devnet.solana.com',
    programId: cluster === 'mainnet-beta'
      ? 'Zo1ggzTUKMY5bYnDvT5mtVeZxzf2FaLTbKkmvGUhUQk' // 01 mainnet program
      : 'Zo1ThtSHMh9tZGECwBDL81WJRL6s3QTHf733Tyko7KQ', // 01 devnet program
  };

  return new ZoClient(config, keypair);
}
