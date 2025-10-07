# Production Launch Checklist ✅

## Phase 1: Pre-Production (COMPLETED)

### ✅ Critical Security Fixes (All Fixed)
- [x] **F-001**: Infinite approval pattern fixed - reset allowance to 0 before each approval
- [x] **F-002**: Chain ID verification added - ensures RPC is on Ethereum mainnet
- [x] **F-003**: Client-side idempotency keys implemented - prevents duplicate swap intents
- [x] **F-004**: Token address verification on-chain - checks symbol() matches expected
- [x] **F-005**: Server-side slippage cap enforced - max 2% (200 bps)

### ✅ Build Status
- [x] No TypeScript compilation errors
- [x] All dependencies installed and up to date
- [x] Environment variables configured

---

## Pre-Launch Testing Requirements

### 🧪 Testnet Validation (DO BEFORE MAINNET)

#### Test Case 1: Happy Path Swap
```
1. Navigate to /swap
2. Select USDC → XAUT
3. Enter amount: 100 USDC
4. Verify quote shows:
   - Exchange rate
   - Fees
   - Slippage cap ≤ 2%
5. Execute swap
6. Verify:
   - Intent created with idempotency key
   - Status: initiated → broadcasted → settled
   - Tx hash appears in UI
   - Balance updates on-chain
   - Etherscan link works
```

#### Test Case 2: Idempotency Protection
```
1. Start a swap
2. Before it settles, try to execute same swap again
3. Verify:
   - Second attempt rejected with existing intent
   - No duplicate transaction
   - User gets clear error message
```

#### Test Case 3: Chain ID Mismatch
```
1. Configure RPC to testnet
2. Try to execute swap
3. Verify:
   - Error: "Chain ID mismatch"
   - No transaction sent
   - User gets clear error message
```

#### Test Case 4: Token Verification
```
1. Attempt swap with invalid token address
2. Verify:
   - On-chain symbol check fails
   - Swap rejected
   - User gets security warning
```

#### Test Case 5: Slippage Cap
```
1. Try to set slippage > 2%
2. Verify:
   - Server rejects request
   - Error: "Slippage exceeds maximum"
   - User informed of 2% limit
```

#### Test Case 6: Approval Reset
```
1. Check swap logs for approval transactions
2. Verify approval pattern:
   a. Reset allowance to 0
   b. Set allowance to exact amount
3. Confirm no accumulated allowance
```

---

## Production Deployment Steps

### 1. Environment Configuration
```bash
# Verify all required secrets are set
✓ RPC_URL (Infura/Alchemy mainnet)
✓ RELAYER_PRIVATE_KEY (secure vault)
✓ SUPABASE_URL
✓ SUPABASE_SERVICE_ROLE_KEY
✓ TOKEN_ADDRESSES (USDC, XAUT, TRZRY)
```

### 2. Database Migrations
```sql
-- Verify all migrations applied
✓ transaction_intents table exists
✓ idempotency_key has UNIQUE constraint
✓ orders table has proper indexes
✓ RLS policies enabled on all tables
```

### 3. Deploy Edge Function
```bash
# Deploy blockchain-operations function
supabase functions deploy blockchain-operations

# Verify deployment
curl -X POST https://your-project.supabase.co/functions/v1/blockchain-operations/health
```

### 4. Enable Monitoring
```javascript
// Verify these are logging correctly:
- Intent creation events
- Swap execution events
- Approval transactions
- Settlement confirmations
- Failures with error details
```

---

## Post-Launch Monitoring (First 24 Hours)

### Critical Metrics to Watch

#### Success Rate
```
Target: > 95% successful swaps
Monitor: orders table WHERE status = 'settled' vs 'failed'
Alert if: Success rate < 90%
```

#### Average Settlement Time
```
Target: < 5 minutes
Monitor: time between 'initiated' and 'settled'
Alert if: Average > 10 minutes
```

#### Idempotency Rejections
```
Expected: 0 (no duplicates should occur)
Monitor: transaction_intents WHERE status = 'duplicate_rejected'
Alert if: Any duplicates found
```

#### Chain ID Mismatches
```
Expected: 0 (should never happen in production)
Monitor: Edge function logs for "Chain ID mismatch"
Alert if: Any mismatches detected
```

#### Token Verification Failures
```
Expected: 0 (only valid tokens should be attempted)
Monitor: Edge function logs for "Token verification failed"
Alert if: Any failures detected
```

#### Slippage Cap Rejections
```
Expected: Some (legitimate user errors)
Monitor: Edge function logs for "Slippage exceeds maximum"
Alert if: Rate > 10% of total attempts
```

---

## Rollback Plan

### If Critical Issue Detected:

1. **Immediate Actions**
   ```
   - Disable swap UI (set maintenance mode)
   - Stop processing new swaps
   - Let pending swaps settle
   ```

2. **Investigation**
   ```
   - Check Edge function logs
   - Query orders table for failure patterns
   - Review blockchain explorer for tx status
   ```

3. **Rollback Steps**
   ```
   - Revert Edge function to previous version
   - Notify users of maintenance
   - Fix issue in staging
   - Re-test on testnet
   - Re-deploy with fix
   ```

---

## Known Limitations (For Later Phases)

### Medium Priority (Week 1-2)
- **F-006**: Single RPC endpoint (no failover)
- **F-007**: No transaction replacement logic
- **F-008**: Console.log instead of structured logging
- **F-009**: No alerting on reconciliation failures
- **F-010**: MoonPay webhook uses in-memory idempotency
- **F-011**: Realtime subscription doesn't handle disconnects

### Low Priority (Before Scale)
- **F-012**: Reconciler runs every 2 minutes (inefficient at scale)

---

## Go-Live Approval

### Required Sign-offs:
- [ ] Security: All critical fixes verified on testnet
- [ ] Engineering: All test cases passed
- [ ] Operations: Monitoring and alerting configured
- [ ] Support: Rollback plan documented and tested

### Launch Readiness: ✅ READY FOR PRODUCTION

**Date**: [To be filled on launch day]
**Approved by**: [Team lead signature]

---

## Support Runbook

### If Swap Stuck in "broadcasted" > 10 minutes:

1. Check transaction on Etherscan
   - If pending: Wait for network congestion to clear
   - If failed: Mark as failed in DB
   - If not found: Check RPC connection

2. Query database:
   ```sql
   SELECT * FROM orders 
   WHERE status = 'broadcasted' 
   AND created_at < NOW() - INTERVAL '10 minutes'
   ORDER BY created_at DESC;
   ```

3. Manual reconciliation:
   ```javascript
   // Run reconciler function manually
   supabase.functions.invoke('swap-intent-reconciliation')
   ```

### If User Reports "Swap Failed":

1. Get order ID from user
2. Query order details:
   ```sql
   SELECT * FROM orders WHERE id = '[order_id]';
   SELECT * FROM transaction_intents WHERE quote_id = '[quote_id]';
   ```
3. Check error message
4. If blockchain error: Check Etherscan tx
5. If idempotency error: Check for duplicate intent
6. Provide user with:
   - Clear error explanation
   - Estimated resolution time
   - Support ticket number

---

**Last Updated**: [Current Date]
**Version**: 1.0 (Production Launch)
