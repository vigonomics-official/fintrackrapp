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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          month: string
          monthly_limit: number
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          month: string
          monthly_limit: number
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          month?: string
          monthly_limit?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_default: boolean
          name: string
          parent_id: string | null
          type: Database["public"]["Enums"]["category_type"]
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name: string
          parent_id?: string | null
          type: Database["public"]["Enums"]["category_type"]
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          name?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["category_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      import_errors: {
        Row: {
          created_at: string
          id: string
          import_id: string
          raw_data: Json | null
          reason: string
          row_number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          import_id: string
          raw_data?: Json | null
          reason: string
          row_number: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          import_id?: string
          raw_data?: Json | null
          reason?: string
          row_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "import_history"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          created_at: string
          duplicate_count: number
          error_count: number
          error_message: string | null
          file_name: string
          file_type: string
          id: string
          imported_count: number
          source: string
          status: string
          total_amount: number
          total_rows: number
          user_id: string
        }
        Insert: {
          created_at?: string
          duplicate_count?: number
          error_count?: number
          error_message?: string | null
          file_name: string
          file_type: string
          id?: string
          imported_count?: number
          source?: string
          status?: string
          total_amount?: number
          total_rows?: number
          user_id: string
        }
        Update: {
          created_at?: string
          duplicate_count?: number
          error_count?: number
          error_message?: string | null
          file_name?: string
          file_type?: string
          id?: string
          imported_count?: number
          source?: string
          status?: string
          total_amount?: number
          total_rows?: number
          user_id?: string
        }
        Relationships: []
      }
      loan_payments: {
        Row: {
          created_at: string
          id: string
          loan_id: string
          payment_amount: number
          payment_date: string
          payment_status: Database["public"]["Enums"]["loan_payment_status"]
          remaining_balance: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          loan_id: string
          payment_amount: number
          payment_date?: string
          payment_status?: Database["public"]["Enums"]["loan_payment_status"]
          remaining_balance: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          loan_id?: string
          payment_amount?: number
          payment_date?: string
          payment_status?: Database["public"]["Enums"]["loan_payment_status"]
          remaining_balance?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          created_at: string
          due_day: number
          emi_amount: number
          id: string
          interest_rate: number
          loan_name: string
          loan_type: Database["public"]["Enums"]["loan_type"]
          notes: string | null
          remaining_balance: number
          start_date: string
          tenure_months: number
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_day?: number
          emi_amount: number
          id?: string
          interest_rate?: number
          loan_name: string
          loan_type?: Database["public"]["Enums"]["loan_type"]
          notes?: string | null
          remaining_balance: number
          start_date?: string
          tenure_months: number
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_day?: number
          emi_amount?: number
          id?: string
          interest_rate?: number
          loan_name?: string
          loan_type?: Database["public"]["Enums"]["loan_type"]
          notes?: string | null
          remaining_balance?: number
          start_date?: string
          tenure_months?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_loans: number | null
          age_group: string | null
          avatar_url: string | null
          city: string | null
          created_at: string
          currency: string
          email: string | null
          expense_categories: string[] | null
          financial_situation: string | null
          first_goal: Json | null
          full_name: string | null
          id: string
          monthly_emi: number | null
          monthly_salary: number | null
          name: string | null
          onboarding_completed: boolean
          salary_date: number | null
          updated_at: string
        }
        Insert: {
          active_loans?: number | null
          age_group?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          expense_categories?: string[] | null
          financial_situation?: string | null
          first_goal?: Json | null
          full_name?: string | null
          id: string
          monthly_emi?: number | null
          monthly_salary?: number | null
          name?: string | null
          onboarding_completed?: boolean
          salary_date?: number | null
          updated_at?: string
        }
        Update: {
          active_loans?: number | null
          age_group?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          expense_categories?: string[] | null
          financial_situation?: string | null
          first_goal?: Json | null
          full_name?: string | null
          id?: string
          monthly_emi?: number | null
          monthly_salary?: number | null
          name?: string | null
          onboarding_completed?: boolean
          salary_date?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          subcategory: string | null
          tags: string[]
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          subcategory?: string | null
          tags?: string[]
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          subcategory?: string | null
          tags?: string[]
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      category_type: "income" | "expense"
      loan_payment_status: "paid" | "pending" | "missed"
      loan_type:
        | "home"
        | "personal"
        | "vehicle"
        | "education"
        | "gold"
        | "credit_card"
        | "informal"
        | "other"
      payment_method:
        | "cash"
        | "bank"
        | "upi"
        | "credit_card"
        | "debit_card"
        | "wallet"
      transaction_type: "income" | "expense" | "transfer"
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
      category_type: ["income", "expense"],
      loan_payment_status: ["paid", "pending", "missed"],
      loan_type: [
        "home",
        "personal",
        "vehicle",
        "education",
        "gold",
        "credit_card",
        "informal",
        "other",
      ],
      payment_method: [
        "cash",
        "bank",
        "upi",
        "credit_card",
        "debit_card",
        "wallet",
      ],
      transaction_type: ["income", "expense", "transfer"],
    },
  },
} as const
