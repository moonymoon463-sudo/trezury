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
      audit_log: {
        Row: {
          id: string
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
      governance_rewards: {
        Row: {
          amount_dec: number
          asset: string
          chain: string
          claimed_at: string | null
          created_at: string
          earned_at: string
          id: string
          metadata: Json | null
          reward_type: string
          user_id: string
        }
        Insert: {
          amount_dec?: number
          asset?: string
          chain?: string
          claimed_at?: string | null
          created_at?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          reward_type: string
          user_id: string
        }
        Update: {
          amount_dec?: number
          asset?: string
          chain?: string
          claimed_at?: string | null
          created_at?: string
          earned_at?: string
          id?: string
          metadata?: Json | null
          reward_type?: string
          user_id?: string
        }
        Relationships: []
      }
      interest_rate_models: {
        Row: {
          asset: string
          base_stable_borrow_rate: number
          base_variable_borrow_rate: number
          chain: string
          created_at: string
          id: string
          optimal_utilization_rate: number
          stable_rate_slope1: number
          stable_rate_slope2: number
          updated_at: string
          variable_rate_slope1: number
          variable_rate_slope2: number
        }
        Insert: {
          asset: string
          base_stable_borrow_rate?: number
          base_variable_borrow_rate?: number
          chain?: string
          created_at?: string
          id?: string
          optimal_utilization_rate?: number
          stable_rate_slope1?: number
          stable_rate_slope2?: number
          updated_at?: string
          variable_rate_slope1?: number
          variable_rate_slope2?: number
        }
        Update: {
          asset?: string
          base_stable_borrow_rate?: number
          base_variable_borrow_rate?: number
          chain?: string
          created_at?: string
          id?: string
          optimal_utilization_rate?: number
          stable_rate_slope1?: number
          stable_rate_slope2?: number
          updated_at?: string
          variable_rate_slope1?: number
          variable_rate_slope2?: number
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
        ]
      }
      liquidation_calls: {
        Row: {
          chain: string
          collateral_asset: string
          completed_at: string | null
          created_at: string
          debt_asset: string
          debt_to_cover_dec: number
          health_factor_after: number
          health_factor_before: number
          id: string
          liquidated_collateral_dec: number
          liquidation_bonus_dec: number
          liquidator_id: string | null
          status: string
          tx_hash: string | null
          user_id: string
        }
        Insert: {
          chain?: string
          collateral_asset: string
          completed_at?: string | null
          created_at?: string
          debt_asset: string
          debt_to_cover_dec: number
          health_factor_after: number
          health_factor_before: number
          id?: string
          liquidated_collateral_dec: number
          liquidation_bonus_dec: number
          liquidator_id?: string | null
          status?: string
          tx_hash?: string | null
          user_id: string
        }
        Update: {
          chain?: string
          collateral_asset?: string
          completed_at?: string | null
          created_at?: string
          debt_asset?: string
          debt_to_cover_dec?: number
          health_factor_after?: number
          health_factor_before?: number
          id?: string
          liquidated_collateral_dec?: number
          liquidation_bonus_dec?: number
          liquidator_id?: string | null
          status?: string
          tx_hash?: string | null
          user_id?: string
        }
        Relationships: []
      }
      locks: {
        Row: {
          accrued_interest_dec: number
          amount_dec: number
          apy_applied: number
          apy_max: number
          apy_min: number
          autocompound: boolean
          chain: string
          created_at: string
          deposit_tx: string | null
          end_ts: string
          id: string
          platform_fee_rate: number | null
          start_ts: string
          status: Database["public"]["Enums"]["lock_status"]
          token: string
          updated_at: string
          user_id: string
          withdraw_tx: string | null
        }
        Insert: {
          accrued_interest_dec?: number
          amount_dec: number
          apy_applied: number
          apy_max: number
          apy_min: number
          autocompound?: boolean
          chain: string
          created_at?: string
          deposit_tx?: string | null
          end_ts: string
          id?: string
          platform_fee_rate?: number | null
          start_ts: string
          status?: Database["public"]["Enums"]["lock_status"]
          token: string
          updated_at?: string
          user_id: string
          withdraw_tx?: string | null
        }
        Update: {
          accrued_interest_dec?: number
          amount_dec?: number
          apy_applied?: number
          apy_max?: number
          apy_min?: number
          autocompound?: boolean
          chain?: string
          created_at?: string
          deposit_tx?: string | null
          end_ts?: string
          id?: string
          platform_fee_rate?: number | null
          start_ts?: string
          status?: Database["public"]["Enums"]["lock_status"]
          token?: string
          updated_at?: string
          user_id?: string
          withdraw_tx?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          read: boolean | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          read?: boolean | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
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
        ]
      }
      onchain_addresses: {
        Row: {
          address: string
          asset: string
          chain: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          address: string
          asset?: string
          chain?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          address?: string
          asset?: string
          chain?: string
          created_at?: string
          id?: string
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
      payouts: {
        Row: {
          chain: string
          id: string
          interest_dec: number
          lock_id: string | null
          platform_fee_dec: number | null
          principal_dec: number
          token: string
          ts: string
          tx_hash: string | null
        }
        Insert: {
          chain: string
          id?: string
          interest_dec: number
          lock_id?: string | null
          platform_fee_dec?: number | null
          principal_dec: number
          token: string
          ts?: string
          tx_hash?: string | null
        }
        Update: {
          chain?: string
          id?: string
          interest_dec?: number
          lock_id?: string | null
          platform_fee_dec?: number | null
          principal_dec?: number
          token?: string
          ts?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_lock_id_fkey"
            columns: ["lock_id"]
            isOneToOne: false
            referencedRelation: "locks"
            referencedColumns: ["id"]
          },
        ]
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
      pool_reserves: {
        Row: {
          asset: string
          available_liquidity_dec: number
          borrow_rate_stable: number
          borrow_rate_variable: number
          borrowing_enabled: boolean
          chain: string
          created_at: string
          id: string
          is_active: boolean
          is_frozen: boolean
          last_update_timestamp: string
          liquidation_bonus: number
          liquidation_threshold: number
          ltv: number
          reserve_factor: number
          stable_rate_enabled: boolean
          supply_rate: number
          total_borrowed_dec: number
          total_supply_dec: number
          updated_at: string
          utilization_rate: number
        }
        Insert: {
          asset: string
          available_liquidity_dec?: number
          borrow_rate_stable?: number
          borrow_rate_variable?: number
          borrowing_enabled?: boolean
          chain?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_frozen?: boolean
          last_update_timestamp?: string
          liquidation_bonus?: number
          liquidation_threshold?: number
          ltv?: number
          reserve_factor?: number
          stable_rate_enabled?: boolean
          supply_rate?: number
          total_borrowed_dec?: number
          total_supply_dec?: number
          updated_at?: string
          utilization_rate?: number
        }
        Update: {
          asset?: string
          available_liquidity_dec?: number
          borrow_rate_stable?: number
          borrow_rate_variable?: number
          borrowing_enabled?: boolean
          chain?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_frozen?: boolean
          last_update_timestamp?: string
          liquidation_bonus?: number
          liquidation_threshold?: number
          ltv?: number
          reserve_factor?: number
          stable_rate_enabled?: boolean
          supply_rate?: number
          total_borrowed_dec?: number
          total_supply_dec?: number
          updated_at?: string
          utilization_rate?: number
        }
        Relationships: []
      }
      pool_stats: {
        Row: {
          chain: string
          id: string
          reserve_balance_dec: number
          token: string
          total_borrowed_dec: number
          total_deposits_dec: number
          updated_ts: string
          utilization_fp: number
        }
        Insert: {
          chain: string
          id?: string
          reserve_balance_dec?: number
          token: string
          total_borrowed_dec?: number
          total_deposits_dec?: number
          updated_ts?: string
          utilization_fp?: number
        }
        Update: {
          chain?: string
          id?: string
          reserve_balance_dec?: number
          token?: string
          total_borrowed_dec?: number
          total_deposits_dec?: number
          updated_ts?: string
          utilization_fp?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          data_classification: string | null
          date_of_birth: string | null
          email: string
          encryption_metadata: Json | null
          first_name: string | null
          id: string
          kyc_inquiry_id: string | null
          kyc_rejection_reason: string | null
          kyc_status: string | null
          kyc_submitted_at: string | null
          kyc_verified_at: string | null
          last_name: string | null
          last_pii_access: string | null
          metadata: Json | null
          phone: string | null
          ssn_last_four: string | null
          state: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          data_classification?: string | null
          date_of_birth?: string | null
          email: string
          encryption_metadata?: Json | null
          first_name?: string | null
          id: string
          kyc_inquiry_id?: string | null
          kyc_rejection_reason?: string | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          last_name?: string | null
          last_pii_access?: string | null
          metadata?: Json | null
          phone?: string | null
          ssn_last_four?: string | null
          state?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          data_classification?: string | null
          date_of_birth?: string | null
          email?: string
          encryption_metadata?: Json | null
          first_name?: string | null
          id?: string
          kyc_inquiry_id?: string | null
          kyc_rejection_reason?: string | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          last_name?: string | null
          last_pii_access?: string | null
          metadata?: Json | null
          phone?: string | null
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
        ]
      }
      security_audit: {
        Row: {
          id: string
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
      transactions: {
        Row: {
          asset: string
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
        ]
      }
      user_borrows: {
        Row: {
          accrued_interest_dec: number
          asset: string
          borrow_rate_at_creation: number
          borrowed_amount_dec: number
          chain: string
          created_at: string
          id: string
          last_interest_update: string
          rate_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accrued_interest_dec?: number
          asset: string
          borrow_rate_at_creation?: number
          borrowed_amount_dec?: number
          chain?: string
          created_at?: string
          id?: string
          last_interest_update?: string
          rate_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accrued_interest_dec?: number
          asset?: string
          borrow_rate_at_creation?: number
          borrowed_amount_dec?: number
          chain?: string
          created_at?: string
          id?: string
          last_interest_update?: string
          rate_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_health_factors: {
        Row: {
          available_borrow_usd: number
          chain: string
          health_factor: number
          id: string
          last_calculated_at: string
          liquidation_threshold: number
          ltv: number
          total_collateral_usd: number
          total_debt_usd: number
          user_id: string
        }
        Insert: {
          available_borrow_usd?: number
          chain?: string
          health_factor: number
          id?: string
          last_calculated_at?: string
          liquidation_threshold?: number
          ltv?: number
          total_collateral_usd?: number
          total_debt_usd?: number
          user_id: string
        }
        Update: {
          available_borrow_usd?: number
          chain?: string
          health_factor?: number
          id?: string
          last_calculated_at?: string
          liquidation_threshold?: number
          ltv?: number
          total_collateral_usd?: number
          total_debt_usd?: number
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
      user_supplies: {
        Row: {
          accrued_interest_dec: number
          asset: string
          chain: string
          created_at: string
          id: string
          last_interest_update: string
          supplied_amount_dec: number
          supply_rate_at_deposit: number
          updated_at: string
          used_as_collateral: boolean
          user_id: string
        }
        Insert: {
          accrued_interest_dec?: number
          asset: string
          chain?: string
          created_at?: string
          id?: string
          last_interest_update?: string
          supplied_amount_dec?: number
          supply_rate_at_deposit?: number
          updated_at?: string
          used_as_collateral?: boolean
          user_id: string
        }
        Update: {
          accrued_interest_dec?: number
          asset?: string
          chain?: string
          created_at?: string
          id?: string
          last_interest_update?: string
          supplied_amount_dec?: number
          supply_rate_at_deposit?: number
          updated_at?: string
          used_as_collateral?: boolean
          user_id?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assign_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      admin_get_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_get_fee_analytics: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      admin_get_fee_analytics_with_chains: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      admin_get_users: {
        Args: Record<PropertyKey, never>
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
      can_access_sensitive_pii: {
        Args: { target_user_id: string; user_uuid: string }
        Returns: boolean
      }
      check_pii_rate_limit: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      create_security_alert: {
        Args: { alert_type: string; details?: Json; severity?: string }
        Returns: undefined
      }
      encrypt_sensitive_field: {
        Args: { input_text: string }
        Returns: string
      }
      execute_transaction: {
        Args: { payment_method_param?: string; quote_id_param: string }
        Returns: Json
      }
      get_encrypted_profile_field: {
        Args: { field_name: string; target_user_id?: string }
        Returns: string
      }
      get_public_config: {
        Args: { key_name: string }
        Returns: string
      }
      get_secure_profile: {
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
          kyc_rejection_reason: string
          kyc_status: string
          kyc_submitted_at: string
          kyc_verified_at: string
          last_name: string
          phone: string
          ssn_last_four: string
          state: string
          updated_at: string
          zip_code: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      is_kyc_verified: {
        Args: { user_uuid: string }
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
      log_profile_access: {
        Args: { accessed_fields: string[]; target_user_id: string }
        Returns: undefined
      }
      log_security_event: {
        Args: { event_data?: Json; event_type: string }
        Returns: undefined
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
      mask_address: {
        Args: { address_value: string }
        Returns: string
      }
      mask_phone: {
        Args: { phone_value: string }
        Returns: string
      }
      mask_ssn: {
        Args: { ssn_value: string }
        Returns: string
      }
      user_can_see_sensitive_data: {
        Args: Record<PropertyKey, never>
        Returns: boolean
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
      lock_status: "active" | "matured" | "exited_early"
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
      lock_status: ["active", "matured", "exited_early"],
    },
  },
} as const
