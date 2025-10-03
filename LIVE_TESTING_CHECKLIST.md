# Live Testing Checklist - Pre-Launch Validation

**Project:** Aurum DeFi Platform  
**Testing Phase:** Pre-Production Readiness  
**Date:** _____________  
**Tester:** _____________

---

## Executive Summary

This checklist validates critical functionality before allowing real users on the platform. Complete ALL sections marked as "Critical" before soft launch.

**Testing Priority Levels:**
- 🔴 **Critical** - Must pass before any user access
- 🟡 **High** - Should pass before soft launch
- 🟢 **Medium** - Can be addressed during soft launch

**Estimated Time:** 4-5 hours for full checklist

---

## 1. Authentication & Authorization Testing (Critical 🔴)

### 1.1 Admin Authorization
**Expected Time:** 15 minutes

- [ ] **Test 1.1.1:** Hit `https://auntkvllzejtfqmousxg.supabase.co/functions/v1/admin-dashboard` with no token
  - **Expected:** HTTP 401 with `"Unauthorized - Missing token"`
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 1.1.2:** Hit admin endpoint with non-admin user token
  - **Steps:**
    1. Log in as regular user
    2. Copy JWT from browser DevTools → Application → Local Storage → `supabase.auth.token`
    3. Call: `curl -H "Authorization: Bearer <TOKEN>" https://auntkvllzejtfqmousxg.supabase.co/functions/v1/admin-dashboard`
  - **Expected:** HTTP 403 with `"Forbidden - Admin access required"`
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 1.1.3:** Hit admin endpoint with admin user token
  - **Expected:** HTTP 200 with valid dashboard data
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

### 1.2 Session Management
**Expected Time:** 10 minutes

- [ ] **Test 1.2.1:** Admin session timeout (15 min inactivity)
  - **Steps:**
    1. Log in as admin
    2. Wait 16 minutes without interaction
    3. Try to access admin page
  - **Expected:** Redirect to login
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 1.2.2:** JWT token refresh
  - **Expected:** Token auto-refreshes before expiry
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

---

## 2. MoonPay Integration Testing (Critical 🔴)

### 2.1 KYC Flow
**Expected Time:** 30 minutes

- [ ] **Test 2.1.1:** New user KYC initiation
  - **Steps:**
    1. Create fresh test user account
    2. Navigate to `/kyc-verification`
    3. Click "Start KYC Verification"
  - **Expected:** MoonPay widget loads, `profiles.kyc_status` = 'pending'
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 2.1.2:** KYC submission & webhook
  - **Steps:**
    1. Complete KYC in MoonPay (use test credentials)
    2. Wait for webhook
    3. Check `profiles` table
  - **Expected:** `kyc_status` = 'verified', `kyc_verified_at` timestamp set
  - **Actual:** _____________
  - **Webhook Received:** Yes / No
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 2.1.3:** KYC status reflection in UI
  - **Expected:** Green badge shows "Verified" on settings page
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

### 2.2 MoonPay Buy Flow (Happy Path)
**Expected Time:** 45 minutes

- [ ] **Test 2.2.1:** User wallet generation
  - **Steps:**
    1. Log in as verified user
    2. Navigate to portfolio
    3. Check `onchain_addresses` table
  - **Expected:** User has wallet address, `created_with_password` = true
  - **Actual Address:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 2.2.2:** MoonPay purchase initiation
  - **Steps:**
    1. Click "Add Funds" → "Buy with Card"
    2. Enter amount: $50 USDC
    3. Click "Continue"
  - **Expected:** 
    - MoonPay widget loads
    - `externalCustomerId` = user's UUID
    - `walletAddress` = user's wallet from `onchain_addresses`
    - `payment_transactions` record created with `status` = 'pending'
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 2.2.3:** Purchase completion & crypto delivery
  - **Steps:**
    1. Complete payment in MoonPay (use test card)
    2. Wait 2-5 minutes
    3. Check blockchain explorer: `https://etherscan.io/address/<USER_WALLET>`
  - **Expected:** USDC appears in wallet on-chain
  - **Actual Balance:** _____________ USDC
  - **Tx Hash:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 2.2.4:** Webhook processing & DB updates
  - **Steps:**
    1. Check `moonpay_webhooks` table for `transaction_updated` event
    2. Verify `payment_transactions.status` = 'completed'
    3. Check `balance_snapshots` for USDC amount
    4. Check `transactions` table for buy record
  - **Expected:** All tables updated correctly
  - **Actual:** 
    - Webhook received: Yes / No
    - Payment transaction status: _____________
    - Balance snapshot amount: _____________
    - Transaction record created: Yes / No
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 2.2.5:** UI reflects purchase
  - **Steps:**
    1. Navigate to Portfolio page
    2. Check USDC balance display
  - **Expected:** UI shows correct USDC balance
  - **Actual Balance:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 2.2.6:** Notification sent
  - **Expected:** User receives notification "Crypto purchase completed"
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

### 2.3 MoonPay Error Scenarios
**Expected Time:** 30 minutes

- [ ] **Test 2.3.1:** Webhook timeout simulation
  - **Steps:**
    1. Use `moonpay-diagnostics` to simulate slow webhook
    2. Check `webhook_dlq` table after 3 retries
  - **Expected:** Failed webhook inserted into DLQ with retry_count = 3
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 2.3.2:** Webhook signature validation failure
  - **Steps:**
    1. Send test webhook with invalid signature
  - **Expected:** HTTP 401, webhook rejected, logged in `security_alerts`
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 2.3.3:** Duplicate webhook (idempotency)
  - **Steps:**
    1. Replay same webhook twice within 24 hours
  - **Expected:** Second request returns `"already_processed"`, no duplicate DB entries
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

---

## 3. Webhook Dead Letter Queue (High 🟡)

### 3.1 DLQ Management
**Expected Time:** 20 minutes

- [ ] **Test 3.1.1:** Failed webhook enters DLQ
  - **Expected:** Entry appears in `webhook_dlq` with status 'pending'
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 3.1.2:** Admin DLQ view
  - **Steps:**
    1. Navigate to `/admin/webhooks`
    2. Click "Failed Webhooks (DLQ)" tab
  - **Expected:** Failed webhooks listed with replay button
  - **Actual Count:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 3.1.3:** Manual webhook replay
  - **Steps:**
    1. Click "Replay" on DLQ entry
    2. Check `webhook_dlq.replay_status`
  - **Expected:** Status changes to 'completed', payment processed successfully
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

---

## 4. Blockchain Balance Reconciliation (Critical 🔴)

### 4.1 Balance Verification
**Expected Time:** 60 minutes

- [ ] **Test 4.1.1:** Hourly cron job setup
  - **Steps:**
    1. Check cron job status: `SELECT * FROM cron.job WHERE jobname = 'balance-verification-hourly'`
  - **Expected:** Job active, schedule = '5 * * * *'
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 4.1.2:** Manual balance verification
  - **Steps:**
    1. Trigger manually via Supabase Functions
    2. Check edge function logs
  - **Expected:** Function completes, logs show "Balance verification complete"
  - **Actual:** _____________
  - **Checked Wallets:** _____________
  - **Mismatches Found:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 4.1.3:** Balance mismatch detection
  - **Steps:**
    1. User sends USDC out of wallet via MetaMask
    2. Wait for next hourly check (or trigger manually)
    3. Check `balance_reconciliations` table
  - **Expected:** 
    - Entry created with difference
    - `security_alert` created with severity 'medium' or 'high'
    - Status = 'pending_review'
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 4.1.4:** On-chain balance query accuracy
  - **Steps:**
    1. Check user balance via Etherscan
    2. Compare with `blockchain-operations` function result
  - **Expected:** Balances match within 0.000001 USDC
  - **Etherscan Balance:** _____________
  - **Function Result:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 4.1.5:** Reconciliation UI (Admin)
  - **Steps:**
    1. Navigate to Admin Dashboard
    2. Check for balance reconciliation widget
  - **Expected:** Shows pending reconciliations with review button
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

---

## 5. Transaction Limits & Velocity (High 🟡)

### 5.1 Velocity Limits
**Expected Time:** 30 minutes

- [ ] **Test 5.1.1:** Hourly transaction limit
  - **Steps:**
    1. User attempts 11 transactions within 1 hour
  - **Expected:** 11th transaction blocked, `security_alert` created
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 5.1.2:** Daily transaction limit
  - **Steps:**
    1. Check `user_transaction_limits` for user's tier
    2. Attempt to exceed daily limit
  - **Expected:** Transaction blocked with clear error message
  - **Actual Limit:** _____________
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 5.1.3:** Single transaction amount limit
  - **Steps:**
    1. Standard tier user attempts $15,000 transaction
  - **Expected:** Blocked, limit is $10,000 for standard
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 5.1.4:** Monthly cumulative limit
  - **Expected:** Enforced at $50,000 for standard tier
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

### 5.2 Auto-Approval Thresholds
**Expected Time:** 15 minutes

- [ ] **Test 5.2.1:** Transaction under auto-approval limit
  - **Steps:**
    1. Execute $5,000 transaction
  - **Expected:** Auto-approved, no confirmation required
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 5.2.2:** Transaction above confirmation threshold
  - **Steps:**
    1. Execute $12,000 transaction
  - **Expected:** Confirmation popup appears, transaction pending approval
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

---

## 6. Security Testing (Critical 🔴)

### 6.1 Row-Level Security (RLS)
**Expected Time:** 45 minutes

- [ ] **Test 6.1.1:** User A cannot access User B's data
  - **Steps:**
    1. Log in as User A
    2. Try to query User B's `balance_snapshots` via Supabase client
  - **Expected:** Returns empty array or RLS error
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 6.1.2:** Profiles table PII protection
  - **Steps:**
    1. User queries `profiles` table
    2. Check if rate limit enforced (50 accesses/minute)
  - **Expected:** After 51st access, blocked with security alert
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 6.1.3:** Encrypted wallet keys isolation
  - **Steps:**
    1. User A tries to query `encrypted_wallet_keys` for User B
  - **Expected:** Blocked by RLS, returns nothing
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

### 6.2 Audit Logging
**Expected Time:** 20 minutes

- [ ] **Test 6.2.1:** Sensitive PII access logged
  - **Steps:**
    1. Admin accesses user's SSN or DOB
    2. Check `audit_log` table
  - **Expected:** Entry with operation = 'SENSITIVE_PII_UPDATE', sensitive_fields array populated
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 6.2.2:** High-value transaction logged
  - **Steps:**
    1. Execute $9,000 transaction
    2. Check `audit_log`
  - **Expected:** Entry with risk_level = 5
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 6.2.3:** Failed login attempts tracked
  - **Steps:**
    1. Attempt 3 failed logins with wrong password
    2. Check `auth_attempts` table
  - **Expected:** 3 entries with success = false
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

### 6.3 Encryption
**Expected Time:** 15 minutes

- [ ] **Test 6.3.1:** Wallet private key encryption
  - **Steps:**
    1. Check `encrypted_wallet_keys` table directly in SQL editor
  - **Expected:** `encrypted_private_key` is ciphertext (not readable), IV and salt present
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 6.3.2:** Password-based key derivation
  - **Steps:**
    1. User creates wallet with password
    2. Check `secure_wallet_metadata.kdf_iterations`
  - **Expected:** >= 100,000 iterations
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

---

## 7. Performance & Monitoring (Medium 🟢)

### 7.1 API Response Times
**Expected Time:** 20 minutes

- [ ] **Test 7.1.1:** Portfolio page load time
  - **Expected:** < 2 seconds
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 7.1.2:** Transaction submission
  - **Expected:** < 5 seconds
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 7.1.3:** Blockchain balance query
  - **Expected:** < 3 seconds
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

### 7.2 Edge Function Health
**Expected Time:** 15 minutes

- [ ] **Test 7.2.1:** `moonpay-webhook` function logs
  - **Expected:** No errors in last 24 hours, avg processing time < 500ms
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 7.2.2:** `blockchain-operations` function
  - **Expected:** No errors, successful balance queries
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 7.2.3:** `verify-balances` cron execution
  - **Expected:** Runs every hour, no errors
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

### 7.3 Monitoring Alerts
**Expected Time:** 15 minutes

- [ ] **Test 7.3.1:** Security alert generation
  - **Expected:** Visible in `/admin/alerts`, shows severity/type
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 7.3.2:** Real-time security events
  - **Expected:** Logged in `real_time_security_events`, resolved flag works
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

---

## 8. User Experience Flow (Medium 🟢)

### 8.1 New User Onboarding
**Expected Time:** 30 minutes

- [ ] **Test 8.1.1:** Sign up → KYC → First purchase
  - **Full Flow:**
    1. Create account
    2. Verify email
    3. Complete KYC
    4. Add payment method
    5. Buy $100 USDC
    6. See balance in portfolio
  - **Expected:** Smooth flow, no errors, all steps tracked
  - **Actual:** _____________
  - **Time Taken:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 8.1.2:** Mobile responsiveness
  - **Expected:** All pages responsive on 375px width
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

---

## 9. Edge Cases & Error Handling (High 🟡)

### 9.1 Network Failures
**Expected Time:** 30 minutes

- [ ] **Test 9.1.1:** Blockchain RPC timeout
  - **Expected:** Graceful error message, retry logic works
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 9.1.2:** Supabase connection loss
  - **Expected:** User sees "Connection lost" message, auto-reconnects
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

### 9.2 Invalid Data Handling
**Expected Time:** 20 minutes

- [ ] **Test 9.2.1:** Invalid wallet address
  - **Expected:** Validation error before submission
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 9.2.2:** Negative transaction amount
  - **Expected:** Blocked at form validation
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

---

## 10. Final Sanity Checks (Critical 🔴)

### 10.1 Environment Variables
**Expected Time:** 10 minutes

- [ ] **Test 10.1.1:** All secrets configured
  - **Check in Supabase Dashboard → Edge Functions → Secrets:**
    - `MOONPAY_SECRET_KEY` (format: `sk_live_...` or `sk_test_...`)
    - `MOONPAY_WEBHOOK_SECRET`
    - `INFURA_API_KEY`
    - Any other required secrets
  - **Expected:** All present and valid format
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 10.1.2:** Hardcoded URLs removed
  - **Expected:** No `http://localhost` in production code
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

### 10.2 Database State
**Expected Time:** 10 minutes

- [ ] **Test 10.2.1:** Test data cleanup
  - **Expected:** No test users/transactions in production DB
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

- [ ] **Test 10.2.2:** RLS enabled on all tables
  - **Query:** `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;`
  - **Expected:** Only system tables (e.g., `config`) without RLS
  - **Actual:** _____________
  - **Status:** ✅ Pass / ❌ Fail

---

## Summary & Sign-Off

### Test Results
- **Total Tests:** _____
- **Passed:** _____
- **Failed:** _____
- **Skipped:** _____

### Critical Issues Found
1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

### Recommendations Before Launch
- [ ] All Critical (🔴) tests passed
- [ ] Balance reconciliation verified working
- [ ] Webhook DLQ functional
- [ ] Admin authorization secure
- [ ] MoonPay happy path tested end-to-end

### Sign-Off
- **Tested By:** _____________
- **Date:** _____________
- **Status:** ✅ Ready for Soft Launch / ❌ Needs Fixes
- **Notes:** _____________________________________________

---

## Appendix: Quick Reference

### Useful SQL Queries
```sql
-- Check recent webhooks
SELECT * FROM moonpay_webhooks ORDER BY received_at DESC LIMIT 10;

-- Check DLQ entries
SELECT * FROM webhook_dlq WHERE replay_status = 'pending';

-- Check balance mismatches
SELECT * FROM balance_reconciliations WHERE status = 'pending_review';

-- Check security alerts
SELECT * FROM security_alerts WHERE resolved = false ORDER BY created_at DESC;

-- Verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies WHERE schemaname = 'public';
```

### Useful Edge Function URLs
- **Verify Balances:** `https://auntkvllzejtfqmousxg.supabase.co/functions/v1/verify-balances`
- **Admin Dashboard:** `https://auntkvllzejtfqmousxg.supabase.co/functions/v1/admin-dashboard`
- **MoonPay Webhook:** `https://auntkvllzejtfqmousxg.supabase.co/functions/v1/moonpay-webhook`

### Contact for Issues
- **Technical Lead:** _____________
- **Security Contact:** _____________
- **MoonPay Support:** support@moonpay.com
