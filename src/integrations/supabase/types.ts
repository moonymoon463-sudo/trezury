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
      auth_attempts: {
        Row: {
          attempted_at: string | null
          email: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          success: boolean | null
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string | null
          email: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          success?: boolean | null
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string | null
          email?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          success?: boolean | null
          user_agent?: string | null
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
        ]
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
          created_with_password: boolean | null
          id: string
          setup_method: string | null
          user_id: string
        }
        Insert: {
          address: string
          asset?: string
          chain?: string
          created_at?: string
          created_with_password?: boolean | null
          id?: string
          setup_method?: string | null
          user_id: string
        }
        Update: {
          address?: string
          asset?: string
          chain?: string
          created_at?: string
          created_with_password?: boolean | null
          id?: string
          setup_method?: string | null
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
          city: string | null
          country: string | null
          created_at: string
          data_classification: string | null
          date_of_birth: string | null
          dob_encrypted: string | null
          email: string
          encryption_metadata: Json | null
          first_name: string | null
          id: string
          kyc_rejection_reason: string | null
          kyc_status: string | null
          kyc_submitted_at: string | null
          kyc_verified_at: string | null
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
          city?: string | null
          country?: string | null
          created_at?: string
          data_classification?: string | null
          date_of_birth?: string | null
          dob_encrypted?: string | null
          email: string
          encryption_metadata?: Json | null
          first_name?: string | null
          id: string
          kyc_rejection_reason?: string | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
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
          city?: string | null
          country?: string | null
          created_at?: string
          data_classification?: string | null
          date_of_birth?: string | null
          dob_encrypted?: string | null
          email?: string
          encryption_metadata?: Json | null
          first_name?: string | null
          id?: string
          kyc_rejection_reason?: string | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
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
        ]
      }
      real_time_security_events: {
        Row: {
          created_at: string | null
          detected_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
        ]
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
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
        ]
      }
      session_security: {
        Row: {
          created_at: string | null
          device_fingerprint: string | null
          id: string
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
        ]
      }
      wallet_security_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
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
        ]
      }
      webhook_processing_log: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          ip_address: unknown | null
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
          ip_address?: unknown | null
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
          ip_address?: unknown | null
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
      admin_get_security_overview: {
        Args: Record<PropertyKey, never>
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
      check_extension_security: {
        Args: Record<PropertyKey, never>
        Returns: {
          extension_name: string
          schema_name: string
          security_status: string
        }[]
      }
      check_pii_rate_limit: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      check_transaction_access_rate_limit: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_transaction_velocity: {
        Args: { p_amount: number; p_user_id: string }
        Returns: Json
      }
      cleanup_old_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      collect_gold_prices: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      create_security_alert: {
        Args: { alert_type: string; details?: Json; severity?: string }
        Returns: undefined
      }
      decrypt_pii: {
        Args: {
          encrypted_data: string
          field_name: string
          target_user_id: string
        }
        Returns: string
      }
      emergency_pii_lockdown_active: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      emergency_transaction_lockdown: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      encrypt_pii: {
        Args: { field_name: string; plaintext: string }
        Returns: string
      }
      encrypt_sensitive_field: {
        Args: { input_text: string }
        Returns: string
      }
      execute_transaction: {
        Args: { payment_method_param?: string; quote_id_param: string }
        Returns: Json
      }
      get_cron_secret: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_gold_price_cron_status: {
        Args: Record<PropertyKey, never>
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
        Args: Record<PropertyKey, never>
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
      get_public_config: {
        Args: { key_name: string }
        Returns: string
      }
      get_security_dashboard_metrics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_security_metrics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_system_health_metrics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_email: {
        Args: { _user_id: string }
        Returns: string
      }
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
      is_account_locked: {
        Args: { p_email: string }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id?: string }
        Returns: boolean
      }
      is_institutional_admin: {
        Args: { _account_id: string; _user_id: string }
        Returns: boolean
      }
      is_kyc_verified: {
        Args: { user_uuid: string }
        Returns: boolean
      }
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
      mask_address: {
        Args: { address_value: string }
        Returns: string
      }
      mask_email: {
        Args: { email_value: string }
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
      monitor_system_health: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
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
      test_gold_price_collection: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      trigger_financial_news_collection: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      trigger_gold_price_collection: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
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
