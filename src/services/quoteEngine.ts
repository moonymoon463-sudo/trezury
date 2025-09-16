import { supabase } from "@/integrations/supabase/client";
import { goldPriceService } from "./goldPrice";

export interface QuoteRequest {
  side: 'buy' | 'sell';
  inputAsset: 'USDC' | 'GOLD';
  outputAsset: 'USDC' | 'GOLD';
  inputAmount?: number;
  outputAmount?: number;
  grams?: number;
}

export interface Quote {
  id: string;
  side: 'buy' | 'sell';
  inputAsset: string;
  outputAsset: string;
  inputAmount: number;
  outputAmount: number;
  grams: number;
  unitPriceUsd: number;
  feeBps: number;
  feeUsd: number;
  slippageBps: number;
  minimumReceived: number;
  expiresAt: string;
  route: Record<string, any>;
}

class QuoteEngineService {
  private readonly BASE_FEE_BPS = 50; // 0.5% base fee
  private readonly PLATFORM_FEE_BPS = 100; // 1% platform fee 
  private readonly TOTAL_FEE_BPS = this.BASE_FEE_BPS + this.PLATFORM_FEE_BPS; // 1.5% total
  private readonly SLIPPAGE_BPS = 25; // 0.25% slippage protection
  private readonly GRAMS_PER_TROY_OUNCE = 31.1035;
  private readonly QUOTE_VALIDITY_MINUTES = 2;
  private readonly PLATFORM_FEE_WALLET = 'BzSNDYfdEf8Q2wpr3rvrqQyreAWqB25AnmQA6XohUNom'; // Platform fee collection wallet

  async generateQuote(request: QuoteRequest, userId: string): Promise<Quote> {
    const goldPrice = await goldPriceService.getCurrentPrice();
    const unitPriceUsd = goldPrice.usd_per_gram;

    let inputAmount: number;
    let outputAmount: number;
    let grams: number;

    if (request.side === 'buy') {
      // Buying gold with USDC
      if (request.inputAmount) {
        // User specified USD amount
        inputAmount = request.inputAmount;
        const feeUsd = (inputAmount * this.TOTAL_FEE_BPS) / 10000;
        const netUsdAmount = inputAmount - feeUsd;
        const troyOunces = netUsdAmount / unitPriceUsd;
        grams = troyOunces * this.GRAMS_PER_TROY_OUNCE;
        outputAmount = grams;
      } else if (request.grams) {
        // User specified gold amount in grams
        grams = request.grams;
        const troyOunces = grams / this.GRAMS_PER_TROY_OUNCE;
        const grossUsdAmount = troyOunces * unitPriceUsd;
        const feeUsd = (grossUsdAmount * this.TOTAL_FEE_BPS) / 10000;
        inputAmount = grossUsdAmount + feeUsd;
        outputAmount = grams;
      } else {
        throw new Error('Must specify either inputAmount or grams for buy order');
      }
    } else {
      // Selling gold for USDC
      if (request.grams) {
        // User specified gold amount in grams
        grams = request.grams;
        const troyOunces = grams / this.GRAMS_PER_TROY_OUNCE;
        const grossUsdAmount = troyOunces * unitPriceUsd;
        const feeUsd = (grossUsdAmount * this.TOTAL_FEE_BPS) / 10000;
        inputAmount = grams;
        outputAmount = grossUsdAmount - feeUsd;
      } else if (request.outputAmount) {
        // User specified desired USD output
        outputAmount = request.outputAmount;
        const feeUsd = (outputAmount * this.TOTAL_FEE_BPS) / (10000 - this.TOTAL_FEE_BPS);
        const grossUsdAmount = outputAmount + feeUsd;
        const troyOunces = grossUsdAmount / unitPriceUsd;
        grams = troyOunces * this.GRAMS_PER_TROY_OUNCE;
        inputAmount = grams;
      } else {
        throw new Error('Must specify either grams or outputAmount for sell order');
      }
    }

    const feeUsd = request.side === 'buy' 
      ? (inputAmount * this.TOTAL_FEE_BPS) / 10000
      : (outputAmount * this.TOTAL_FEE_BPS) / (10000 - this.TOTAL_FEE_BPS);
    
    // Calculate platform fee portion
    const platformFeeUsd = request.side === 'buy'
      ? (inputAmount * this.PLATFORM_FEE_BPS) / 10000
      : (outputAmount * this.PLATFORM_FEE_BPS) / (10000 - this.TOTAL_FEE_BPS);

    const slippageAmount = (outputAmount * this.SLIPPAGE_BPS) / 10000;
    const minimumReceived = outputAmount - slippageAmount;

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.QUOTE_VALIDITY_MINUTES);

    const quote: Quote = {
      id: crypto.randomUUID(),
      side: request.side,
      inputAsset: request.inputAsset,
      outputAsset: request.outputAsset,
      inputAmount: Number(inputAmount.toFixed(2)),
      outputAmount: Number(outputAmount.toFixed(6)),
      grams: Number(grams.toFixed(6)),
      unitPriceUsd: Number(unitPriceUsd.toFixed(2)),
      feeBps: this.TOTAL_FEE_BPS,
      feeUsd: Number(feeUsd.toFixed(2)),
      slippageBps: this.SLIPPAGE_BPS,
      minimumReceived: Number(minimumReceived.toFixed(6)),
      expiresAt: expiresAt.toISOString(),
      route: {
        provider: 'aurum',
        goldPrice: unitPriceUsd,
        timestamp: goldPrice.last_updated,
        platformFeeUsd,
        platformFeeWallet: this.PLATFORM_FEE_WALLET
      }
    };

    // Store quote in database
    await this.saveQuote(quote, userId);

    return quote;
  }

  private async saveQuote(quote: Quote, userId: string): Promise<void> {
    const { error } = await supabase
      .from('quotes')
      .insert({
        id: quote.id,
        user_id: userId,
        side: quote.side,
        input_asset: quote.inputAsset,
        output_asset: quote.outputAsset,
        input_amount: quote.inputAmount,
        output_amount: quote.outputAmount,
        grams: quote.grams,
        unit_price_usd: quote.unitPriceUsd,
        fee_bps: quote.feeBps,
        expires_at: quote.expiresAt,
        route: quote.route
      });

    if (error) {
      console.error('Failed to save quote:', error);
      // Don't throw error - quote can still be used even if not saved
    }
  }

  async getQuote(quoteId: string, userId: string): Promise<Quote | null> {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (now > expiresAt) {
      return null; // Quote expired
    }

    return {
      id: data.id,
      side: data.side as 'buy' | 'sell',
      inputAsset: data.input_asset,
      outputAsset: data.output_asset,
      inputAmount: Number(data.input_amount),
      outputAmount: Number(data.output_amount),
      grams: Number(data.grams),
      unitPriceUsd: Number(data.unit_price_usd),
      feeBps: data.fee_bps,
      feeUsd: (Number(data.input_amount) * data.fee_bps) / 10000,
      slippageBps: this.SLIPPAGE_BPS,
      minimumReceived: Number(data.output_amount) * (1 - this.SLIPPAGE_BPS / 10000),
      expiresAt: data.expires_at,
      route: data.route as Record<string, any>
    };
  }

  calculateGramsToUsd(grams: number, goldPricePerOz: number): number {
    const troyOunces = grams / this.GRAMS_PER_TROY_OUNCE;
    return troyOunces * goldPricePerOz;
  }

  calculateUsdToGrams(usd: number, goldPricePerOz: number): number {
    const troyOunces = usd / goldPricePerOz;
    return troyOunces * this.GRAMS_PER_TROY_OUNCE;
  }
}

export const quoteEngineService = new QuoteEngineService();