export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_mfa_status: {
        Row: {
          created_at: string
          mfa_enabled: boolean
          mfa_verified_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          mfa_enabled?: boolean
          mfa_verified_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          mfa_enabled?: boolean
          mfa_verified_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_analysis_cache: {
        Row: {
          analysis: string
          analysis_type: string
          created_at: string
          id: string
          portfolio_snapshot: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis: string
          analysis_type: string
          created_at?: string
          id?: string
          portfolio_snapshot?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: string
          analysis_type?: string
          created_at?: string
          id?: string
          portfolio_snapshot?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      airdrop_allocations: {
        Row: {
          airdrop_period_id: string
          allocation_percentage: number
          created_at: string
          distributed_at: string | null
          id: string
          points_snapshot: number
          status: string
          transaction_hash: string | null
          trzry_amount: number
          user_id: string
        }
        Insert: {
          airdrop_period_id: string
          allocation_percentage: number
          created_at?: string
          distributed_at?: string | null
          id?: string
          points_snapshot: number
          status?: string
          transaction_hash?: string | null
          trzry_amount: number
          user_id: string
        }
        Update: {
          airdrop_period_id?: string
          allocation_percentage?: number
          created_at?: string
          distributed_at?: string | null
          id?: string
          points_snapshot?: number
          status?: string
          transaction_hash?: string | null
          trzry_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "airdrop_allocations_airdrop_period_id_fkey"
            columns: ["airdrop_period_id"]
            isOneToOne: false
            referencedRelation: "airdrop_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      airdrop_periods: {
        Row: {
          created_at: string
          distribution_date: string | null
          end_date: string
          id: string
          metadata: Json | null
          period_name: string
          points_multiplier: number
          start_date: string
          status: string
          total_pool_size: number
        }
        Insert: {
          created_at?: string
          distribution_date?: string | null
          end_date: string
          id?: string
          metadata?: Json | null
          period_name: string
          points_multiplier?: number
          start_date: string
          status?: string
          total_pool_size: number
        }
        Update: {
          created_at?: string
          distribution_date?: string | null
          end_date?: string
          id?: string
          metadata?: Json | null
          period_name?: string
          points_multiplier?: number
          start_date?: string
          status?: string
          total_pool_size?: number
        }
        Relationships: []
      }
      api_downtime_log: {
        Row: {
          detected_at: string
          duration_seconds: number | null
          error_details: Json | null
          error_message: string | null
          id: string
          provider: string
          resolved_at: string | null
        }
        Insert: {
          detected_at?: string
          duration_seconds?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          provider: string
          resolved_at?: string | null
        }
        Update: {
          detected_at?: string
          duration_seconds?: number | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          provider?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          blocked_until: string | null
          created_at: string | null
          endpoint: string
          id: string
          identifier: string
          last_request: string | null
          request_count: number | null
          updated_at: string | null
          window_start: string | null
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string | null
          endpoint: string
          id?: string
          identifier: string
          last_request?: string | null
          request_count?: number | null
          updated_at?: string | null
          window_start?: string | null
        }
        Update: {
          blocked_until?: string | null
          created_at?: string | null
          endpoint?: string
          id?: string
          identifier?: string
          last_request?: string | null
          request_count?: number | null
          updated_at?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          ip_address: unknown
          metadata: Json | null
          operation: string
          sensitive_fields: string[] | null
          table_name: string
          timestamp: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          operation: string
          sensitive_fields?: string[] | null
          table_name: string
          timestamp?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          operation?: string
          sensitive_fields?: string[] | null
          table_name?: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      auth_attempts: {
        Row: {
          attempted_at: string | null
          email: string
          id: string
          ip_address: unknown
          metadata: Json | null
          success: boolean | null
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string | null
          email: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          success?: boolean | null
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string | null
          email?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          success?: boolean | null
          user_agent?: string | null
        }
        Relationships: []
      }
      balance_change_alerts: {
        Row: {
          alert_severity: string
          balance_snapshot: Json
          created_at: string
          current_total: number
          id: string
          percent_change: number
          previous_total: number
          user_id: string
        }
        Insert: {
          alert_severity: string
          balance_snapshot: Json
          created_at?: string
          current_total: number
          id?: string
          percent_change: number
          previous_total: number
          user_id: string
        }
        Update: {
          alert_severity?: string
          balance_snapshot?: Json
          created_at?: string
          current_total?: number
          id?: string
          percent_change?: number
          previous_total?: number
          user_id?: string
        }
        Relationships: []
      }
      balance_reconciliations: {
        Row: {
          address: string
          asset: string
          chain_balance: number
          created_at: string
          db_balance: number
          detected_at: string
          difference: number
          id: string
          metadata: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          asset: string
          chain_balance: number
          created_at?: string
          db_balance: number
          detected_at?: string
          difference: number
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          asset?: string
          chain_balance?: number
          created_at?: string
          db_balance?: number
          detected_at?: string
          difference?: number
          id?: string
          metadata?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      balance_snapshots: {
        Row: {
          amount: number
          asset: string
          id: string
          snapshot_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          asset: string
          id?: string
          snapshot_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asset?: string
          id?: string
          snapshot_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "balance_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "balance_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_transactions: {
        Row: {
          amount: number
          bridge_provider: string
          created_at: string
          destination_chain: string
          destination_tx_hash: string | null
          estimated_completion: string | null
          id: string
          metadata: Json | null
          source_chain: string
          source_tx_hash: string | null
          status: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bridge_provider: string
          created_at?: string
          destination_chain: string
          destination_tx_hash?: string | null
          estimated_completion?: string | null
          id?: string
          metadata?: Json | null
          source_chain: string
          source_tx_hash?: string | null
          status?: string
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bridge_provider?: string
          created_at?: string
          destination_chain?: string
          destination_tx_hash?: string | null
          estimated_completion?: string | null
          id?: string
          metadata?: Json | null
          source_chain?: string
          source_tx_hash?: string | null
          status?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          context_type: string | null
          created_at: string
          id: string
          portfolio_snapshot: Json | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_type?: string | null
          created_at?: string
          id?: string
          portfolio_snapshot?: Json | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_type?: string | null
          created_at?: string
          id?: string
          portfolio_snapshot?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_reports: {
        Row: {
          compliance_checks: Json | null
          created_at: string
          download_url: string | null
          fees_usd: number | null
          generated_at: string
          id: string
          institutional_account_id: string
          period_end: string
          period_start: string
          risk_metrics: Json | null
          transactions_count: number | null
          type: string
          updated_at: string
          volume_usd: number | null
        }
        Insert: {
          compliance_checks?: Json | null
          created_at?: string
          download_url?: string | null
          fees_usd?: number | null
          generated_at?: string
          id?: string
          institutional_account_id: string
          period_end: string
          period_start: string
          risk_metrics?: Json | null
          transactions_count?: number | null
          type: string
          updated_at?: string
          volume_usd?: number | null
        }
        Update: {
          compliance_checks?: Json | null
          created_at?: string
          download_url?: string | null
          fees_usd?: number | null
          generated_at?: string
          id?: string
          institutional_account_id?: string
          period_end?: string
          period_start?: string
          risk_metrics?: Json | null
          transactions_count?: number | null
          type?: string
          updated_at?: string
          volume_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_reports_institutional_account_id_fkey"
            columns: ["institutional_account_id"]
            isOneToOne: false
            referencedRelation: "institutional_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      deployed_contracts: {
        Row: {
          chain: string
          contracts: Json
          created_at: string | null
          deployed_at: string
          deployer_address: string
          id: string
          metadata: Json | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          chain: string
          contracts?: Json
          created_at?: string | null
          deployed_at?: string
          deployer_address: string
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          chain?: string
          contracts?: Json
          created_at?: string | null
          deployed_at?: string
          deployer_address?: string
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      deployment_logs: {
        Row: {
          chain: string
          created_at: string
          deployment_id: string
          details: Json | null
          error_data: Json | null
          id: string
          level: string
          message: string
          operation: string
        }
        Insert: {
          chain: string
          created_at?: string
          deployment_id?: string
          details?: Json | null
          error_data?: Json | null
          id?: string
          level?: string
          message: string
          operation: string
        }
        Update: {
          chain?: string
          created_at?: string
          deployment_id?: string
          details?: Json | null
          error_data?: Json | null
          id?: string
          level?: string
          message?: string
          operation?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          address: string
          amount: number
          asset: string
          block_number: number | null
          chain: string
          confirmed_at: string | null
          created_at: string
          id: string
          metadata: Json
          status: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          address: string
          amount: number
          asset?: string
          block_number?: number | null
          chain?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          status?: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          address?: string
          amount?: number
          asset?: string
          block_number?: number | null
          chain?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          status?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      educational_content: {
        Row: {
          category: string
          content: string
          content_type: string
          created_at: string
          difficulty_level: string
          id: string
          is_featured: boolean | null
          prerequisites: string[] | null
          reading_time_minutes: number | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content: string
          content_type?: string
          created_at?: string
          difficulty_level?: string
          id?: string
          is_featured?: boolean | null
          prerequisites?: string[] | null
          reading_time_minutes?: number | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          content_type?: string
          created_at?: string
          difficulty_level?: string
          id?: string
          is_featured?: boolean | null
          prerequisites?: string[] | null
          reading_time_minutes?: number | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      encrypted_wallet_keys: {
        Row: {
          created_at: string
          encrypted_private_key: string
          encryption_iv: string
          encryption_method: string | null
          encryption_salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_private_key: string
          encryption_iv: string
          encryption_method?: string | null
          encryption_salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_private_key?: string
          encryption_iv?: string
          encryption_method?: string | null
          encryption_salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      failed_transaction_records: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          quote_id: string | null
          reconciled: boolean | null
          reconciled_at: string | null
          swap_data: Json
          tx_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          quote_id?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          swap_data: Json
          tx_hash: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          quote_id?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          swap_data?: Json
          tx_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "failed_transaction_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "failed_transaction_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer: string
          category_id: string
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category_id: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category_id?: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "faq_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_collection_requests: {
        Row: {
          amount: number
          asset: string
          chain: string | null
          completed_at: string | null
          created_at: string
          external_tx_hash: string | null
          from_address: string
          id: string
          metadata: Json | null
          status: string
          to_address: string
          transaction_id: string
          user_id: string
          webhook_data: Json | null
        }
        Insert: {
          amount: number
          asset: string
          chain?: string | null
          completed_at?: string | null
          created_at?: string
          external_tx_hash?: string | null
          from_address: string
          id?: string
          metadata?: Json | null
          status?: string
          to_address?: string
          transaction_id: string
          user_id: string
          webhook_data?: Json | null
        }
        Update: {
          amount?: number
          asset?: string
          chain?: string | null
          completed_at?: string | null
          created_at?: string
          external_tx_hash?: string | null
          from_address?: string
          id?: string
          metadata?: Json | null
          status?: string
          to_address?: string
          transaction_id?: string
          user_id?: string
          webhook_data?: Json | null
        }
        Relationships: []
      }
      fee_reconciliation_log: {
        Row: {
          actual_gas_cost: number
          chain: string | null
          created_at: string | null
          estimated_gas_cost: number
          exceeded_margin: boolean | null
          gas_difference: number | null
          gas_price_gwei: number | null
          gas_used: number | null
          id: string
          metadata: Json | null
          output_amount_gross: number
          output_amount_net: number
          output_asset: string
          platform_fee_amount: number
          platform_fee_asset: string
          platform_fee_bps: number
          quote_id: string | null
          relay_fee_amount: number
          relay_fee_asset: string
          relay_fee_usd: number
          relay_margin: number
          swap_protocol: string | null
          total_fees_charged: number
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          actual_gas_cost: number
          chain?: string | null
          created_at?: string | null
          estimated_gas_cost: number
          exceeded_margin?: boolean | null
          gas_difference?: number | null
          gas_price_gwei?: number | null
          gas_used?: number | null
          id?: string
          metadata?: Json | null
          output_amount_gross: number
          output_amount_net: number
          output_asset: string
          platform_fee_amount: number
          platform_fee_asset: string
          platform_fee_bps?: number
          quote_id?: string | null
          relay_fee_amount: number
          relay_fee_asset: string
          relay_fee_usd: number
          relay_margin?: number
          swap_protocol?: string | null
          total_fees_charged: number
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          actual_gas_cost?: number
          chain?: string | null
          created_at?: string | null
          estimated_gas_cost?: number
          exceeded_margin?: boolean | null
          gas_difference?: number | null
          gas_price_gwei?: number | null
          gas_used?: number | null
          id?: string
          metadata?: Json | null
          output_amount_gross?: number
          output_amount_net?: number
          output_asset?: string
          platform_fee_amount?: number
          platform_fee_asset?: string
          platform_fee_bps?: number
          quote_id?: string | null
          relay_fee_amount?: number
          relay_fee_asset?: string
          relay_fee_usd?: number
          relay_margin?: number
          swap_protocol?: string | null
          total_fees_charged?: number
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_reconciliation_log_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_reconciliation_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_news: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          published_at: string
          relevance_score: number | null
          source: string
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          published_at: string
          relevance_score?: number | null
          source: string
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          published_at?: string
          relevance_score?: number | null
          source?: string
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      gold_price_history: {
        Row: {
          close_price: number
          created_at: string
          date: string
          high_price: number
          id: string
          low_price: number
          open_price: number
          source: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          close_price: number
          created_at?: string
          date: string
          high_price: number
          id?: string
          low_price: number
          open_price: number
          source?: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          close_price?: number
          created_at?: string
          date?: string
          high_price?: number
          id?: string
          low_price?: number
          open_price?: number
          source?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: []
      }
      gold_prices: {
        Row: {
          change_24h: number | null
          change_percent_24h: number | null
          created_at: string
          id: string
          metadata: Json | null
          source: string
          timestamp: string
          usd_per_gram: number
          usd_per_oz: number
        }
        Insert: {
          change_24h?: number | null
          change_percent_24h?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          source: string
          timestamp?: string
          usd_per_gram: number
          usd_per_oz: number
        }
        Update: {
          change_24h?: number | null
          change_percent_24h?: number | null
          created_at?: string
          id?: string
          metadata?: Json | null
          source?: string
          timestamp?: string
          usd_per_gram?: number
          usd_per_oz?: number
        }
        Relationships: []
      }
      hyperliquid_account_snapshots: {
        Row: {
          account_value: number
          address: string
          equity: number
          free_collateral: number
          id: string
          margin_usage: number
          timestamp: string
          total_position_value: number
          unrealized_pnl: number | null
          user_id: string
          withdrawable: number
        }
        Insert: {
          account_value: number
          address: string
          equity: number
          free_collateral: number
          id?: string
          margin_usage: number
          timestamp?: string
          total_position_value: number
          unrealized_pnl?: number | null
          user_id: string
          withdrawable: number
        }
        Update: {
          account_value?: number
          address?: string
          equity?: number
          free_collateral?: number
          id?: string
          margin_usage?: number
          timestamp?: string
          total_position_value?: number
          unrealized_pnl?: number | null
          user_id?: string
          withdrawable?: number
        }
        Relationships: []
      }
      hyperliquid_orders: {
        Row: {
          address: string
          average_fill_price: number | null
          client_order_id: string
          created_at: string
          error_message: string | null
          filled_at: string | null
          filled_size: number | null
          id: string
          leverage: number
          market: string
          metadata: Json | null
          order_id: number | null
          order_type: string
          post_only: boolean | null
          price: number | null
          reduce_only: boolean | null
          side: string
          size: number
          status: string
          time_in_force: string | null
          tx_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          average_fill_price?: number | null
          client_order_id: string
          created_at?: string
          error_message?: string | null
          filled_at?: string | null
          filled_size?: number | null
          id?: string
          leverage: number
          market: string
          metadata?: Json | null
          order_id?: number | null
          order_type: string
          post_only?: boolean | null
          price?: number | null
          reduce_only?: boolean | null
          side: string
          size: number
          status?: string
          time_in_force?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          average_fill_price?: number | null
          client_order_id?: string
          created_at?: string
          error_message?: string | null
          filled_at?: string | null
          filled_size?: number | null
          id?: string
          leverage?: number
          market?: string
          metadata?: Json | null
          order_id?: number | null
          order_type?: string
          post_only?: boolean | null
          price?: number | null
          reduce_only?: boolean | null
          side?: string
          size?: number
          status?: string
          time_in_force?: string | null
          tx_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hyperliquid_positions: {
        Row: {
          address: string
          closed_at: string | null
          created_at: string
          entry_price: number
          id: string
          leverage: number
          liquidation_price: number | null
          market: string
          metadata: Json | null
          opened_at: string
          realized_pnl: number | null
          side: string
          size: number
          status: string
          unrealized_pnl: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          closed_at?: string | null
          created_at?: string
          entry_price: number
          id?: string
          leverage: number
          liquidation_price?: number | null
          market: string
          metadata?: Json | null
          opened_at?: string
          realized_pnl?: number | null
          side: string
          size: number
          status?: string
          unrealized_pnl?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          closed_at?: string | null
          created_at?: string
          entry_price?: number
          id?: string
          leverage?: number
          liquidation_price?: number | null
          market?: string
          metadata?: Json | null
          opened_at?: string
          realized_pnl?: number | null
          side?: string
          size?: number
          status?: string
          unrealized_pnl?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hyperliquid_trades: {
        Row: {
          address: string
          created_at: string
          fee: number
          fee_asset: string | null
          id: string
          is_maker: boolean | null
          market: string
          order_id: number | null
          price: number
          side: string
          size: number
          timestamp: string
          trade_id: number | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          fee: number
          fee_asset?: string | null
          id?: string
          is_maker?: boolean | null
          market: string
          order_id?: number | null
          price: number
          side: string
          size: number
          timestamp: string
          trade_id?: number | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          fee?: number
          fee_asset?: string | null
          id?: string
          is_maker?: boolean | null
          market?: string
          order_id?: number | null
          price?: number
          side?: string
          size?: number
          timestamp?: string
          trade_id?: number | null
          user_id?: string
        }
        Relationships: []
      }
      hyperliquid_wallets: {
        Row: {
          address: string
          created_at: string
          encrypted_private_key: string
          encryption_method: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          encrypted_private_key: string
          encryption_method?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          encrypted_private_key?: string
          encryption_method?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      institutional_accounts: {
        Row: {
          admin_email: string
          created_at: string
          features: string[] | null
          id: string
          minimum_signatures: number | null
          multi_sig_required: boolean | null
          org_name: string
          signatories: string[] | null
          tier: string
          updated_at: string
          white_label_config: Json | null
        }
        Insert: {
          admin_email: string
          created_at?: string
          features?: string[] | null
          id?: string
          minimum_signatures?: number | null
          multi_sig_required?: boolean | null
          org_name: string
          signatories?: string[] | null
          tier?: string
          updated_at?: string
          white_label_config?: Json | null
        }
        Update: {
          admin_email?: string
          created_at?: string
          features?: string[] | null
          id?: string
          minimum_signatures?: number | null
          multi_sig_required?: boolean | null
          org_name?: string
          signatories?: string[] | null
          tier?: string
          updated_at?: string
          white_label_config?: Json | null
        }
        Relationships: []
      }
      kyc_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          id: string
          updated_at: string
          upload_status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          id?: string
          updated_at?: string
          upload_status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          id?: string
          updated_at?: string
          upload_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      market_rules_cache: {
        Row: {
          maker_fee_rate: number
          market: string
          max_leverage: number
          min_notional: number
          min_order_size: number
          step_size: number
          taker_fee_rate: number
          tick_size: number
          updated_at: string | null
        }
        Insert: {
          maker_fee_rate?: number
          market: string
          max_leverage?: number
          min_notional: number
          min_order_size: number
          step_size: number
          taker_fee_rate?: number
          tick_size: number
          updated_at?: string | null
        }
        Update: {
          maker_fee_rate?: number
          market?: string
          max_leverage?: number
          min_notional?: number
          min_order_size?: number
          step_size?: number
          taker_fee_rate?: number
          tick_size?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      moonpay_customers: {
        Row: {
          country_code: string | null
          created_at: string | null
          email: string
          kyc_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          email: string
          kyc_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          email?: string
          kyc_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      moonpay_transactions: {
        Row: {
          address: string | null
          amount_crypto: number | null
          amount_fiat: number | null
          asset_symbol: string
          created_at: string | null
          currency_fiat: string | null
          id: number
          is_recurring: boolean | null
          moonpay_tx_id: string | null
          raw_webhook: Json | null
          recurring_frequency: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          amount_crypto?: number | null
          amount_fiat?: number | null
          asset_symbol: string
          created_at?: string | null
          currency_fiat?: string | null
          id?: never
          is_recurring?: boolean | null
          moonpay_tx_id?: string | null
          raw_webhook?: Json | null
          recurring_frequency?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          amount_crypto?: number | null
          amount_fiat?: number | null
          asset_symbol?: string
          created_at?: string | null
          currency_fiat?: string | null
          id?: never
          is_recurring?: boolean | null
          moonpay_tx_id?: string | null
          raw_webhook?: Json | null
          recurring_frequency?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      moonpay_webhooks: {
        Row: {
          event_type: string
          id: number
          payload: Json
          received_at: string | null
          signature: string | null
        }
        Insert: {
          event_type: string
          id?: never
          payload: Json
          received_at?: string | null
          signature?: string | null
        }
        Update: {
          event_type?: string
          id?: never
          payload?: Json
          received_at?: string | null
          signature?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          icon: string | null
          id: string
          kind: string
          priority: string | null
          read: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          icon?: string | null
          id?: string
          kind: string
          priority?: string | null
          read?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          icon?: string | null
          id?: string
          kind?: string
          priority?: string | null
          read?: boolean | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      onchain_addresses: {
        Row: {
          address: string
          archived_at: string | null
          asset: string
          balance_snapshot: number | null
          chain: string
          created_at: string
          created_with_password: boolean | null
          id: string
          is_primary: boolean | null
          last_balance_check: string | null
          setup_method: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          address: string
          archived_at?: string | null
          asset?: string
          balance_snapshot?: number | null
          chain?: string
          created_at?: string
          created_with_password?: boolean | null
          id?: string
          is_primary?: boolean | null
          last_balance_check?: string | null
          setup_method?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          address?: string
          archived_at?: string | null
          asset?: string
          balance_snapshot?: number | null
          chain?: string
          created_at?: string
          created_with_password?: boolean | null
          id?: string
          is_primary?: boolean | null
          last_balance_check?: string | null
          setup_method?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          external_id: string
          id: string
          is_active: boolean
          metadata: Json
          provider: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          is_active?: boolean
          metadata?: Json
          provider: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          provider?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          chain: string | null
          created_at: string
          currency: string
          external_id: string
          id: string
          metadata: Json | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          chain?: string | null
          created_at?: string
          currency: string
          external_id: string
          id?: string
          metadata?: Json | null
          provider: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          chain?: string | null
          created_at?: string
          currency?: string
          external_id?: string
          id?: string
          metadata?: Json | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_name: string
          metric_unit: string | null
          metric_value: number
          recorded_at: string | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_unit?: string | null
          metric_value: number
          recorded_at?: string | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_unit?: string | null
          metric_value?: number
          recorded_at?: string | null
        }
        Relationships: []
      }
      pii_access_control: {
        Row: {
          access_level: string
          access_reason: string | null
          authorized_by: string | null
          created_at: string | null
          encryption_required: boolean | null
          expires_at: string | null
          field_name: string
          id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          access_reason?: string | null
          authorized_by?: string | null
          created_at?: string | null
          encryption_required?: boolean | null
          expires_at?: string | null
          field_name: string
          id?: string
          user_id: string
        }
        Update: {
          access_level?: string
          access_reason?: string | null
          authorized_by?: string | null
          created_at?: string | null
          encryption_required?: boolean | null
          expires_at?: string | null
          field_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      pii_access_rate_limit: {
        Row: {
          access_count: number | null
          user_id: string
          window_start: string | null
        }
        Insert: {
          access_count?: number | null
          user_id: string
          window_start?: string | null
        }
        Update: {
          access_count?: number | null
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          alchemy_address: string | null
          city: string | null
          country: string | null
          created_at: string
          data_classification: string | null
          date_of_birth: string | null
          dob_encrypted: string | null
          dydx_address: string | null
          email: string
          encryption_metadata: Json | null
          first_name: string | null
          id: string
          kyc_status: string | null
          last_name: string | null
          last_pii_access: string | null
          metadata: Json | null
          phone: string | null
          ssn_encrypted: string | null
          ssn_last_four: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          alchemy_address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          data_classification?: string | null
          date_of_birth?: string | null
          dob_encrypted?: string | null
          dydx_address?: string | null
          email: string
          encryption_metadata?: Json | null
          first_name?: string | null
          id: string
          kyc_status?: string | null
          last_name?: string | null
          last_pii_access?: string | null
          metadata?: Json | null
          phone?: string | null
          ssn_encrypted?: string | null
          ssn_last_four?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          alchemy_address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          data_classification?: string | null
          date_of_birth?: string | null
          dob_encrypted?: string | null
          dydx_address?: string | null
          email?: string
          encryption_metadata?: Json | null
          first_name?: string | null
          id?: string
          kyc_status?: string | null
          last_name?: string | null
          last_pii_access?: string | null
          metadata?: Json | null
          phone?: string | null
          ssn_encrypted?: string | null
          ssn_last_four?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string
          expires_at: string
          fee_bps: number
          grams: number
          id: string
          input_amount: number | null
          input_asset: string | null
          output_amount: number | null
          output_asset: string | null
          route: Json | null
          side: string
          unit_price_usd: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          fee_bps: number
          grams: number
          id?: string
          input_amount?: number | null
          input_asset?: string | null
          output_amount?: number | null
          output_asset?: string | null
          route?: Json | null
          side: string
          unit_price_usd: number
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          fee_bps?: number
          grams?: number
          id?: string
          input_amount?: number | null
          input_asset?: string | null
          output_amount?: number | null
          output_asset?: string | null
          route?: Json | null
          side?: string
          unit_price_usd?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      real_time_security_events: {
        Row: {
          created_at: string | null
          detected_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown
          resolved: boolean | null
          session_id: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          detected_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          resolved?: boolean | null
          session_id?: string | null
          severity: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          detected_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          resolved?: boolean | null
          session_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "real_time_security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_time_security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          metadata: Json | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      referral_point_balances: {
        Row: {
          current_tier: string | null
          last_updated: string
          lifetime_earned: number
          points_redeemed: number
          total_points: number
          user_id: string
        }
        Insert: {
          current_tier?: string | null
          last_updated?: string
          lifetime_earned?: number
          points_redeemed?: number
          total_points?: number
          user_id: string
        }
        Update: {
          current_tier?: string | null
          last_updated?: string
          lifetime_earned?: number
          points_redeemed?: number
          total_points?: number
          user_id?: string
        }
        Relationships: []
      }
      referral_points: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          points: number
          related_referral_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          points: number
          related_referral_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          points?: number
          related_referral_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_points_related_referral_id_fkey"
            columns: ["related_referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          completed_at: string | null
          completion_type: string | null
          created_at: string
          id: string
          metadata: Json | null
          referee_id: string
          referral_code: string
          referrer_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          completion_type?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          referee_id: string
          referral_code: string
          referrer_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          completion_type?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          referee_id?: string
          referral_code?: string
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      relayer_key_metadata: {
        Row: {
          created_at: string
          id: string
          key_id: string
          rotated_at: string
          rotated_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_id: string
          rotated_at?: string
          rotated_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          key_id?: string
          rotated_at?: string
          rotated_by?: string | null
          status?: string
        }
        Relationships: []
      }
      secure_wallet_metadata: {
        Row: {
          created_at: string
          kdf_iterations: number
          kdf_salt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kdf_iterations?: number
          kdf_salt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          kdf_iterations?: number
          kdf_salt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          description: string
          id: string
          ip_address: unknown
          metadata: Json | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          description: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          title: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          description?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_audit: {
        Row: {
          id: string
          ip_address: unknown
          metadata: Json | null
          operation: string
          risk_score: number | null
          sensitive_fields: string[] | null
          table_name: string
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          operation: string
          risk_score?: number | null
          sensitive_fields?: string[] | null
          table_name: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          operation?: string
          risk_score?: number | null
          sensitive_fields?: string[] | null
          table_name?: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string | null
          created_by: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      security_incidents: {
        Row: {
          created_at: string | null
          description: string
          id: string
          incident_type: string
          metadata: Json | null
          resolved_at: string | null
          severity: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          incident_type: string
          metadata?: Json | null
          resolved_at?: string | null
          severity: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          incident_type?: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      session_security: {
        Row: {
          created_at: string | null
          device_fingerprint: string | null
          id: string
          ip_address: unknown
          is_suspicious: boolean | null
          last_activity: string | null
          location: Json | null
          metadata: Json | null
          risk_score: number | null
          session_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: unknown
          is_suspicious?: boolean | null
          last_activity?: string | null
          location?: Json | null
          metadata?: Json | null
          risk_score?: number | null
          session_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: unknown
          is_suspicious?: boolean | null
          last_activity?: string | null
          location?: Json | null
          metadata?: Json | null
          risk_score?: number | null
          session_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      signature_attempts: {
        Row: {
          chain_id: number
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          success: boolean
          user_id: string
        }
        Insert: {
          chain_id: number
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          success: boolean
          user_id: string
        }
        Update: {
          chain_id?: number
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      snx_accounts: {
        Row: {
          account_id: string
          alchemy_address: string | null
          chain_id: number
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          account_id: string
          alchemy_address?: string | null
          chain_id: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          account_id?: string
          alchemy_address?: string | null
          chain_id?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      snx_orders: {
        Row: {
          account_id: string
          chain_id: number
          created_at: string | null
          filled_at: string | null
          filled_price: number | null
          filled_size: number | null
          id: string
          leverage: number
          market_id: string
          market_key: string
          metadata: Json | null
          price: number | null
          side: string
          size: number
          status: string
          tx_hash: string | null
          type: string
          updated_at: string | null
          user_id: string
          wallet_source: string
        }
        Insert: {
          account_id: string
          chain_id: number
          created_at?: string | null
          filled_at?: string | null
          filled_price?: number | null
          filled_size?: number | null
          id?: string
          leverage: number
          market_id: string
          market_key: string
          metadata?: Json | null
          price?: number | null
          side: string
          size: number
          status: string
          tx_hash?: string | null
          type: string
          updated_at?: string | null
          user_id: string
          wallet_source: string
        }
        Update: {
          account_id?: string
          chain_id?: number
          created_at?: string | null
          filled_at?: string | null
          filled_price?: number | null
          filled_size?: number | null
          id?: string
          leverage?: number
          market_id?: string
          market_key?: string
          metadata?: Json | null
          price?: number | null
          side?: string
          size?: number
          status?: string
          tx_hash?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
          wallet_source?: string
        }
        Relationships: []
      }
      snx_positions: {
        Row: {
          account_id: string
          chain_id: number
          closed_at: string | null
          entry_price: number
          funding_accrued: number | null
          id: string
          leverage: number
          liquidation_price: number
          market_id: string
          market_key: string
          opened_at: string | null
          realized_pnl: number | null
          side: string
          size: number
          status: string
          unrealized_pnl: number | null
          user_id: string
        }
        Insert: {
          account_id: string
          chain_id: number
          closed_at?: string | null
          entry_price: number
          funding_accrued?: number | null
          id?: string
          leverage: number
          liquidation_price: number
          market_id: string
          market_key: string
          opened_at?: string | null
          realized_pnl?: number | null
          side: string
          size: number
          status: string
          unrealized_pnl?: number | null
          user_id: string
        }
        Update: {
          account_id?: string
          chain_id?: number
          closed_at?: string | null
          entry_price?: number
          funding_accrued?: number | null
          id?: string
          leverage?: number
          liquidation_price?: number
          market_id?: string
          market_key?: string
          opened_at?: string | null
          realized_pnl?: number | null
          side?: string
          size?: number
          status?: string
          unrealized_pnl?: number | null
          user_id?: string
        }
        Relationships: []
      }
      solana_wallets: {
        Row: {
          created_at: string
          encrypted_private_key: string
          encryption_iv: string
          encryption_method: string
          encryption_salt: string
          id: string
          public_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_private_key: string
          encryption_iv: string
          encryption_method?: string
          encryption_salt: string
          id?: string
          public_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_private_key?: string
          encryption_iv?: string
          encryption_method?: string
          encryption_salt?: string
          id?: string
          public_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_replies: {
        Row: {
          created_at: string | null
          id: string
          is_admin: boolean | null
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_admin?: boolean | null
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          description: string
          id: string
          issue_type: string
          priority: string | null
          resolution_notes: string | null
          resolved_at: string | null
          screenshot_url: string | null
          status: string
          subject: string
          ticket_number: string
          updated_at: string | null
          user_email: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          description: string
          id?: string
          issue_type: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          status?: string
          subject: string
          ticket_number: string
          updated_at?: string | null
          user_email: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string
          id?: string
          issue_type?: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          screenshot_url?: string | null
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string | null
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      swap_execution_metrics: {
        Row: {
          db_record_success: boolean
          error_type: string | null
          fee_collection_success: boolean
          id: string
          metadata: Json | null
          on_chain_success: boolean
          recorded_at: string | null
          retry_count: number | null
          user_id: string | null
        }
        Insert: {
          db_record_success: boolean
          error_type?: string | null
          fee_collection_success: boolean
          id?: string
          metadata?: Json | null
          on_chain_success: boolean
          recorded_at?: string | null
          retry_count?: number | null
          user_id?: string | null
        }
        Update: {
          db_record_success?: boolean
          error_type?: string | null
          fee_collection_success?: boolean
          id?: string
          metadata?: Json | null
          on_chain_success?: boolean
          recorded_at?: string | null
          retry_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      swap_quotes: {
        Row: {
          created_at: string
          exchange_rate: number
          expires_at: string
          fee: number
          id: string
          input_amount: number
          input_asset: string
          minimum_received: number
          output_amount: number
          output_asset: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exchange_rate: number
          expires_at: string
          fee: number
          id?: string
          input_amount: number
          input_asset: string
          minimum_received: number
          output_amount: number
          output_asset: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exchange_rate?: number
          expires_at?: string
          fee?: number
          id?: string
          input_amount?: number
          input_asset?: string
          minimum_received?: number
          output_amount?: number
          output_asset?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_capacity: {
        Row: {
          active_connections: number | null
          concurrent_users: number | null
          cpu_usage_percent: number | null
          id: string
          memory_usage_percent: number | null
          recorded_at: string | null
          response_time_ms: number | null
        }
        Insert: {
          active_connections?: number | null
          concurrent_users?: number | null
          cpu_usage_percent?: number | null
          id?: string
          memory_usage_percent?: number | null
          recorded_at?: string | null
          response_time_ms?: number | null
        }
        Update: {
          active_connections?: number | null
          concurrent_users?: number | null
          cpu_usage_percent?: number | null
          id?: string
          memory_usage_percent?: number | null
          recorded_at?: string | null
          response_time_ms?: number | null
        }
        Relationships: []
      }
      system_health_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_name: string
          metric_unit: string | null
          metric_value: number
          recorded_at: string | null
          status: string | null
          threshold_critical: number | null
          threshold_warning: number | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_unit?: string | null
          metric_value: number
          recorded_at?: string | null
          status?: string | null
          threshold_critical?: number | null
          threshold_warning?: number | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_unit?: string | null
          metric_value?: number
          recorded_at?: string | null
          status?: string | null
          threshold_critical?: number | null
          threshold_warning?: number | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          added_at: string
          created_at: string
          email: string
          id: string
          institutional_account_id: string
          last_active: string | null
          permissions: string[] | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          created_at?: string
          email: string
          id?: string
          institutional_account_id: string
          last_active?: string | null
          permissions?: string[] | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          created_at?: string
          email?: string
          id?: string
          institutional_account_id?: string
          last_active?: string | null
          permissions?: string[] | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_institutional_account_id_fkey"
            columns: ["institutional_account_id"]
            isOneToOne: false
            referencedRelation: "institutional_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_audit_log: {
        Row: {
          action: string
          created_at: string | null
          error_message: string | null
          id: string
          ip_address: unknown
          market: string
          order_details: Json
          result: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          market: string
          order_details: Json
          result?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          ip_address?: unknown
          market?: string
          order_details?: Json
          result?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trade_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          market: string | null
          operation: string
          order_id: string | null
          price: number | null
          result: Json | null
          side: string | null
          size: number | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          market?: string | null
          operation: string
          order_id?: string | null
          price?: number | null
          result?: Json | null
          side?: string | null
          size?: number | null
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          market?: string | null
          operation?: string
          order_id?: string | null
          price?: number | null
          result?: Json | null
          side?: string | null
          size?: number | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          description: string
          id: string
          metadata: Json | null
          resolved: boolean | null
          resolved_at: string | null
          severity: string
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          description: string
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          description?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_alerts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_intents: {
        Row: {
          blockchain_data: Json | null
          completed_at: string | null
          created_at: string
          disbursement_tx_hash: string | null
          error_details: Json | null
          error_message: string | null
          expected_output_amount: number
          failed_at: string | null
          funds_pulled_at: string | null
          id: string
          idempotency_key: string
          input_amount: number
          input_asset: string
          output_asset: string
          pull_tx_hash: string | null
          quote_id: string | null
          refund_tx_hash: string | null
          status: string
          swap_executed_at: string | null
          swap_tx_hash: string | null
          updated_at: string
          user_id: string
          validated_at: string | null
          validation_data: Json | null
        }
        Insert: {
          blockchain_data?: Json | null
          completed_at?: string | null
          created_at?: string
          disbursement_tx_hash?: string | null
          error_details?: Json | null
          error_message?: string | null
          expected_output_amount: number
          failed_at?: string | null
          funds_pulled_at?: string | null
          id?: string
          idempotency_key: string
          input_amount: number
          input_asset: string
          output_asset: string
          pull_tx_hash?: string | null
          quote_id?: string | null
          refund_tx_hash?: string | null
          status?: string
          swap_executed_at?: string | null
          swap_tx_hash?: string | null
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validation_data?: Json | null
        }
        Update: {
          blockchain_data?: Json | null
          completed_at?: string | null
          created_at?: string
          disbursement_tx_hash?: string | null
          error_details?: Json | null
          error_message?: string | null
          expected_output_amount?: number
          failed_at?: string | null
          funds_pulled_at?: string | null
          id?: string
          idempotency_key?: string
          input_amount?: number
          input_asset?: string
          output_asset?: string
          pull_tx_hash?: string | null
          quote_id?: string | null
          refund_tx_hash?: string | null
          status?: string
          swap_executed_at?: string | null
          swap_tx_hash?: string | null
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validation_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_intents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          asset: string
          chain: string | null
          created_at: string
          deposit_id: string | null
          fee_gold_units: number | null
          fee_usd: number | null
          id: string
          input_asset: string | null
          metadata: Json | null
          output_asset: string | null
          quantity: number
          quote_id: string | null
          status: string | null
          tx_hash: string | null
          type: string
          unit_price_usd: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset: string
          chain?: string | null
          created_at?: string
          deposit_id?: string | null
          fee_gold_units?: number | null
          fee_usd?: number | null
          id?: string
          input_asset?: string | null
          metadata?: Json | null
          output_asset?: string | null
          quantity: number
          quote_id?: string | null
          status?: string | null
          tx_hash?: string | null
          type: string
          unit_price_usd?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset?: string
          chain?: string | null
          created_at?: string
          deposit_id?: string | null
          fee_gold_units?: number | null
          fee_usd?: number | null
          id?: string
          input_asset?: string | null
          metadata?: Json | null
          output_asset?: string | null
          quantity?: number
          quote_id?: string | null
          status?: string | null
          tx_hash?: string | null
          type?: string
          unit_price_usd?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      trzry_holding_tracker: {
        Row: {
          created_at: string
          current_balance: number
          first_acquisition_date: string
          id: string
          last_updated: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_balance?: number
          first_acquisition_date: string
          id?: string
          last_updated?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          first_acquisition_date?: string
          id?: string
          last_updated?: string
          user_id?: string
        }
        Relationships: []
      }
      user_chart_settings: {
        Row: {
          created_at: string | null
          drawings: Json | null
          id: string
          indicators: Json | null
          live_mode: boolean | null
          market: string
          resolution: string
          updated_at: string | null
          user_id: string
          viewport: Json | null
        }
        Insert: {
          created_at?: string | null
          drawings?: Json | null
          id?: string
          indicators?: Json | null
          live_mode?: boolean | null
          market: string
          resolution: string
          updated_at?: string | null
          user_id: string
          viewport?: Json | null
        }
        Update: {
          created_at?: string | null
          drawings?: Json | null
          id?: string
          indicators?: Json | null
          live_mode?: boolean | null
          market?: string
          resolution?: string
          updated_at?: string | null
          user_id?: string
          viewport?: Json | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          ai_personalization_data: Json | null
          created_at: string
          id: string
          investment_goals: string[] | null
          notification_preferences: Json | null
          preferred_content_types: string[] | null
          risk_tolerance: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_personalization_data?: Json | null
          created_at?: string
          id?: string
          investment_goals?: string[] | null
          notification_preferences?: Json | null
          preferred_content_types?: string[] | null
          risk_tolerance?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_personalization_data?: Json | null
          created_at?: string
          id?: string
          investment_goals?: string[] | null
          notification_preferences?: Json | null
          preferred_content_types?: string[] | null
          risk_tolerance?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_salts: {
        Row: {
          created_at: string
          id: string
          salt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          salt: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          salt?: string
          user_id?: string
        }
        Relationships: []
      }
      user_transaction_limits: {
        Row: {
          confirmation_threshold: number
          created_at: string
          daily_transaction_max: number
          id: string
          max_transactions_per_day: number
          max_transactions_per_hour: number
          monthly_transaction_max: number
          single_transaction_max: number
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confirmation_threshold?: number
          created_at?: string
          daily_transaction_max?: number
          id?: string
          max_transactions_per_day?: number
          max_transactions_per_hour?: number
          monthly_transaction_max?: number
          single_transaction_max?: number
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confirmation_threshold?: number
          created_at?: string
          daily_transaction_max?: number
          id?: string
          max_transactions_per_day?: number
          max_transactions_per_hour?: number
          monthly_transaction_max?: number
          single_transaction_max?: number
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_transaction_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_transaction_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_profiles_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_balance_alerts: {
        Row: {
          alert_reason: string
          balance_change: number | null
          created_at: string | null
          current_balance: number | null
          id: string
          previous_balance: number | null
          resolved: boolean | null
          severity: string | null
          user_id: string
          wallet_address: string
        }
        Insert: {
          alert_reason: string
          balance_change?: number | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          previous_balance?: number | null
          resolved?: boolean | null
          severity?: string | null
          user_id: string
          wallet_address: string
        }
        Update: {
          alert_reason?: string
          balance_change?: number | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          previous_balance?: number | null
          resolved?: boolean | null
          severity?: string | null
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      wallet_change_audit: {
        Row: {
          balance_at_change: number | null
          change_type: string
          created_at: string | null
          had_balance: boolean | null
          id: string
          metadata: Json | null
          new_address: string | null
          old_address: string | null
          user_confirmed: boolean | null
          user_id: string
        }
        Insert: {
          balance_at_change?: number | null
          change_type: string
          created_at?: string | null
          had_balance?: boolean | null
          id?: string
          metadata?: Json | null
          new_address?: string | null
          old_address?: string | null
          user_confirmed?: boolean | null
          user_id: string
        }
        Update: {
          balance_at_change?: number | null
          change_type?: string
          created_at?: string | null
          had_balance?: boolean | null
          id?: string
          metadata?: Json | null
          new_address?: string | null
          old_address?: string | null
          user_confirmed?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      wallet_security_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wallets: {
        Row: {
          address: string
          chain: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          address: string
          chain?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          address?: string
          chain?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_profiles_masked"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_dlq: {
        Row: {
          created_at: string
          error_details: Json | null
          event_type: string
          id: string
          last_error: string | null
          metadata: Json | null
          original_timestamp: string
          payload: Json
          queued_at: string
          replay_error: string | null
          replay_status: string | null
          replayed_at: string | null
          retry_count: number
          signature: string | null
          updated_at: string
          webhook_id: string
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          event_type: string
          id?: string
          last_error?: string | null
          metadata?: Json | null
          original_timestamp: string
          payload: Json
          queued_at?: string
          replay_error?: string | null
          replay_status?: string | null
          replayed_at?: string | null
          retry_count?: number
          signature?: string | null
          updated_at?: string
          webhook_id: string
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          event_type?: string
          id?: string
          last_error?: string | null
          metadata?: Json | null
          original_timestamp?: string
          payload?: Json
          queued_at?: string
          replay_error?: string | null
          replay_status?: string | null
          replayed_at?: string | null
          retry_count?: number
          signature?: string | null
          updated_at?: string
          webhook_id?: string
        }
        Relationships: []
      }
      webhook_processing_log: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          ip_address: unknown
          processing_time_ms: number | null
          retry_count: number | null
          status: string
          user_id: string | null
          webhook_id: string
          webhook_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          ip_address?: unknown
          processing_time_ms?: number | null
          retry_count?: number | null
          status?: string
          user_id?: string | null
          webhook_id: string
          webhook_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          ip_address?: unknown
          processing_time_ms?: number | null
          retry_count?: number | null
          status?: string
          user_id?: string | null
          webhook_id?: string
          webhook_type?: string
        }
        Relationships: []
      }
      webhook_rate_limits: {
        Row: {
          blocked_until: string | null
          created_at: string
          id: string
          ip_address: unknown
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          id?: string
          ip_address: unknown
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      fee_analytics_summary: {
        Row: {
          avg_gas_difference: number | null
          avg_platform_fee: number | null
          avg_relay_fee: number | null
          date: string | null
          margin_exceeded_count: number | null
          max_gas_overage: number | null
          output_asset: string | null
          swap_count: number | null
          total_fees: number | null
        }
        Relationships: []
      }
      reconciliation_alerts_summary: {
        Row: {
          alert_count: number | null
          alert_type: string | null
          latest_alert: string | null
          recent_alerts: Json | null
          severity: string | null
        }
        Relationships: []
      }
      reconciliation_cron_status: {
        Row: {
          active: boolean | null
          database: string | null
          health_status: string | null
          jobname: string | null
          last_run_end: string | null
          last_run_message: string | null
          last_run_start: string | null
          last_run_status: string | null
          nodename: string | null
          runid: number | null
          schedule: string | null
        }
        Relationships: []
      }
      v_profiles_masked: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          kyc_status: string | null
          masked_phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          kyc_status?: string | null
          masked_phone?: never
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          kyc_status?: string | null
          masked_phone?: never
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_assign_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      admin_get_dashboard_stats: { Args: never; Returns: Json }
      admin_get_fee_analytics: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      admin_get_fee_analytics_with_chains: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      admin_get_fee_collection_dashboard_stats: { Args: never; Returns: Json }
      admin_get_security_overview: { Args: never; Returns: Json }
      admin_get_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          kyc_status: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      admin_remove_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      apply_referral_code: {
        Args: { p_referee_id: string; p_referral_code: string }
        Returns: Json
      }
      auto_activate_airdrop_periods: { Args: never; Returns: Json }
      award_monthly_active_points: { Args: never; Returns: Json }
      award_referral_points: {
        Args: {
          p_description?: string
          p_event_type: string
          p_points: number
          p_referral_id?: string
          p_referrer_id: string
        }
        Returns: undefined
      }
      backfill_missing_referral_codes: { Args: never; Returns: undefined }
      can_access_sensitive_pii: {
        Args: { target_user_id: string; user_uuid: string }
        Returns: boolean
      }
      check_180_day_milestones: { Args: never; Returns: Json }
      check_balance_verification_status: { Args: never; Returns: Json }
      check_extension_security: {
        Args: never
        Returns: {
          extension_name: string
          schema_name: string
          security_status: string
        }[]
      }
      check_pii_rate_limit: { Args: { p_user_id: string }; Returns: boolean }
      check_reconciliation_cron_health: { Args: never; Returns: undefined }
      check_stale_gold_price: { Args: never; Returns: undefined }
      check_transaction_access_rate_limit: { Args: never; Returns: boolean }
      check_transaction_velocity: {
        Args: { p_amount: number; p_user_id: string }
        Returns: Json
      }
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      collect_gold_prices: { Args: never; Returns: Json }
      create_security_alert: {
        Args: { alert_type: string; details?: Json; severity?: string }
        Returns: undefined
      }
      decrypt_pii:
        | { Args: { ciphertext: string }; Returns: string }
        | {
            Args: {
              encrypted_data: string
              field_name: string
              target_user_id: string
            }
            Returns: string
          }
      emergency_pii_lockdown_active: { Args: never; Returns: boolean }
      emergency_transaction_lockdown: { Args: never; Returns: boolean }
      encrypt_pii:
        | { Args: { plaintext: string }; Returns: string }
        | { Args: { field_name: string; plaintext: string }; Returns: string }
      encrypt_sensitive_field: { Args: { input_text: string }; Returns: string }
      execute_transaction: {
        Args: { payment_method_param?: string; quote_id_param: string }
        Returns: Json
      }
      generate_referral_code: { Args: never; Returns: string }
      generate_ticket_number: { Args: never; Returns: string }
      get_balance_verification_cron_status: {
        Args: never
        Returns: {
          active: boolean
          database: string
          jobid: number
          jobname: string
          schedule: string
          username: string
        }[]
      }
      get_cron_secret: { Args: never; Returns: string }
      get_fee_reconciliation_summary: {
        Args: { days_back?: number }
        Returns: Json
      }
      get_gold_price_cron_status: {
        Args: never
        Returns: {
          active: boolean
          database: string
          jobid: number
          jobname: string
          schedule: string
          username: string
        }[]
      }
      get_latest_gold_price: {
        Args: never
        Returns: {
          change_24h: number
          change_percent_24h: number
          last_updated: string
          source: string
          usd_per_gram: number
          usd_per_oz: number
        }[]
      }
      get_masked_profile: {
        Args: { target_user_id?: string }
        Returns: {
          address: string
          city: string
          country: string
          created_at: string
          date_of_birth: string
          email: string
          first_name: string
          id: string
          kyc_status: string
          kyc_submitted_at: string
          kyc_verified_at: string
          last_name: string
          phone: string
          ssn_display: string
          state: string
          updated_at: string
          zip_code: string
        }[]
      }
      get_public_config: { Args: { key_name: string }; Returns: string }
      get_reconciliation_alerts: {
        Args: { limit_count?: number }
        Returns: Json
      }
      get_reconciliation_cron_health: { Args: never; Returns: Json }
      get_security_dashboard_metrics: { Args: never; Returns: Json }
      get_security_metrics: { Args: never; Returns: Json }
      get_solana_public_key: { Args: { p_user_id: string }; Returns: string }
      get_solana_wallet: { Args: { p_user_id: string }; Returns: Json }
      get_system_health_metrics: { Args: never; Returns: Json }
      get_trzry_holding_status: {
        Args: { p_user_id: string }
        Returns: {
          days_remaining: number
          holding_days: number
          months_held: number
          progress_percentage: number
          qualified_for_airdrop: boolean
        }[]
      }
      get_user_email: { Args: { _user_id: string }; Returns: string }
      get_user_referral_stats: { Args: { p_user_id?: string }; Returns: Json }
      get_user_salt: { Args: { p_user_id: string }; Returns: string }
      get_verified_pii_field: {
        Args: { field_name: string; target_user_id?: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_locked: { Args: { p_email: string }; Returns: boolean }
      is_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_admin_with_mfa: { Args: { _user_id?: string }; Returns: boolean }
      is_institutional_admin: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      is_kyc_verified: { Args: { user_uuid: string }; Returns: boolean }
      is_team_member: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      log_high_risk_operation: {
        Args: {
          fields?: string[]
          operation_type: string
          risk_level?: number
          target_table: string
        }
        Returns: undefined
      }
      log_pii_access: {
        Args: {
          p_access_granted: boolean
          p_fields_accessed: string[]
          p_operation: string
          p_target_user_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      log_pii_access_enhanced: {
        Args: {
          p_access_granted: boolean
          p_access_reason?: string
          p_fields_accessed: string[]
          p_operation: string
          p_target_user_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      log_profile_access: {
        Args: { accessed_fields: string[]; target_user_id: string }
        Returns: undefined
      }
      log_security_event: {
        Args: { event_data?: Json; event_type: string }
        Returns: undefined
      }
      log_security_event_enhanced: {
        Args: {
          p_description: string
          p_event_type: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_severity: string
          p_title: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: string
      }
      log_sensitive_access: {
        Args: {
          p_metadata?: Json
          p_operation: string
          p_sensitive_fields?: string[]
          p_table_name: string
        }
        Returns: undefined
      }
      mask_address: { Args: { address_value: string }; Returns: string }
      mask_email: { Args: { email_value: string }; Returns: string }
      mask_phone: { Args: { phone_value: string }; Returns: string }
      mask_ssn: { Args: { ssn_value: string }; Returns: string }
      monitor_system_health: { Args: never; Returns: undefined }
      record_auth_attempt: {
        Args: {
          p_email: string
          p_ip_address?: unknown
          p_success?: boolean
          p_user_agent?: string
        }
        Returns: undefined
      }
      record_performance_metric: {
        Args: {
          p_metadata?: Json
          p_metric_name: string
          p_metric_unit?: string
          p_metric_value: number
        }
        Returns: undefined
      }
      record_system_metric: {
        Args: {
          p_metric_name: string
          p_metric_unit?: string
          p_metric_value: number
          p_threshold_critical?: number
          p_threshold_warning?: number
        }
        Returns: string
      }
      replay_webhook_from_dlq: { Args: { dlq_id: string }; Returns: Json }
      set_user_salt: {
        Args: { p_salt: string; p_user_id: string }
        Returns: undefined
      }
      test_gold_price_collection: { Args: never; Returns: Json }
      trigger_financial_news_collection: { Args: never; Returns: Json }
      trigger_gold_price_collection: { Args: never; Returns: Json }
      trigger_security_alert: {
        Args: {
          p_event_data?: Json
          p_event_type: string
          p_session_id?: string
          p_severity: string
          p_user_id?: string
        }
        Returns: string
      }
      update_encrypted_dob: {
        Args: { dob_value: string; user_uuid: string }
        Returns: undefined
      }
      update_encrypted_ssn: {
        Args: { ssn_value: string; user_uuid: string }
        Returns: undefined
      }
      update_my_profile: {
        Args: {
          p_address?: string
          p_city?: string
          p_country?: string
          p_date_of_birth?: string
          p_first_name?: string
          p_last_name?: string
          p_phone?: string
          p_ssn_last_four?: string
          p_state?: string
          p_zip_code?: string
        }
        Returns: Json
      }
      upsert_solana_wallet: {
        Args: {
          p_encrypted_key: string
          p_iv: string
          p_public_key: string
          p_salt: string
          p_user_id: string
        }
        Returns: undefined
      }
      user_can_see_sensitive_data: { Args: never; Returns: boolean }
      validate_and_apply_referral_code: {
        Args: { p_referee_id: string; p_referral_code: string }
        Returns: Json
      }
      validate_kyc_document_access: {
        Args: { doc_status: string; doc_user_id: string }
        Returns: boolean
      }
      validate_profile_access_pattern: {
        Args: { user_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
