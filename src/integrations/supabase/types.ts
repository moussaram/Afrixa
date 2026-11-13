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
      ad_campaigns: {
        Row: {
          advertiser_email: string
          advertiser_name: string
          budget: number
          clicks: number | null
          cpc: number | null
          created_at: string | null
          cta_text: string | null
          cta_url: string | null
          description: string | null
          ends_at: string | null
          id: string
          impressions: number | null
          media_type: string | null
          media_url: string
          spent: number | null
          starts_at: string | null
          status: string | null
          target_age_max: number | null
          target_age_min: number | null
          target_countries: string[] | null
          target_interests: string[] | null
          title: string
        }
        Insert: {
          advertiser_email: string
          advertiser_name: string
          budget: number
          clicks?: number | null
          cpc?: number | null
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          impressions?: number | null
          media_type?: string | null
          media_url: string
          spent?: number | null
          starts_at?: string | null
          status?: string | null
          target_age_max?: number | null
          target_age_min?: number | null
          target_countries?: string[] | null
          target_interests?: string[] | null
          title: string
        }
        Update: {
          advertiser_email?: string
          advertiser_name?: string
          budget?: number
          clicks?: number | null
          cpc?: number | null
          created_at?: string | null
          cta_text?: string | null
          cta_url?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          impressions?: number | null
          media_type?: string | null
          media_url?: string
          spent?: number | null
          starts_at?: string | null
          status?: string | null
          target_age_max?: number | null
          target_age_min?: number | null
          target_countries?: string[] | null
          target_interests?: string[] | null
          title?: string
        }
        Relationships: []
      }
      ad_impressions: {
        Row: {
          campaign_id: string | null
          clicked: boolean | null
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          clicked?: boolean | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          clicked?: boolean | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_impressions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      afrixa_coins: {
        Row: {
          balance: number | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          balance?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          balance?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      banned_words: {
        Row: {
          id: string
          language: string | null
          severity: string | null
          word: string
        }
        Insert: {
          id?: string
          language?: string | null
          severity?: string | null
          word: string
        }
        Update: {
          id?: string
          language?: string | null
          severity?: string | null
          word?: string
        }
        Relationships: []
      }
      challenge_submissions: {
        Row: {
          challenge_id: string | null
          created_at: string | null
          id: string
          is_winner: boolean | null
          rank: number | null
          user_id: string | null
          video_id: string | null
          votes: number | null
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string | null
          id?: string
          is_winner?: boolean | null
          rank?: number | null
          user_id?: string | null
          video_id?: string | null
          votes?: number | null
        }
        Update: {
          challenge_id?: string | null
          created_at?: string | null
          id?: string
          is_winner?: boolean | null
          rank?: number | null
          user_id?: string | null
          video_id?: string | null
          votes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_submissions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          cover_image: string | null
          created_at: string | null
          description: string | null
          ends_at: string | null
          hashtag: string
          id: string
          participants_count: number | null
          prize_amount: number | null
          prize_description: string | null
          sponsor_logo: string | null
          sponsor_name: string | null
          starts_at: string | null
          status: string | null
          title: string
          views_count: number | null
        }
        Insert: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          hashtag: string
          id?: string
          participants_count?: number | null
          prize_amount?: number | null
          prize_description?: string | null
          sponsor_logo?: string | null
          sponsor_name?: string | null
          starts_at?: string | null
          status?: string | null
          title: string
          views_count?: number | null
        }
        Update: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          hashtag?: string
          id?: string
          participants_count?: number | null
          prize_amount?: number | null
          prize_description?: string | null
          sponsor_logo?: string | null
          sponsor_name?: string | null
          starts_at?: string | null
          status?: string | null
          title?: string
          views_count?: number | null
        }
        Relationships: []
      }
      coin_balances: {
        Row: {
          balance: number
          lifetime_earned: number
          lifetime_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          lifetime_earned?: number
          lifetime_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_purchases: {
        Row: {
          coins_amount: number
          created_at: string | null
          fcfa_paid: number
          fedapay_ref: string | null
          id: string
          operator: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          coins_amount: number
          created_at?: string | null
          fcfa_paid: number
          fedapay_ref?: string | null
          id?: string
          operator: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          coins_amount?: number
          created_at?: string | null
          fcfa_paid?: number
          fedapay_ref?: string | null
          id?: string
          operator?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      collab_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          receiver_id: string | null
          sender_id: string | null
          status: string | null
          type: string
          video_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          status?: string | null
          type: string
          video_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          status?: string | null
          type?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collab_requests_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_videos: {
        Row: {
          created_at: string | null
          creator_1: string | null
          creator_2: string | null
          id: string
          revenue_split: number | null
          type: string | null
          video_id: string | null
        }
        Insert: {
          created_at?: string | null
          creator_1?: string | null
          creator_2?: string | null
          id?: string
          revenue_split?: number | null
          type?: string | null
          video_id?: string | null
        }
        Update: {
          created_at?: string | null
          creator_1?: string | null
          creator_2?: string | null
          id?: string
          revenue_split?: number | null
          type?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collab_videos_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          mentioned_user_id: string | null
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          mentioned_user_id?: string | null
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          mentioned_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_deleted: boolean | null
          is_pinned: boolean | null
          likes_count: number | null
          parent_id: string | null
          replies_count: number | null
          user_id: string
          video_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          likes_count?: number | null
          parent_id?: string | null
          replies_count?: number | null
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_pinned?: boolean | null
          likes_count?: number | null
          parent_id?: string | null
          replies_count?: number | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
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
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          description: string | null
          id: string
          reason: string
          reporter_id: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: []
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
      creator_earnings: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          period_end: string | null
          period_start: string | null
          status: string | null
          type: string
          user_id: string | null
          video_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          type: string
          user_id?: string | null
          video_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          status?: string | null
          type?: string
          user_id?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_earnings_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_program: {
        Row: {
          followers_at_join: number | null
          id: string
          is_active: boolean | null
          joined_at: string | null
          level: string | null
          user_id: string | null
        }
        Insert: {
          followers_at_join?: number | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          level?: string | null
          user_id?: string | null
        }
        Update: {
          followers_at_join?: number | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          level?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      creator_wallet: {
        Row: {
          balance: number | null
          id: string
          pending: number | null
          total_earned: number | null
          updated_at: string | null
          user_id: string | null
          withdrawal_operator: string | null
          withdrawal_phone: string | null
        }
        Insert: {
          balance?: number | null
          id?: string
          pending?: number | null
          total_earned?: number | null
          updated_at?: string | null
          user_id?: string | null
          withdrawal_operator?: string | null
          withdrawal_phone?: string | null
        }
        Update: {
          balance?: number | null
          id?: string
          pending?: number | null
          total_earned?: number | null
          updated_at?: string | null
          user_id?: string | null
          withdrawal_operator?: string | null
          withdrawal_phone?: string | null
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
      fan_club_memberships: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          fan_club_id: string | null
          fedapay_subscription_id: string | null
          id: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          fan_club_id?: string | null
          fedapay_subscription_id?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          fan_club_id?: string | null
          fedapay_subscription_id?: string | null
          id?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fan_club_memberships_fan_club_id_fkey"
            columns: ["fan_club_id"]
            isOneToOne: false
            referencedRelation: "fan_clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_clubs: {
        Row: {
          created_at: string | null
          creator_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          members_count: number | null
          name: string | null
          perks: string[] | null
          price_monthly: number
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          members_count?: number | null
          name?: string | null
          perks?: string[] | null
          price_monthly: number
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          members_count?: number | null
          name?: string | null
          perks?: string[] | null
          price_monthly?: number
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          created_at: string | null
          id: string
          requester_id: string | null
          status: string | null
          target_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          requester_id?: string | null
          status?: string | null
          target_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          requester_id?: string | null
          status?: string | null
          target_id?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      gift_transactions: {
        Row: {
          coins_spent: number
          created_at: string | null
          fcfa_earned: number
          gift_id: string | null
          id: string
          live_id: string | null
          receiver_id: string | null
          sender_id: string | null
        }
        Insert: {
          coins_spent: number
          created_at?: string | null
          fcfa_earned: number
          gift_id?: string | null
          id?: string
          live_id?: string | null
          receiver_id?: string | null
          sender_id?: string | null
        }
        Update: {
          coins_spent?: number
          created_at?: string | null
          fcfa_earned?: number
          gift_id?: string | null
          id?: string
          live_id?: string | null
          receiver_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "virtual_gifts"
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
      live_sessions: {
        Row: {
          agora_channel: string
          cover_image: string | null
          created_at: string
          ended_at: string | null
          host_id: string
          id: string
          peak_viewers: number
          pinned_product_id: string | null
          privacy: string
          replay_video_id: string | null
          started_at: string
          status: string
          title: string
          viewers_count: number
        }
        Insert: {
          agora_channel: string
          cover_image?: string | null
          created_at?: string
          ended_at?: string | null
          host_id: string
          id?: string
          peak_viewers?: number
          pinned_product_id?: string | null
          privacy?: string
          replay_video_id?: string | null
          started_at?: string
          status?: string
          title?: string
          viewers_count?: number
        }
        Update: {
          agora_channel?: string
          cover_image?: string | null
          created_at?: string
          ended_at?: string | null
          host_id?: string
          id?: string
          peak_viewers?: number
          pinned_product_id?: string | null
          privacy?: string
          replay_video_id?: string | null
          started_at?: string
          status?: string
          title?: string
          viewers_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_pinned_product_id_fkey"
            columns: ["pinned_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_replay_video_id_fkey"
            columns: ["replay_video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          device_name: string | null
          id: string
          ip_address: unknown
          is_suspicious: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_name?: string | null
          id?: string
          ip_address?: unknown
          is_suspicious?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_name?: string | null
          id?: string
          ip_address?: unknown
          is_suspicious?: boolean | null
          user_agent?: string | null
          user_id?: string | null
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
      moderation_actions: {
        Row: {
          action_type: string
          admin_id: string | null
          content_id: string | null
          content_type: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          reason: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          reason: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          comments_enabled: boolean
          follows_enabled: boolean
          likes_enabled: boolean
          lives_enabled: boolean
          messages_enabled: boolean
          orders_enabled: boolean
          promotions_enabled: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_enabled?: boolean
          follows_enabled?: boolean
          likes_enabled?: boolean
          lives_enabled?: boolean
          messages_enabled?: boolean
          orders_enabled?: boolean
          promotions_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_enabled?: boolean
          follows_enabled?: boolean
          likes_enabled?: boolean
          lives_enabled?: boolean
          messages_enabled?: boolean
          orders_enabled?: boolean
          promotions_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          delivery_lat: number | null
          delivery_lng: number | null
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
          delivery_lat?: number | null
          delivery_lng?: number | null
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
          delivery_lat?: number | null
          delivery_lng?: number | null
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
          fedapay_payment_ref: string | null
          fedapay_ref: string
          fedapay_response: Json | null
          fedapay_transaction_id: string | null
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
          fedapay_payment_ref?: string | null
          fedapay_ref: string
          fedapay_response?: Json | null
          fedapay_transaction_id?: string | null
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
          fedapay_payment_ref?: string | null
          fedapay_ref?: string
          fedapay_response?: Json | null
          fedapay_transaction_id?: string | null
          id?: string
          operator?: string | null
          order_id?: string
          seller_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      premium_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          fedapay_sub_id: string | null
          id: string
          plan: string | null
          price: number
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          fedapay_sub_id?: string | null
          id?: string
          plan?: string | null
          price: number
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          fedapay_sub_id?: string | null
          id?: string
          plan?: string | null
          price?: number
          status?: string | null
          user_id?: string | null
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
      profile_analytics: {
        Row: {
          followers_count: number | null
          following_count: number | null
          id: string
          lost_followers: number | null
          new_followers: number | null
          profile_visits: number | null
          recorded_date: string | null
          total_likes: number | null
          total_views: number | null
          user_id: string | null
        }
        Insert: {
          followers_count?: number | null
          following_count?: number | null
          id?: string
          lost_followers?: number | null
          new_followers?: number | null
          profile_visits?: number | null
          recorded_date?: string | null
          total_likes?: number | null
          total_views?: number | null
          user_id?: string | null
        }
        Update: {
          followers_count?: number | null
          following_count?: number | null
          id?: string
          lost_followers?: number | null
          new_followers?: number | null
          profile_visits?: number | null
          recorded_date?: string | null
          total_likes?: number | null
          total_views?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allow_duet: boolean | null
          allow_stitch: boolean | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_naissance: string | null
          deuxieme_prenom: string | null
          email_verifie: boolean
          google_id: string | null
          id: string
          inscription_complete: boolean
          is_premium: boolean | null
          is_private: boolean | null
          lieu_naissance: string | null
          mobile_verifie: boolean
          nationalite: string | null
          nationalite_flag: string | null
          nom: string | null
          numero_mobile: string | null
          numero_mobile_operateur: string | null
          premium_expires_at: string | null
          prenom: string | null
          profession: string | null
          updated_at: string
          user_id: string
          username: string | null
          who_can_comment: string | null
          who_can_message: string | null
        }
        Insert: {
          allow_duet?: boolean | null
          allow_stitch?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_naissance?: string | null
          deuxieme_prenom?: string | null
          email_verifie?: boolean
          google_id?: string | null
          id?: string
          inscription_complete?: boolean
          is_premium?: boolean | null
          is_private?: boolean | null
          lieu_naissance?: string | null
          mobile_verifie?: boolean
          nationalite?: string | null
          nationalite_flag?: string | null
          nom?: string | null
          numero_mobile?: string | null
          numero_mobile_operateur?: string | null
          premium_expires_at?: string | null
          prenom?: string | null
          profession?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          who_can_comment?: string | null
          who_can_message?: string | null
        }
        Update: {
          allow_duet?: boolean | null
          allow_stitch?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_naissance?: string | null
          deuxieme_prenom?: string | null
          email_verifie?: boolean
          google_id?: string | null
          id?: string
          inscription_complete?: boolean
          is_premium?: boolean | null
          is_private?: boolean | null
          lieu_naissance?: string | null
          mobile_verifie?: boolean
          nationalite?: string | null
          nationalite_flag?: string | null
          nom?: string | null
          numero_mobile?: string | null
          numero_mobile_operateur?: string | null
          premium_expires_at?: string | null
          prenom?: string | null
          profession?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          who_can_comment?: string | null
          who_can_message?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number | null
          id: string
          user_id: string | null
          window_start: string | null
        }
        Insert: {
          action: string
          count?: number | null
          id?: string
          user_id?: string | null
          window_start?: string | null
        }
        Update: {
          action?: string
          count?: number | null
          id?: string
          user_id?: string | null
          window_start?: string | null
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
          fedapay_response: Json | null
          fedapay_transfer_id: string | null
          fedapay_transfer_ref: string | null
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
          fedapay_response?: Json | null
          fedapay_transfer_id?: string | null
          fedapay_transfer_ref?: string | null
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
          fedapay_response?: Json | null
          fedapay_transfer_id?: string | null
          fedapay_transfer_ref?: string | null
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
      series: {
        Row: {
          category: string | null
          cover_image: string | null
          created_at: string | null
          creator_id: string | null
          description: string | null
          id: string
          is_complete: boolean | null
          subscribers_count: number | null
          title: string
          total_episodes: number | null
        }
        Insert: {
          category?: string | null
          cover_image?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          is_complete?: boolean | null
          subscribers_count?: number | null
          title: string
          total_episodes?: number | null
        }
        Update: {
          category?: string | null
          cover_image?: string | null
          created_at?: string | null
          creator_id?: string | null
          description?: string | null
          id?: string
          is_complete?: boolean | null
          subscribers_count?: number | null
          title?: string
          total_episodes?: number | null
        }
        Relationships: []
      }
      series_episodes: {
        Row: {
          created_at: string | null
          episode_number: number
          id: string
          series_id: string | null
          title: string | null
          video_id: string | null
        }
        Insert: {
          created_at?: string | null
          episode_number: number
          id?: string
          series_id?: string | null
          title?: string | null
          video_id?: string | null
        }
        Update: {
          created_at?: string | null
          episode_number?: number
          id?: string
          series_id?: string | null
          title?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_episodes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      series_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          series_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          series_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          series_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_subscriptions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      sounds: {
        Row: {
          artist: string | null
          audio_url: string
          category: string | null
          cover_url: string | null
          created_at: string | null
          creator_id: string | null
          duration: number | null
          id: string
          is_trending: boolean | null
          source_video_id: string | null
          title: string
          type: string | null
          uses_count: number | null
        }
        Insert: {
          artist?: string | null
          audio_url: string
          category?: string | null
          cover_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          duration?: number | null
          id?: string
          is_trending?: boolean | null
          source_video_id?: string | null
          title: string
          type?: string | null
          uses_count?: number | null
        }
        Update: {
          artist?: string | null
          audio_url?: string
          category?: string | null
          cover_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          duration?: number | null
          id?: string
          is_trending?: boolean | null
          source_video_id?: string | null
          title?: string
          type?: string | null
          uses_count?: number | null
        }
        Relationships: []
      }
      spotlights: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          type: string
          user_id: string | null
          video_id: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          type: string
          user_id?: string | null
          video_id?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          type?: string
          user_id?: string | null
          video_id?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlights_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          background_color: string | null
          created_at: string | null
          duration: number | null
          expires_at: string | null
          id: string
          is_archived: boolean | null
          media_url: string | null
          text_color: string | null
          text_content: string | null
          type: string
          user_id: string | null
          views_count: number | null
        }
        Insert: {
          background_color?: string | null
          created_at?: string | null
          duration?: number | null
          expires_at?: string | null
          id?: string
          is_archived?: boolean | null
          media_url?: string | null
          text_color?: string | null
          text_content?: string | null
          type: string
          user_id?: string | null
          views_count?: number | null
        }
        Update: {
          background_color?: string | null
          created_at?: string | null
          duration?: number | null
          expires_at?: string | null
          id?: string
          is_archived?: boolean | null
          media_url?: string | null
          text_color?: string | null
          text_content?: string | null
          type?: string
          user_id?: string | null
          views_count?: number | null
        }
        Relationships: []
      }
      story_views: {
        Row: {
          id: string
          story_id: string | null
          viewed_at: string | null
          viewer_id: string | null
        }
        Insert: {
          id?: string
          story_id?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Update: {
          id?: string
          story_id?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      super_notifications: {
        Row: {
          created_at: string | null
          creator_id: string | null
          follower_id: string | null
          id: string
          is_active: boolean | null
        }
        Insert: {
          created_at?: string | null
          creator_id?: string | null
          follower_id?: string | null
          id?: string
          is_active?: boolean | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string | null
          follower_id?: string | null
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_fcfa: number
          coins_amount: number | null
          created_at: string
          flw_tx_ref: string | null
          id: string
          metadata: Json
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount_fcfa?: number
          coins_amount?: number | null
          created_at?: string
          flw_tx_ref?: string | null
          id?: string
          metadata?: Json
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount_fcfa?: number
          coins_amount?: number | null
          created_at?: string
          flw_tx_ref?: string | null
          id?: string
          metadata?: Json
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
      user_blocks: {
        Row: {
          blocked_id: string | null
          blocker_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id?: string | null
          blocker_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string | null
          blocker_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      user_fcm_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          categories: string[] | null
          id: string
          not_interested: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categories?: string[] | null
          id?: string
          not_interested?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categories?: string[] | null
          id?: string
          not_interested?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          created_at: string | null
          id: string
          interests: string[] | null
          onboarding_done: boolean | null
          step_completed: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interests?: string[] | null
          onboarding_done?: boolean | null
          step_completed?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interests?: string[] | null
          onboarding_done?: boolean | null
          step_completed?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      user_settings: {
        Row: {
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_analytics: {
        Row: {
          audience_countries: Json | null
          avg_watch_duration: number | null
          comments: number | null
          completion_rate: number | null
          created_at: string | null
          id: string
          likes: number | null
          recorded_date: string | null
          saves: number | null
          shares: number | null
          traffic_source: Json | null
          unique_views: number | null
          user_id: string | null
          video_id: string | null
          views: number | null
        }
        Insert: {
          audience_countries?: Json | null
          avg_watch_duration?: number | null
          comments?: number | null
          completion_rate?: number | null
          created_at?: string | null
          id?: string
          likes?: number | null
          recorded_date?: string | null
          saves?: number | null
          shares?: number | null
          traffic_source?: Json | null
          unique_views?: number | null
          user_id?: string | null
          video_id?: string | null
          views?: number | null
        }
        Update: {
          audience_countries?: Json | null
          avg_watch_duration?: number | null
          comments?: number | null
          completion_rate?: number | null
          created_at?: string | null
          id?: string
          likes?: number | null
          recorded_date?: string | null
          saves?: number | null
          shares?: number | null
          traffic_source?: Json | null
          unique_views?: number | null
          user_id?: string | null
          video_id?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_analytics_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          parent_id: string | null
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          parent_id?: string | null
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          parent_id?: string | null
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_saves: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_saves_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_scores: {
        Row: {
          id: string
          last_calculated: string | null
          score: number | null
          user_id: string
          video_id: string
        }
        Insert: {
          id?: string
          last_calculated?: string | null
          score?: number | null
          user_id: string
          video_id: string
        }
        Update: {
          id?: string
          last_calculated?: string | null
          score?: number | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_scores_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_watch_history: {
        Row: {
          completion_rate: number | null
          id: string
          last_position: number | null
          last_watched_at: string | null
          user_id: string | null
          video_id: string | null
          watch_count: number | null
          watch_duration: number | null
        }
        Insert: {
          completion_rate?: number | null
          id?: string
          last_position?: number | null
          last_watched_at?: string | null
          user_id?: string | null
          video_id?: string | null
          watch_count?: number | null
          watch_duration?: number | null
        }
        Update: {
          completion_rate?: number | null
          id?: string
          last_position?: number | null
          last_watched_at?: string | null
          user_id?: string | null
          video_id?: string | null
          watch_count?: number | null
          watch_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_watch_history_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          allow_download: boolean | null
          allow_duet: boolean | null
          allow_stitch: boolean | null
          audio_track: string | null
          cloudflare_status: string
          cloudflare_uid: string | null
          comments_count: number
          comments_disabled: boolean | null
          cover_timestamp: number | null
          created_at: string
          description: string | null
          duration: number
          episode_number: number | null
          file_size: number | null
          hls_url: string
          id: string
          is_exclusive: boolean | null
          is_published: boolean
          lat: number | null
          likes_count: number
          lng: number | null
          location_name: string | null
          moderation_status: string
          privacy: string
          resolution: string | null
          saves_count: number
          search_vector: unknown
          series_id: string | null
          shares_count: number
          sound_id: string | null
          tagged_products: string[] | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          views_count: number
        }
        Insert: {
          allow_download?: boolean | null
          allow_duet?: boolean | null
          allow_stitch?: boolean | null
          audio_track?: string | null
          cloudflare_status?: string
          cloudflare_uid?: string | null
          comments_count?: number
          comments_disabled?: boolean | null
          cover_timestamp?: number | null
          created_at?: string
          description?: string | null
          duration?: number
          episode_number?: number | null
          file_size?: number | null
          hls_url: string
          id?: string
          is_exclusive?: boolean | null
          is_published?: boolean
          lat?: number | null
          likes_count?: number
          lng?: number | null
          location_name?: string | null
          moderation_status?: string
          privacy?: string
          resolution?: string | null
          saves_count?: number
          search_vector?: unknown
          series_id?: string | null
          shares_count?: number
          sound_id?: string | null
          tagged_products?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          views_count?: number
        }
        Update: {
          allow_download?: boolean | null
          allow_duet?: boolean | null
          allow_stitch?: boolean | null
          audio_track?: string | null
          cloudflare_status?: string
          cloudflare_uid?: string | null
          comments_count?: number
          comments_disabled?: boolean | null
          cover_timestamp?: number | null
          created_at?: string
          description?: string | null
          duration?: number
          episode_number?: number | null
          file_size?: number | null
          hls_url?: string
          id?: string
          is_exclusive?: boolean | null
          is_published?: boolean
          lat?: number | null
          likes_count?: number
          lng?: number | null
          location_name?: string | null
          moderation_status?: string
          privacy?: string
          resolution?: string | null
          saves_count?: number
          search_vector?: unknown
          series_id?: string | null
          shares_count?: number
          sound_id?: string | null
          tagged_products?: string[] | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "videos_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_sound_id_fkey"
            columns: ["sound_id"]
            isOneToOne: false
            referencedRelation: "sounds"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_gifts: {
        Row: {
          animation: string | null
          emoji: string | null
          fcfa_value: number
          id: string
          name: string
          price_coins: number
        }
        Insert: {
          animation?: string | null
          emoji?: string | null
          fcfa_value: number
          id?: string
          name: string
          price_coins: number
        }
        Update: {
          animation?: string | null
          emoji?: string | null
          fcfa_value?: number
          id?: string
          name?: string
          price_coins?: number
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          is_private: boolean
          nom: string | null
          prenom: string | null
          user_id: string
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      refresh_video_scores_batch: {
        Args: {
          p_after_video_id?: string | null
          p_batch_size?: number
        }
        Returns: {
          processed_videos: number
          scored_rows: number
          next_after_video_id: string | null
          has_more: boolean
        }[]
      }
      create_my_order_payment: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_operator: string
          p_phone: string
          p_delivery_address: string
          p_buyer_note?: string | null
          p_delivery_lat?: number | null
          p_delivery_lng?: number | null
          p_idempotency_key?: string | null
        }
        Returns: Json
      }
      confirm_order_payment: {
        Args: {
          p_transaction_id: string
          p_provider_transaction_id: string
          p_provider_response: Json
        }
        Returns: Json
      }
      fail_order_payment: {
        Args: {
          p_transaction_id: string
          p_final_status: string
          p_provider_response: Json
        }
        Returns: Json
      }
      consume_rate_limit: {
        Args: {
          p_action: string
          p_limit: number
          p_user_id: string
          p_window: string
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
