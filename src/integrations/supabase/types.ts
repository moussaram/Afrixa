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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      commission_splits: {
        Row: {
          afrixa_amount: number
          created_at: string
          id: string
          seller_amount: number
          split_rate: number
          split_type: string
          status: string
          transaction_id: string
        }
        Insert: {
          afrixa_amount: number
          created_at?: string
          id?: string
          seller_amount: number
          split_rate: number
          split_type?: string
          status?: string
          transaction_id: string
        }
        Update: {
          afrixa_amount?: number
          created_at?: string
          id?: string
          seller_amount?: number
          split_rate?: number
          split_type?: string
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          rate: number
          status: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          rate: number
          status?: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          rate?: number
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          last_sender_id: string | null
          participant_1: string
          participant_2: string
          unread_count_1: number
          unread_count_2: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          last_sender_id?: string | null
          participant_1: string
          participant_2: string
          unread_count_1?: number
          unread_count_2?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          last_sender_id?: string | null
          participant_1?: string
          participant_2?: string
          unread_count_1?: number
          unread_count_2?: number
        }
        Relationships: []
      }
      disputes: {
        Row: {
          admin_decision: string | null
          buyer_evidence: string | null
          buyer_id: string
          created_at: string
          id: string
          order_id: string
          reason: string
          seller_evidence: string | null
          seller_id: string
          status: string
        }
        Insert: {
          admin_decision?: string | null
          buyer_evidence?: string | null
          buyer_id: string
          created_at?: string
          id?: string
          order_id: string
          reason: string
          seller_evidence?: string | null
          seller_id: string
          status?: string
        }
        Update: {
          admin_decision?: string | null
          buyer_evidence?: string | null
          buyer_id?: string
          created_at?: string
          id?: string
          order_id?: string
          reason?: string
          seller_evidence?: string | null
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      help_messages: {
        Row: {
          admin_reply: string | null
          category: string
          created_at: string
          id: string
          message: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          is_deleted: boolean
          is_read: boolean
          media_url: string | null
          product_id: string | null
          sender_id: string
          type: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          media_url?: string | null
          product_id?: string | null
          sender_id: string
          type?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          media_url?: string | null
          product_id?: string | null
          sender_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          order_id: string | null
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          order_id?: string | null
          reference_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          order_id?: string | null
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_timeline: {
        Row: {
          created_at: string
          id: string
          message: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          auto_confirm_date: string | null
          buyer_id: string
          buyer_note: string | null
          buyer_phone: string | null
          commission_amount: number
          commission_rate: number
          created_at: string
          delivery_address: string | null
          dispute_reason: string | null
          escrow_released: boolean
          id: string
          payment_operator: string | null
          payment_reference: string | null
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number
          seller_amount: number
          seller_id: string
          status: string
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          auto_confirm_date?: string | null
          buyer_id: string
          buyer_note?: string | null
          buyer_phone?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          delivery_address?: string | null
          dispute_reason?: string | null
          escrow_released?: boolean
          id?: string
          payment_operator?: string | null
          payment_reference?: string | null
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity?: number
          seller_amount?: number
          seller_id: string
          status?: string
          total_price: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          auto_confirm_date?: string | null
          buyer_id?: string
          buyer_note?: string | null
          buyer_phone?: string | null
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          delivery_address?: string | null
          dispute_reason?: string | null
          escrow_released?: boolean
          id?: string
          payment_operator?: string | null
          payment_reference?: string | null
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number
          seller_amount?: number
          seller_id?: string
          status?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          buyer_phone: string | null
          commission_amount: number
          created_at: string
          currency: string
          escrow_status: string
          flutterwave_ref: string
          flutterwave_response: Json | null
          flutterwave_tx_id: string | null
          id: string
          operator: string | null
          order_id: string
          seller_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_phone?: string | null
          commission_amount?: number
          created_at?: string
          currency?: string
          escrow_status?: string
          flutterwave_ref: string
          flutterwave_response?: Json | null
          flutterwave_tx_id?: string | null
          id?: string
          operator?: string | null
          order_id: string
          seller_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_phone?: string | null
          commission_amount?: number
          created_at?: string
          currency?: string
          escrow_status?: string
          flutterwave_ref?: string
          flutterwave_response?: Json | null
          flutterwave_tx_id?: string | null
          id?: string
          operator?: string | null
          order_id?: string
          seller_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          city: string | null
          country: string | null
          created_at: string
          delivery_delay: string | null
          delivery_fee: number | null
          description: string | null
          group_duration: string | null
          group_price_10: number | null
          group_price_5: number | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          is_group_buy: boolean | null
          name: string
          price: number
          promo_price: number | null
          sales_count: number | null
          seller_id: string
          stock: number | null
          unlimited_stock: boolean | null
          updated_at: string
          views_count: number | null
        }
        Insert: {
          category: string
          city?: string | null
          country?: string | null
          created_at?: string
          delivery_delay?: string | null
          delivery_fee?: number | null
          description?: string | null
          group_duration?: string | null
          group_price_10?: number | null
          group_price_5?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_group_buy?: boolean | null
          name: string
          price: number
          promo_price?: number | null
          sales_count?: number | null
          seller_id: string
          stock?: number | null
          unlimited_stock?: boolean | null
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          category?: string
          city?: string | null
          country?: string | null
          created_at?: string
          delivery_delay?: string | null
          delivery_fee?: number | null
          description?: string | null
          group_duration?: string | null
          group_price_10?: number | null
          group_price_5?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_group_buy?: boolean | null
          name?: string
          price?: number
          promo_price?: number | null
          sales_count?: number | null
          seller_id?: string
          stock?: number | null
          unlimited_stock?: boolean | null
          updated_at?: string
          views_count?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_naissance: string | null
          deuxieme_prenom: string | null
          email_verifie: boolean
          google_id: string | null
          id: string
          inscription_complete: boolean
          lieu_naissance: string | null
          mobile_verifie: boolean
          nationalite: string | null
          nationalite_flag: string | null
          nom: string | null
          numero_mobile: string | null
          prenom: string | null
          profession: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_naissance?: string | null
          deuxieme_prenom?: string | null
          email_verifie?: boolean
          google_id?: string | null
          id?: string
          inscription_complete?: boolean
          lieu_naissance?: string | null
          mobile_verifie?: boolean
          nationalite?: string | null
          nationalite_flag?: string | null
          nom?: string | null
          numero_mobile?: string | null
          prenom?: string | null
          profession?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_naissance?: string | null
          deuxieme_prenom?: string | null
          email_verifie?: boolean
          google_id?: string | null
          id?: string
          inscription_complete?: boolean
          lieu_naissance?: string | null
          mobile_verifie?: boolean
          nationalite?: string | null
          nationalite_flag?: string | null
          nom?: string | null
          numero_mobile?: string | null
          prenom?: string | null
          profession?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          seller_id: string
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          seller_id: string
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          operator: string | null
          order_id: string | null
          payout_reference: string | null
          phone: string | null
          seller_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          operator?: string | null
          order_id?: string | null
          payout_reference?: string | null
          phone?: string | null
          seller_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          operator?: string | null
          order_id?: string | null
          payout_reference?: string | null
          phone?: string | null
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          id: string
          is_typing: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_typing?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_typing?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          id: string
          is_online: boolean
          last_seen: string
          user_id: string
        }
        Insert: {
          id?: string
          is_online?: boolean
          last_seen?: string
          user_id: string
        }
        Update: {
          id?: string
          is_online?: boolean
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
