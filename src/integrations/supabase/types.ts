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
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          kyc_status: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          kyc_status?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          kyc_status?: string | null
          phone?: string | null
          updated_at?: string
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
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
