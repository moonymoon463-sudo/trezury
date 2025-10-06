-- ============================================
-- Phase 1: Dynamic Gas Management Migration (Fixed)
-- ============================================

-- Drop and recreate the view with the correct type
DROP VIEW IF EXISTS public.fee_analytics_summary;

CREATE VIEW public.fee_analytics_summary AS
SELECT 
  DATE(created_at) as date,
  output_asset,
  COUNT(*) as swap_count,
  SUM(total_fees_charged) as total_fees,
  AVG(platform_fee_amount) as avg_platform_fee,
  AVG(relay_fee_amount) as avg_relay_fee,
  AVG(gas_difference) as avg_gas_difference,
  MAX(ABS(gas_difference)) as max_gas_overage,
  COUNT(*) FILTER (WHERE exceeded_margin = true) as margin_exceeded_count
FROM public.fee_reconciliation_log
GROUP BY DATE(created_at), output_asset
ORDER BY date DESC, output_asset;

-- Update comments
COMMENT ON VIEW public.fee_analytics_summary IS 'Analytics view for fee tracking with dynamic margins';