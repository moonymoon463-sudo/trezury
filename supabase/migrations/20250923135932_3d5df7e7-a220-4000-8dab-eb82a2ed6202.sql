-- Drop all lending-related tables and functions

-- Drop triggers first
DROP TRIGGER IF EXISTS update_pool_statistics_supplies ON user_supplies;
DROP TRIGGER IF EXISTS update_pool_statistics_borrows ON user_borrows;
DROP TRIGGER IF EXISTS trigger_risk_alert_generation ON user_health_factors;

-- Drop tables with CASCADE to handle dependencies
DROP TABLE IF EXISTS liquidation_auctions CASCADE;
DROP TABLE IF EXISTS liquidation_calls CASCADE;
DROP TABLE IF EXISTS liquidation_thresholds CASCADE;
DROP TABLE IF EXISTS flash_loan_history CASCADE;
DROP TABLE IF EXISTS governance_rewards CASCADE;
DROP TABLE IF EXISTS risk_alerts CASCADE;
DROP TABLE IF EXISTS user_supplies CASCADE;
DROP TABLE IF EXISTS user_borrows CASCADE;
DROP TABLE IF EXISTS user_health_factors CASCADE;
DROP TABLE IF EXISTS pool_reserves CASCADE;
DROP TABLE IF EXISTS pool_stats CASCADE;
DROP TABLE IF EXISTS interest_rate_models CASCADE;
DROP TABLE IF EXISTS position_limits CASCADE;
DROP TABLE IF EXISTS advanced_position_limits CASCADE;
DROP TABLE IF EXISTS locks CASCADE;
DROP TABLE IF EXISTS payouts CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS lock_status CASCADE;

-- Drop lending-related functions
DROP FUNCTION IF EXISTS update_pool_statistics() CASCADE;
DROP FUNCTION IF EXISTS accrue_compound_interest() CASCADE;
DROP FUNCTION IF EXISTS distribute_governance_rewards() CASCADE;
DROP FUNCTION IF EXISTS check_liquidation_eligibility(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS generate_risk_alerts() CASCADE;
DROP FUNCTION IF EXISTS trigger_risk_alert_generation() CASCADE;