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
          date_of_birth: string | null
          email: string
          first_name: string | null
          id: string
          kyc_rejection_reason: string | null
          kyc_status: string | null
          kyc_submitted_at: string | null
          kyc_verified_at: string | null
          last_name: string | null
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
          date_of_birth?: string | null
          email: string
          first_name?: string | null
          id: string
          kyc_rejection_reason?: string | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          last_name?: string | null
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
          date_of_birth?: string | null
          email?: string
          first_name?: string | null
          id?: string
          kyc_rejection_reason?: string | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          kyc_verified_at?: string | null
          last_name?: string | null
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
      execute_transaction: {
        Args: { payment_method_param?: string; quote_id_param: string }
        Returns: Json
      }
      get_public_config: {
        Args: { key_name: string }
        Returns: string
      }
    }
    Enums: {
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
      lock_status: ["active", "matured", "exited_early"],
    },
  },
} as const
