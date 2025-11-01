# 01 Protocol Trading Integration

Production-ready integration with 01 Protocol (Solana perpetuals DEX).

## Architecture

```
Frontend (React)
    ↓
Trading Service (tradingService.ts)
    ↓
Supabase Edge Function (01-trade)
    ↓
Wallet Decryption (server-side only)
    ↓
01 Protocol SDK (zo-sdk)
    ↓
Solana Blockchain
```

## Security Model

✅ **What's Secure:**
- Private keys encrypted in database (AES-GCM-256)
- Wallet decryption happens only in edge functions
- Password never stored or logged
- All trades logged for audit trail
- RLS policies protect user data

❌ **Never Do:**
- Don't decrypt wallet client-side
- Don't log private keys or passwords
- Don't expose raw errors to UI
- Don't skip password validation

## Usage Examples

### Basic Trading

```typescript
import { use01Trading } from '@/hooks/use01Trading';

function MyComponent() {
  const { placeOrder, loading, error } = use01Trading();

  const handleTrade = async () => {
    const result = await placeOrder(
      {
        market: 'SOL-PERP',
        side: 'long',
        size: 1.5,
        orderType: 'market',
        leverage: 10,
      },
      userPassword // From secure input
    );

    if (result.ok) {
      console.log('Trade successful:', result.data);
    }
  };
}
```

### Close Position

```typescript
const { closePosition } = use01Trading();

await closePosition(
  { market: 'SOL-PERP', size: 1.5 },
  password
);
```

### Cancel Order

```typescript
const { cancelOrder } = use01Trading();

await cancelOrder(
  { orderId: '01_123456', market: 'SOL-PERP' },
  password
);
```

### Fetch Positions

```typescript
const { fetchPositions } = use01Trading();

const result = await fetchPositions(password);
if (result.ok) {
  console.log('Positions:', result.data.positions);
}
```

## Error Handling

All operations return a consistent response format:

```typescript
interface TradeResult {
  ok: boolean;           // Success/failure
  message: string;       // User-friendly message
  data?: any;           // Result data if successful
  error?: string;       // Error code if failed
}
```

### Common Error Codes

- `UNAUTHORIZED` - Missing or invalid authentication
- `WALLET_NOT_FOUND` - User has no Solana wallet
- `WALLET_DECRYPTION_FAILED` - Invalid password
- `INSUFFICIENT_SOL` - Not enough SOL for tx fees
- `MISSING_PARAMETERS` - Invalid request
- `INVALID_OPERATION` - Unknown operation type

## Development vs Production

The edge function detects environment:

```typescript
const isDev = Deno.env.get("ENV") !== "production";
```

**Dev Mode (Lovable):**
- Always returns 200 status
- Returns errors in JSON body
- Prevents UI crashes

**Production Mode:**
- Returns proper HTTP status codes (4xx/5xx)
- Production logging
- Rate limiting enabled

## Database Schema

### `solana_wallets`
Stores encrypted user wallets:
- `user_id` - User reference
- `public_key` - Solana public key (base58)
- `encrypted_private_key` - AES-GCM encrypted
- `encryption_salt` - PBKDF2 salt
- `encryption_iv` - AES initialization vector

### `trade_logs`
Audit trail for all trades:
- `user_id` - Who traded
- `operation` - place_order, close_position, etc.
- `market` - Trading pair
- `side` - long/short
- `size` - Position size
- `status` - success/failure
- `result` - Full response data

## Edge Function Configuration

Located at: `supabase/functions/01-trade/index.ts`

**Environment Variables:**
- `ENV` - "production" or "development"
- `SUPABASE_URL` - Auto-injected
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-injected

**Operations:**
- `place_order` - Execute new order
- `close_position` - Close existing position
- `cancel_order` - Cancel pending order
- `get_positions` - Fetch user positions

## Testing

Example test component included:
`src/components/trading/O1TradingPanel.tsx`

To test:
1. Ensure user is authenticated
2. User needs Solana wallet (auto-created on first use)
3. Enter wallet password
4. Select market and parameters
5. Place order

## Monitoring

View trade logs:
```sql
SELECT * FROM trade_logs 
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 50;
```

View edge function logs:
- Supabase Dashboard → Edge Functions → 01-trade → Logs

## Next Steps (Phase 3)

- [ ] WebSocket real-time market data
- [ ] Order book visualization
- [ ] Live positions table
- [ ] Chart integration with TradingView
- [ ] Advanced order types (stop-loss, take-profit)
- [ ] Position management UI
- [ ] Trade history visualization

## Support

For issues or questions about this integration, check:
- Edge function logs for server-side errors
- Browser console for client-side errors
- `trade_logs` table for audit trail
