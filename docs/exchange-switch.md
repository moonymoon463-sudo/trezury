# dYdX to Synthetix Perps V3 Migration

## Executive Summary

The trading dashboard has been upgraded from **dYdX v4** to **Synthetix Perps V3**, enabling:
- **Up to 50× leverage** (market-dependent)
- **Native EVM wallet support** (no separate trading wallet required)
- **Multi-chain support** (Ethereum Mainnet, Base, Arbitrum)
- **Enhanced features**: Hourly funding, on-the-fly leverage adjustment, TP/SL orders

---

## Comparison Table

| Feature | dYdX v4 | Synthetix Perps V3 |
|---------|---------|-------------------|
| **Max Leverage** | 20× (BTC/ETH), 10× (alts) | **50×** (market-dependent) |
| **Funding Interval** | 8 hours | **1 hour** (more frequent) |
| **Wallet Type** | Separate Cosmos wallet (dydx1...) | **Same EVM wallet** (0x...) |
| **Networks** | dYdX Chain only | **Ethereum + Base + Arbitrum** |
| **Order Types** | Market, Limit, Stop | Market, Limit, TP/SL, Reduce-only |
| **Leverage Adjustment** | ❌ Must close/reopen | ✅ **Adjust on-the-fly** |
| **Fees** | Maker 0.02%, Taker 0.05% | Maker 0.02%, Taker 0.06% |
| **Oracle** | dYdX internal | **Pyth Network** (decentralized) |
| **Liquidation Buffer** | 3% maintenance margin | **Dynamic** (per market, ~3%) |
| **Gas Fees** | None (dYdX Chain) | **User pays** (ETH/ARB gas) |
| **Bridge Required** | Yes (Squid Router to dYdX Chain) | **No** (native EVM) |
| **Account Abstraction** | dYdX address | **Account ID** (bigint) |

---

## Key Behavioral Differences

### 1. **Funding Rate Accrual**
- **dYdX**: Funding paid/received every **8 hours** (larger amounts, less frequent)
- **Synthetix**: Funding accrues **hourly** (smaller amounts, 8× more frequent)
- **Impact**: Users will see funding updates more frequently but in smaller increments

### 2. **Leverage Adjustment**
- **dYdX**: Cannot modify leverage on existing positions (must close and reopen)
- **Synthetix**: Can adjust leverage dynamically without closing position
- **UI**: New "Adjust Leverage" button added to position management

### 3. **Wallet Management**
- **dYdX**: Required separate Cosmos wallet (dydx1...) with bridge deposits
- **Synthetix**: Uses **existing EVM wallets** directly (internal or external)
- **Migration**: No need to move funds between wallets—positions close on dYdX, open on Synthetix with same wallet

### 4. **Network Selection**
- **dYdX**: Single chain (dYdX Chain)
- **Synthetix**: Multi-chain (Ethereum, Base, Arbitrum)
- **Default**: **Base** (lowest fees, best V3 support)

### 5. **Gas Fees**
- **dYdX**: Gas-free (protocol-level abstraction)
- **Synthetix**: Users pay gas in ETH (or ARB on Arbitrum)
- **Mitigation**: Base has extremely low fees (~$0.01-$0.05 per trade)

### 6. **Liquidation Mechanics**
- **dYdX**: Fixed 3% maintenance margin buffer
- **Synthetix**: Dynamic per-market liquidation ratios
- **UI**: Real-time liquidation price shown with distance indicator

---

## Migration Impact

### For Users with Open dYdX Positions

**Status**: All open dYdX positions have been **closed automatically** as of the migration date.

**Next Steps**:
1. Verify closed positions in transaction history (marked "LEGACY")
2. Review realized PnL from closed positions
3. Funds remain in your **internal EVM wallet** (no action required)
4. Open new positions on Synthetix Perps when ready

### For Users with dYdX Deposits

**Status**: All dYdX Chain deposits have been **withdrawn to your internal wallet**.

**Next Steps**:
1. Check balance in Portfolio → Wallet
2. No need to bridge—funds are already on Ethereum/Base
3. Start trading immediately with existing balance

---

## New UI Features

### 1. **Wallet Source Toggle**
- **Internal Wallet**: Server-side signing (secure, no MetaMask needed)
- **External Wallet**: Connect MetaMask/WalletConnect for self-custody

### 2. **Network Switcher**
- **Base** (default): Lowest fees, best liquidity
- **Ethereum**: More expensive, higher security
- **Arbitrum**: Moderate fees, good liquidity

### 3. **Dynamic Leverage Slider**
- Range: **1×–50×**
- Auto-caps at market max (e.g., 25× for volatile assets)
- Tooltip explains cap reason (e.g., "Max 25× for this market")

### 4. **Hourly Funding Countdown**
- Shows time until next funding payment
- Historical funding chart available

### 5. **Enhanced Risk Indicators**
- **Distance to liquidation**: Percentage shown with color-coded bar
- **Margin ratio**: Visual health indicator
- **Recommended action**: E.g., "Add margin" or "Reduce position"

### 6. **Fee Breakdown**
- **Protocol Fee**: ~0.02% (maker) / 0.06% (taker)
- **Execution Fee**: $0.50–$2 for async orders (keepers)
- **Est. Gas**: Live gas estimate in USD

---

## Technical Changes

### Removed Components
- `dydxTradingService.ts`
- `dydxWalletService.ts`
- `DydxWalletSetup.tsx`
- `DepositModal.tsx` (dYdX-specific)
- All dYdX Edge Functions

### New Components
- `src/lib/snx/perpsClient.ts` – Synthetix Perps V3 client
- `src/services/snxTradingService.ts` – Trading service (internal + external wallets)
- `supabase/functions/snx-trade-executor/` – Server-side order execution
- `src/config/snxAddresses.ts` – Contract addresses per network
- `src/hooks/useSnxMarkets.tsx` – Market data hook
- `src/hooks/useSnxTrading.tsx` – Trading operations hook

### Database Changes
- **New tables**: `snx_accounts`, `snx_orders`, `snx_positions`
- **Legacy tables**: `dydx_wallets`, `dydx_orders`, `dydx_positions` (archived)

---

## Developer Runbook

### Local Development

1. **Install dependencies**:
   ```bash
   npm install @synthetixio/wei ethers@6.15.0 viem@2.x
   ```

2. **Set environment variables**:
   ```bash
   RPC_MAINNET=https://eth.llamarpc.com
   RPC_BASE=https://mainnet.base.org
   RPC_ARBITRUM=https://arb1.arbitrum.io/rpc
   
   FEATURE_INTERNAL_SNX_TRADING=true
   INTERNAL_TRADE_MAX_LEVERAGE=50
   INTERNAL_TRADE_MAX_NOTIONAL=100000
   ```

3. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy snx-trade-executor
   ```

4. **Test**:
   ```bash
   npm run test:e2e
   ```

### Production Deployment

1. **Feature Flags**:
   - Set `FEATURE_DYDX=false`
   - Set `FEATURE_SYNTHEX_PERPS=true`

2. **Monitor**:
   - Edge Function logs: Check `snx-trade-executor` for errors
   - Database: Watch `snx_orders` and `snx_positions` tables
   - User feedback: Track support tickets for migration issues

3. **Rollback Plan**:
   - Revert feature flags
   - Redeploy dYdX Edge Functions
   - Notify users of temporary reversion

---

## FAQ

**Q: Can I still access my old dYdX positions?**  
A: All dYdX positions were closed automatically. View transaction history for closed position details.

**Q: Do I need to create a new account?**  
A: No. Your existing EVM wallet is now your trading account.

**Q: Why are gas fees required now?**  
A: Synthetix operates on Ethereum-based chains (Base, Arbitrum). Gas fees are paid to validators. Use Base for lowest fees (~$0.01-$0.05 per trade).

**Q: Can I use higher leverage?**  
A: Yes, up to 50× depending on market. Most major markets support 50×.

**Q: What happened to my dYdX wallet?**  
A: It's no longer needed. Funds were withdrawn to your EVM wallet during migration.

**Q: How do I switch networks?**  
A: Use the network selector in the trading dashboard. Base is recommended for lowest fees.

**Q: Can I use MetaMask instead of the internal wallet?**  
A: Yes! Toggle "Wallet Source" to "External" and connect your MetaMask.

---

## Support

For migration issues, contact support at:
- **Email**: support@trezury.com
- **Discord**: [Trezury Community](https://discord.gg/trezury)
- **In-app**: Settings → Support

---

**Last Updated**: 2025-01-28  
**Version**: Synthetix Perps V3 (Base Andromeda)
