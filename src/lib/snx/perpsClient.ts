/**
 * Synthetix Perps V3 Client
 * Handles market data, account operations, and trade execution
 */

import { ethers, type TransactionRequest, type TransactionReceipt, type Signer } from 'ethers';
import { getSnxAddresses, getMarketInfo } from '@/config/snxAddresses';
import type {
  SnxMarket,
  SnxMarketDetails,
  SnxAccount,
  SnxPosition,
  TradeParams,
  MarginInfo,
  FundingRateInfo,
  LeverageValidation,
  PositionRisk
} from '@/types/snx';

// Minimal ABI for Perps Market Proxy
const PERPS_MARKET_ABI = [
  'function getMarketSummary(uint128 marketId) view returns (tuple(int256 skew, uint256 size, uint256 maxOpenInterest, uint256 currentFundingRate, uint256 currentFundingVelocity) summary)',
  'function indexPrice(uint128 marketId) view returns (uint256 price)',
  'function fillPrice(uint128 marketId, int128 orderSize, uint256 price) view returns (uint256 fillPrice)',
  'function getMaxMarketSize(uint128 marketId, bool isLong) view returns (uint256 maxSize)',
  'function getFundingParameters(uint128 marketId) view returns (uint256 skewScale, uint256 maxFundingVelocity)',
  'function getOrder(uint128 accountId, uint128 marketId) view returns (tuple(uint128 commitmentTime, uint256 request, uint256 expiration) order)',
  'function commitOrder(tuple(uint128 marketId, uint128 accountId, int128 sizeDelta, uint128 settlementStrategyId, uint256 acceptablePrice, bytes32 trackingCode, address referrer) commitment) payable',
  'function settleOrder(uint128 accountId, uint128 marketId)'
];

const ACCOUNT_PROXY_ABI = [
  'function getAccountOwner(uint128 accountId) view returns (address owner)',
  'function getAccountCollateral(uint128 accountId, uint128 synthMarketId) view returns (uint256 totalDeposited, uint256 totalLocked, uint256 availableCollateral)',
  'function getAccountLastInteraction(uint128 accountId, uint128 marketId) view returns (uint256 timestamp)',
  'function getAvailableMargin(uint128 accountId) view returns (int256 availableMargin)',
  'function getOpenPosition(uint128 accountId, uint128 marketId) view returns (int256 totalPnl, int256 accruedFunding, int128 positionSize, uint256 owedInterest)',
  'function getRequiredMargins(uint128 accountId) view returns (uint256 requiredInitialMargin, uint256 requiredMaintenanceMargin, uint256 totalAccountValue)',
  'function modifyCollateral(uint128 accountId, uint128 synthMarketId, int256 amountDelta)'
];

export class SynthetixPerpsClient {
  private provider: ethers.JsonRpcProvider;
  private chainId: number;
  private perpsMarket: ethers.Contract;
  private accountProxy: ethers.Contract;

  constructor(chainId: number = 8453) {
    this.chainId = chainId;
    const addresses = getSnxAddresses(chainId);
    
    // Initialize provider
    const rpcUrl = chainId === 8453 ? 'https://mainnet.base.org' :
                   chainId === 1 ? 'https://eth.llamarpc.com' :
                   chainId === 42161 ? 'https://arb1.arbitrum.io/rpc' :
                   'https://mainnet.optimism.io';
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Initialize contracts
    this.perpsMarket = new ethers.Contract(
      addresses.perpsMarketProxy,
      PERPS_MARKET_ABI,
      this.provider
    );
    
    this.accountProxy = new ethers.Contract(
      addresses.accountProxy,
      ACCOUNT_PROXY_ABI,
      this.provider
    );
  }

  // ========== Market Data ==========

  async getMarkets(): Promise<SnxMarket[]> {
    const addresses = getSnxAddresses(this.chainId);
    const markets: SnxMarket[] = [];

    for (const [symbol, config] of Object.entries(addresses.markets)) {
      try {
        const marketInfo = await this.getMarketInfo(symbol);
        markets.push(marketInfo);
      } catch (error) {
        console.error(`Failed to load market ${symbol}:`, error);
      }
    }

    return markets;
  }

  async getMarketInfo(marketKey: string): Promise<SnxMarket> {
    const market = getMarketInfo(this.chainId, marketKey);
    const marketId = BigInt(market.marketId);

    try {
      // Get market summary
      const summary = await this.perpsMarket.getMarketSummary(marketId);
      
      // Get index price
      const indexPriceRaw = await this.perpsMarket.indexPrice(marketId);
      const indexPrice = Number(ethers.formatEther(indexPriceRaw));

      // Get funding parameters
      const fundingParams = await this.perpsMarket.getFundingParameters(marketId);

      // Calculate funding rate (hourly)
      const fundingRate = Number(ethers.formatEther(summary.currentFundingRate));
      const nextFundingTime = Date.now() + 3600000; // 1 hour from now

      // Get max leverage (estimated from max market size)
      const maxLeverage = await this.estimateMaxLeverage(marketId);

      return {
        marketId: marketId,
        marketKey: market.marketKey,
        symbol: market.symbol,
        name: market.name,
        price: indexPrice,
        indexPrice: indexPrice,
        fundingRate: fundingRate,
        nextFundingTime: nextFundingTime,
        openInterest: Number(ethers.formatEther(summary.size)),
        skew: Number(ethers.formatEther(summary.skew)),
        maxLeverage: maxLeverage,
        makerFee: 0.0002, // 0.02% typical
        takerFee: 0.0006, // 0.06% typical
        maxMarketValue: Number(ethers.formatEther(summary.maxOpenInterest)),
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error(`Failed to get market info for ${marketKey}:`, error);
      throw error;
    }
  }

  async getPrice(marketKey: string): Promise<number> {
    const market = getMarketInfo(this.chainId, marketKey);
    const priceRaw = await this.perpsMarket.indexPrice(BigInt(market.marketId));
    return Number(ethers.formatEther(priceRaw));
  }

  async getIndexPrice(marketKey: string): Promise<number> {
    return this.getPrice(marketKey);
  }

  async getFundingRate(marketKey: string): Promise<FundingRateInfo> {
    const market = getMarketInfo(this.chainId, marketKey);
    const summary = await this.perpsMarket.getMarketSummary(BigInt(market.marketId));
    
    const currentFundingRate = Number(ethers.formatEther(summary.currentFundingRate));
    const fundingVelocity = Number(ethers.formatEther(summary.currentFundingVelocity));

    return {
      currentFundingRate: currentFundingRate,
      annualizedRate: currentFundingRate * 24 * 365, // Hourly → Annual
      nextFundingTime: Date.now() + 3600000,
      fundingVelocity: fundingVelocity
    };
  }

  async estimateMaxLeverage(marketId: bigint): Promise<number> {
    try {
      // Synthetix max leverage is typically 50x but varies by market
      // For now, return 50x and let market caps enforce actual limits
      return 50;
    } catch {
      return 25; // Conservative fallback
    }
  }

  // ========== Account Operations ==========

  async getAccount(accountId: bigint): Promise<SnxAccount> {
    try {
      const owner = await this.accountProxy.getAccountOwner(accountId);
      const margins = await this.accountProxy.getRequiredMargins(accountId);
      const availableMargin = await this.accountProxy.getAvailableMargin(accountId);

      return {
        accountId: accountId,
        owner: owner,
        collateral: Number(ethers.formatEther(margins.totalAccountValue)),
        availableMargin: Number(ethers.formatEther(availableMargin)),
        requiredInitialMargin: Number(ethers.formatEther(margins.requiredInitialMargin)),
        requiredMaintenanceMargin: Number(ethers.formatEther(margins.requiredMaintenanceMargin)),
        totalPnl: 0, // Calculated from positions
        openPositions: 0 // Calculated from positions
      };
    } catch (error) {
      console.error('Failed to get account:', error);
      throw error;
    }
  }

  async getPosition(accountId: bigint, marketKey: string): Promise<SnxPosition | null> {
    const market = getMarketInfo(this.chainId, marketKey);
    const marketId = BigInt(market.marketId);

    try {
      const position = await this.accountProxy.getOpenPosition(accountId, marketId);
      const positionSize = Number(ethers.formatEther(position.positionSize));

      if (positionSize === 0) {
        return null;
      }

      const currentPrice = await this.getPrice(marketKey);
      const totalPnl = Number(ethers.formatEther(position.totalPnl));
      const fundingAccrued = Number(ethers.formatEther(position.accruedFunding));

      // Calculate entry price from PnL
      const notionalValue = Math.abs(positionSize * currentPrice);
      const entryPrice = currentPrice - (totalPnl / positionSize);
      
      // Calculate leverage
      const account = await this.getAccount(accountId);
      const leverage = notionalValue / account.availableMargin;

      // Calculate liquidation price
      const liquidationPrice = await this.estimateLiquidationPrice({
        accountId,
        marketId,
        marketKey: market.marketKey,
        symbol: market.symbol,
        side: positionSize > 0 ? 'LONG' : 'SHORT',
        size: Math.abs(positionSize),
        notionalValue,
        entryPrice,
        currentPrice,
        leverage,
        unrealizedPnl: totalPnl,
        realizedPnl: 0,
        liquidationPrice: 0, // Will be calculated
        marginRatio: 0,
        fundingAccrued,
        openedAt: Date.now()
      });

      return {
        accountId,
        marketId,
        marketKey: market.marketKey,
        symbol: market.symbol,
        side: positionSize > 0 ? 'LONG' : 'SHORT',
        size: Math.abs(positionSize),
        notionalValue,
        entryPrice,
        currentPrice,
        leverage,
        unrealizedPnl: totalPnl,
        realizedPnl: 0,
        liquidationPrice,
        marginRatio: account.availableMargin / account.requiredMaintenanceMargin,
        fundingAccrued,
        openedAt: Date.now()
      };
    } catch (error) {
      console.error('Failed to get position:', error);
      return null;
    }
  }

  // ========== Trading ==========

  async buildTradeTx(params: TradeParams): Promise<TransactionRequest> {
    const commitment = {
      marketId: params.marketId,
      accountId: params.accountId,
      sizeDelta: ethers.parseEther(params.sizeDelta.toString()),
      settlementStrategyId: 0, // Default strategy
      acceptablePrice: ethers.parseEther(params.acceptablePrice.toString()),
      trackingCode: params.trackingCode || ethers.ZeroHash,
      referrer: params.referrer || ethers.ZeroAddress
    };

    const data = this.perpsMarket.interface.encodeFunctionData('commitOrder', [commitment]);

    return {
      to: await this.perpsMarket.getAddress(),
      data: data,
      value: 0n,
      chainId: this.chainId
    };
  }

  async submitTradeTx(signer: Signer, tx: TransactionRequest): Promise<TransactionReceipt> {
    const response = await signer.sendTransaction(tx);
    return await response.wait();
  }

  // ========== Risk Calculations ==========

  async estimateLiquidationPrice(position: SnxPosition): Promise<number> {
    const { entryPrice, side, leverage, size } = position;
    
    // Simplified liquidation price calculation
    // Actual: liquidationPrice = entry * (1 - (availableMargin / position.size))
    // Approximation: liquidationPrice = entry * (1 - 1/leverage + maintenanceMarginRatio)
    
    const maintenanceMarginRatio = 0.03; // 3% typical
    const liquidationFactor = 1 / leverage - maintenanceMarginRatio;

    if (side === 'LONG') {
      return entryPrice * (1 - liquidationFactor);
    } else {
      return entryPrice * (1 + liquidationFactor);
    }
  }

  async calculateMarginRequirement(
    size: number,
    leverage: number,
    price: number
  ): Promise<MarginInfo> {
    const notionalValue = size * price;
    const requiredMargin = notionalValue / leverage;
    const maintenanceMargin = notionalValue * 0.03; // 3% maintenance

    // Calculate liquidation price
    const liquidationPrice = leverage > 1 
      ? price * (1 - 1/leverage + 0.03)
      : price * 0.5;

    return {
      requiredMargin,
      availableMargin: 0, // Must be fetched from account
      sufficient: false, // Must be validated
      liquidationPrice,
      marginRatio: requiredMargin / maintenanceMargin
    };
  }

  async validateLeverage(marketKey: string, leverage: number): Promise<LeverageValidation> {
    const maxLeverage = await this.getMaxLeverage(marketKey);

    if (leverage > maxLeverage) {
      return {
        valid: false,
        maxAllowed: maxLeverage,
        reason: `Max leverage for ${marketKey} is ${maxLeverage}×`
      };
    }

    if (leverage < 1) {
      return {
        valid: false,
        maxAllowed: maxLeverage,
        reason: 'Leverage must be at least 1×'
      };
    }

    return {
      valid: true,
      maxAllowed: maxLeverage
    };
  }

  async getMaxLeverage(marketKey: string): Promise<number> {
    const market = getMarketInfo(this.chainId, marketKey);
    return this.estimateMaxLeverage(BigInt(market.marketId));
  }

  async assessPositionRisk(position: SnxPosition): Promise<PositionRisk> {
    const distanceToLiq = Math.abs(
      (position.currentPrice - position.liquidationPrice) / position.currentPrice * 100
    );

    let riskLevel: PositionRisk['riskLevel'] = 'low';
    let recommendedAction: string | undefined;

    if (distanceToLiq < 5) {
      riskLevel = 'critical';
      recommendedAction = 'Add margin immediately or close position';
    } else if (distanceToLiq < 10) {
      riskLevel = 'high';
      recommendedAction = 'Consider adding margin or reducing position';
    } else if (distanceToLiq < 20) {
      riskLevel = 'medium';
      recommendedAction = 'Monitor position closely';
    }

    return {
      distanceToLiquidation: distanceToLiq,
      marginRatio: position.marginRatio,
      riskLevel,
      recommendedAction
    };
  }
}

// Export singleton instance
export const snxPerpsClient = new SynthetixPerpsClient(8453); // Default to Base
