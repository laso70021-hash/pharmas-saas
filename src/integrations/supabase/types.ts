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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_onboarding: {
        Row: {
          created_at: string
          password_required: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          password_required?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          password_required?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_onboarding_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_email_allowlist: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      ai_features: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          action_type: string | null
          category: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          pharmacy_id: string | null
          product_id: string | null
          severity: string | null
          status: string | null
          title: string
        }
        Insert: {
          action_type?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          pharmacy_id?: string | null
          product_id?: string | null
          severity?: string | null
          status?: string | null
          title: string
        }
        Update: {
          action_type?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          pharmacy_id?: string | null
          product_id?: string | null
          severity?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_recommendations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_report_lock: {
        Row: {
          created_at: string
          id: number
          lease_until: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: number
          lease_until?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          lease_until?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_report_preferences: {
        Row: {
          created_at: string
          delivery_hour: number
          enabled: boolean
          frequency: string
          id: string
          language: string
          pause_reason: string | null
          pharmacy_id: string
          recipient_ids: string[]
          topics: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_hour?: number
          enabled?: boolean
          frequency: string
          id?: string
          language?: string
          pause_reason?: string | null
          pharmacy_id: string
          recipient_ids?: string[]
          topics?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_hour?: number
          enabled?: boolean
          frequency?: string
          id?: string
          language?: string
          pause_reason?: string | null
          pharmacy_id?: string
          recipient_ids?: string[]
          topics?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_report_preferences_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_report_runs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          lease_until: string
          period_key: string
          preference_id: string
          recipient_id: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          lease_until?: string
          period_key: string
          preference_id: string
          recipient_id: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          lease_until?: string
          period_key?: string
          preference_id?: string
          recipient_id?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_report_runs_preference_id_fkey"
            columns: ["preference_id"]
            isOneToOne: false
            referencedRelation: "ai_report_preferences"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_request_logs: {
        Row: {
          created_at: string
          execution_time_ms: number | null
          feature_slug: string
          id: string
          pharmacy_id: string | null
          prompt_summary: string | null
          response_summary: string | null
          status: string | null
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          execution_time_ms?: number | null
          feature_slug: string
          id?: string
          pharmacy_id?: string | null
          prompt_summary?: string | null
          response_summary?: string | null
          status?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          execution_time_ms?: number | null
          feature_slug?: string
          id?: string
          pharmacy_id?: string | null
          prompt_summary?: string | null
          response_summary?: string | null
          status?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_request_logs_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_request_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          pharmacy_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          pharmacy_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          pharmacy_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_main: boolean | null
          manager_id: string | null
          name: string
          pharmacy_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_main?: boolean | null
          manager_id?: string | null
          name: string
          pharmacy_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_main?: boolean | null
          manager_id?: string | null
          name?: string
          pharmacy_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      business_document_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          document_id: string
          id: string
          note: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          document_id: string
          id?: string
          note?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          document_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "business_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      business_documents: {
        Row: {
          created_at: string
          created_by: string | null
          customer: Json
          delivery_info: string | null
          discount: number
          doc_number: string
          doc_type: string
          id: string
          items: Json
          notes: string | null
          payment_info: string | null
          pharmacy_id: string
          source_sale_id: string | null
          status: string
          subtotal: number
          tax: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer?: Json
          delivery_info?: string | null
          discount?: number
          doc_number: string
          doc_type: string
          id?: string
          items?: Json
          notes?: string | null
          payment_info?: string | null
          pharmacy_id: string
          source_sale_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer?: Json
          delivery_info?: string | null
          discount?: number
          doc_number?: string
          doc_type?: string
          id?: string
          items?: Json
          notes?: string | null
          payment_info?: string | null
          pharmacy_id?: string
          source_sale_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_documents_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_documents_source_sale_id_fkey"
            columns: ["source_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          pharmacy_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          pharmacy_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          pharmacy_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          business_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          message: string
          phone: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          message: string
          phone?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string
          phone?: string | null
        }
        Relationships: []
      }
      covlo_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "covlo_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "covlo_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      covlo_threads: {
        Row: {
          created_at: string
          id: string
          pharmacy_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pharmacy_id: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          pharmacy_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "covlo_threads_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          allergies: string | null
          chronic_conditions: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          pharmacy_id: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          chronic_conditions?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          pharmacy_id?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          allergies?: string | null
          chronic_conditions?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          pharmacy_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          created_at: string
          destination_address: string
          id: string
          notes: string | null
          pharmacy_id: string
          rider_id: string | null
          sale_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_address: string
          id?: string
          notes?: string | null
          pharmacy_id: string
          rider_id?: string | null
          sale_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_address?: string
          id?: string
          notes?: string | null
          pharmacy_id?: string
          rider_id?: string | null
          sale_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shifts: {
        Row: {
          accepted_at: string | null
          branch_id: string | null
          break_seconds: number
          break_started_at: string | null
          created_at: string
          ended_at: string | null
          extended_minutes: number
          handover_from_shift: string | null
          handover_to: string | null
          id: string
          note: string | null
          pharmacy_id: string
          scheduled_minutes: number
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          branch_id?: string | null
          break_seconds?: number
          break_started_at?: string | null
          created_at?: string
          ended_at?: string | null
          extended_minutes?: number
          handover_from_shift?: string | null
          handover_to?: string | null
          id?: string
          note?: string | null
          pharmacy_id: string
          scheduled_minutes?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          branch_id?: string | null
          break_seconds?: number
          break_started_at?: string | null
          created_at?: string
          ended_at?: string | null
          extended_minutes?: number
          handover_from_shift?: string | null
          handover_to?: string | null
          id?: string
          note?: string | null
          pharmacy_id?: string
          scheduled_minutes?: number
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_handover_from_shift_fkey"
            columns: ["handover_from_shift"]
            isOneToOne: false
            referencedRelation: "employee_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_handover_to_fkey"
            columns: ["handover_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string | null
          id: string
          pharmacy_id: string | null
          recorded_by: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string | null
          id?: string
          pharmacy_id?: string | null
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string | null
          id?: string
          pharmacy_id?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_history: {
        Row: {
          created_at: string
          created_by: string
          error_message: string | null
          failed_count: number
          file_name: string
          fingerprint: string
          id: string
          module: string
          pharmacy_id: string
          status: string
          successful_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          error_message?: string | null
          failed_count?: number
          file_name: string
          fingerprint: string
          id?: string
          module: string
          pharmacy_id: string
          status: string
          successful_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          error_message?: string | null
          failed_count?: number
          file_name?: string
          fingerprint?: string
          id?: string
          module?: string
          pharmacy_id?: string
          status?: string
          successful_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_history_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          batch_number: string
          branch_id: string | null
          cost_per_unit: number | null
          created_at: string
          expiry_date: string
          id: string
          manufacturing_date: string | null
          pharmacy_id: string
          product_id: string
          quantity: number
          received_date: string | null
          updated_at: string
        }
        Insert: {
          batch_number: string
          branch_id?: string | null
          cost_per_unit?: number | null
          created_at?: string
          expiry_date: string
          id?: string
          manufacturing_date?: string | null
          pharmacy_id: string
          product_id: string
          quantity?: number
          received_date?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string
          branch_id?: string | null
          cost_per_unit?: number | null
          created_at?: string
          expiry_date?: string
          id?: string
          manufacturing_date?: string | null
          pharmacy_id?: string
          product_id?: string
          quantity?: number
          received_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          pharmacy_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          pharmacy_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          pharmacy_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacies: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          billing_choice: string
          business_type: string
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          owner_id: string | null
          owner_name: string | null
          phone: string | null
          plan_id: string | null
          registration_number: string | null
          review_note: string | null
          settings: Json | null
          status: Database["public"]["Enums"]["pharmacy_status"] | null
          subscription_ends_at: string | null
          tax_number: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          billing_choice?: string
          business_type?: string
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          plan_id?: string | null
          registration_number?: string | null
          review_note?: string | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["pharmacy_status"] | null
          subscription_ends_at?: string | null
          tax_number?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          billing_choice?: string
          business_type?: string
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          plan_id?: string | null
          registration_number?: string | null
          review_note?: string | null
          settings?: Json | null
          status?: Database["public"]["Enums"]["pharmacy_status"] | null
          subscription_ends_at?: string | null
          tax_number?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_invites: {
        Row: {
          accepted_at: string | null
          branch_id: string | null
          branch_ids: string[] | null
          created_at: string
          email: string
          employment_status: string | null
          full_name: string | null
          id: string
          invited_by: string | null
          job_title: string | null
          pharmacy_id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          staff_id: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          branch_id?: string | null
          branch_ids?: string[] | null
          created_at?: string
          email: string
          employment_status?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          job_title?: string | null
          pharmacy_id: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          staff_id?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          branch_id?: string | null
          branch_ids?: string[] | null
          created_at?: string
          email?: string
          employment_status?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          job_title?: string | null
          pharmacy_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          staff_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_invites_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_invites_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_memberships: {
        Row: {
          branch_id: string | null
          branch_ids: string[] | null
          created_at: string
          employment_status: string | null
          id: string
          is_active: boolean | null
          job_title: string | null
          pharmacy_id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          staff_id: string | null
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          branch_ids?: string[] | null
          created_at?: string
          employment_status?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          pharmacy_id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          staff_id?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string | null
          branch_ids?: string[] | null
          created_at?: string
          employment_status?: string | null
          id?: string
          is_active?: boolean | null
          job_title?: string | null
          pharmacy_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          staff_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_memberships_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          dispensed_at: string | null
          dispensed_by: string | null
          id: string
          items: Json
          notes: string | null
          patient_name: string
          patient_phone: string | null
          pharmacy_id: string
          prescriber: string | null
          review_note: string | null
          sale_id: string | null
          status: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          id?: string
          items?: Json
          notes?: string | null
          patient_name: string
          patient_phone?: string | null
          pharmacy_id: string
          prescriber?: string | null
          review_note?: string | null
          sale_id?: string | null
          status?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          id?: string
          items?: Json
          notes?: string | null
          patient_name?: string
          patient_phone?: string | null
          pharmacy_id?: string
          prescriber?: string | null
          review_note?: string | null
          sale_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand_name: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          dosage_form: string | null
          generic_name: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_prescription_required: boolean | null
          min_stock_level: number | null
          name: string
          packaging: string | null
          pharmacy_id: string | null
          selling_price: number
          sku: string | null
          strength: string | null
          supplier_id: string | null
          unit_of_measurement: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand_name?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dosage_form?: string | null
          generic_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_prescription_required?: boolean | null
          min_stock_level?: number | null
          name: string
          packaging?: string | null
          pharmacy_id?: string | null
          selling_price?: number
          sku?: string | null
          strength?: string | null
          supplier_id?: string | null
          unit_of_measurement?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand_name?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          dosage_form?: string | null
          generic_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_prescription_required?: boolean | null
          min_stock_level?: number | null
          name?: string
          packaging?: string | null
          pharmacy_id?: string | null
          selling_price?: number
          sku?: string | null
          strength?: string | null
          supplier_id?: string | null
          unit_of_measurement?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_order_id: string
          quantity: number
          total_cost: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          order_date: string | null
          order_number: string
          pharmacy_id: string
          received_date: string | null
          status: string | null
          supplier_id: string
          total_amount: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          order_date?: string | null
          order_number: string
          pharmacy_id: string
          received_date?: string | null
          status?: string | null
          supplier_id: string
          total_amount?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          order_date?: string | null
          order_number?: string
          pharmacy_id?: string
          received_date?: string | null
          status?: string | null
          supplier_id?: string
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          product_id: string
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          sale_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          id: string
          paid_at: string
          payment_method: string
          reference_code: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          id?: string
          paid_at?: string
          payment_method: string
          reference_code?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          id?: string
          paid_at?: string
          payment_method?: string
          reference_code?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string | null
          cashier_id: string | null
          created_at: string
          customer_id: string | null
          discount: number | null
          id: string
          invoice_number: string
          is_prescription_sale: boolean | null
          payment_method: string | null
          payment_status: string | null
          pharmacy_id: string
          prescription_notes: string | null
          subtotal: number
          tax: number | null
          total: number
        }
        Insert: {
          branch_id?: string | null
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          id?: string
          invoice_number: string
          is_prescription_sale?: boolean | null
          payment_method?: string | null
          payment_status?: string | null
          pharmacy_id: string
          prescription_notes?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
        }
        Update: {
          branch_id?: string | null
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          id?: string
          invoice_number?: string
          is_prescription_sale?: boolean | null
          payment_method?: string | null
          payment_status?: string | null
          pharmacy_id?: string
          prescription_notes?: string | null
          subtotal?: number
          tax?: number | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          minutes: number | null
          note: string | null
          pharmacy_id: string
          shift_id: string
          target_user: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          minutes?: number | null
          note?: string | null
          pharmacy_id: string
          shift_id: string
          target_user?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          minutes?: number | null
          note?: string | null
          pharmacy_id?: string
          shift_id?: string
          target_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_events_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_events_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "employee_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          message: string
          pharmacy_id: string
          product_id: string | null
          severity: string | null
          status: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          message: string
          pharmacy_id: string
          product_id?: string | null
          severity?: string | null
          status?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          message?: string
          pharmacy_id?: string
          product_id?: string | null
          severity?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          pharmacy_id: string
          product_id: string
          quantity: number
          reference_id: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          pharmacy_id: string
          product_id: string
          quantity: number
          reference_id?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          pharmacy_id?: string
          product_id?: string
          quantity?: number
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount_tzs: number
          created_at: string
          id: string
          method: string
          period_months: number
          pharmacy_id: string
          plan_id: string | null
          receipt_path: string | null
          reference: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
        }
        Insert: {
          amount_tzs?: number
          created_at?: string
          id?: string
          method?: string
          period_months?: number
          pharmacy_id: string
          plan_id?: string | null
          receipt_path?: string | null
          reference?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
        }
        Update: {
          amount_tzs?: number
          created_at?: string
          id?: string
          method?: string
          period_months?: number
          pharmacy_id?: string
          plan_id?: string | null
          receipt_path?: string | null
          reference?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          display_order: number | null
          features: Json | null
          has_advanced_ai_forecasting: boolean | null
          has_ai_insights: boolean | null
          has_bulk_import_ocr: boolean | null
          has_delivery_management: boolean | null
          has_prescription_stt_ttt: boolean | null
          id: string
          is_active: boolean | null
          max_branches: number
          max_employees: number
          name: string
          price_tzs_annual: number
          price_tzs_monthly: number
          slug: string
          support_tier: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          features?: Json | null
          has_advanced_ai_forecasting?: boolean | null
          has_ai_insights?: boolean | null
          has_bulk_import_ocr?: boolean | null
          has_delivery_management?: boolean | null
          has_prescription_stt_ttt?: boolean | null
          id?: string
          is_active?: boolean | null
          max_branches?: number
          max_employees?: number
          name: string
          price_tzs_annual?: number
          price_tzs_monthly?: number
          slug: string
          support_tier?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          features?: Json | null
          has_advanced_ai_forecasting?: boolean | null
          has_ai_insights?: boolean | null
          has_bulk_import_ocr?: boolean | null
          has_delivery_management?: boolean | null
          has_prescription_stt_ttt?: boolean | null
          id?: string
          is_active?: boolean | null
          max_branches?: number
          max_employees?: number
          name?: string
          price_tzs_annual?: number
          price_tzs_monthly?: number
          slug?: string
          support_tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          pharmacy_id: string | null
          phone: string | null
          tax_id: string | null
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          pharmacy_id?: string | null
          phone?: string | null
          tax_id?: string | null
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          pharmacy_id?: string | null
          phone?: string | null
          tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          pharmacy_id: string | null
          priority: string | null
          status: string | null
          subject: string
          ticket_number: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          pharmacy_id?: string | null
          priority?: string | null
          status?: string | null
          subject: string
          ticket_number?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          pharmacy_id?: string | null
          priority?: string | null
          status?: string | null
          subject?: string
          ticket_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_checks: {
        Row: {
          details: string | null
          id: string
          last_checked_at: string
          response_time_ms: number | null
          service_name: string
          status: string
        }
        Insert: {
          details?: string | null
          id?: string
          last_checked_at?: string
          response_time_ms?: number | null
          service_name: string
          status?: string
        }
        Update: {
          details?: string | null
          id?: string
          last_checked_at?: string
          response_time_ms?: number | null
          service_name?: string
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      wholesale_messages: {
        Row: {
          body: string
          buyer_pharmacy_id: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string | null
          sender_side: string
          supplier_id: string
        }
        Insert: {
          body: string
          buyer_pharmacy_id: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string | null
          sender_side: string
          supplier_id: string
        }
        Update: {
          body?: string
          buyer_pharmacy_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string | null
          sender_side?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_messages_buyer_pharmacy_id_fkey"
            columns: ["buyer_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_messages_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_order_allocations: {
        Row: {
          batch_number: string
          created_at: string
          expiry_date: string
          id: string
          item_id: string
          order_id: string
          quantity: number
        }
        Insert: {
          batch_number: string
          created_at?: string
          expiry_date: string
          id?: string
          item_id: string
          order_id: string
          quantity: number
        }
        Update: {
          batch_number?: string
          created_at?: string
          expiry_date?: string
          id?: string
          item_id?: string
          order_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_order_allocations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "wholesale_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_order_allocations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_name: string
          quantity: number
          supplier_product_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_name: string
          quantity: number
          supplier_product_id?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_name?: string
          quantity?: number
          supplier_product_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_order_items_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_orders: {
        Row: {
          branch_id: string | null
          buyer_pharmacy_id: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          delivery_address: string | null
          delivery_note: string | null
          id: string
          order_number: string
          payment_method: string
          payment_reference: string | null
          receipt_path: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          supplier_id: string
          supplier_note: string | null
          total_amount: number
        }
        Insert: {
          branch_id?: string | null
          buyer_pharmacy_id: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          delivery_note?: string | null
          id?: string
          order_number: string
          payment_method: string
          payment_reference?: string | null
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supplier_id: string
          supplier_note?: string | null
          total_amount?: number
        }
        Update: {
          branch_id?: string | null
          buyer_pharmacy_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          delivery_note?: string | null
          id?: string
          order_number?: string
          payment_method?: string
          payment_reference?: string | null
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          supplier_id?: string
          supplier_note?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_orders_buyer_pharmacy_id_fkey"
            columns: ["buyer_pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _invite_id: string }; Returns: string }
      acquire_ai_report_lock: { Args: never; Returns: boolean }
      admin_register_business: { Args: { _payload: Json }; Returns: string }
      admin_set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: undefined
      }
      advance_wholesale_order: {
        Args: { _note: string; _order: string; _status: string }
        Returns: undefined
      }
      can_access_branch: {
        Args: { _branch: string; _pharmacy: string }
        Returns: boolean
      }
      can_write_pharmacy: {
        Args: {
          _pharmacy_id: string
          _roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: boolean
      }
      correct_batch_stock: {
        Args: {
          _batch: string
          _pharmacy: string
          _quantity: number
          _reason: string
        }
        Returns: undefined
      }
      create_business_document: {
        Args: { _payload: Json; _pharmacy: string; _type: string }
        Returns: string
      }
      create_registration: {
        Args: { _payload: Json; _user_id: string }
        Returns: string
      }
      create_sale: {
        Args: {
          _branch: string
          _discount: number
          _items: Json
          _method: string
          _pharmacy: string
          _reference: string
        }
        Returns: string
      }
      extend_trial: {
        Args: { _days: number; _pharmacy_id: string }
        Returns: undefined
      }
      has_pharmacy_role: {
        Args: {
          _pharmacy_id: string
          _roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_business_rows: {
        Args: {
          _file_name: string
          _fingerprint: string
          _module: string
          _pharmacy: string
          _rows: Json
        }
        Returns: Json
      }
      is_pharmacy_owner: { Args: { _pharmacy_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      my_invitations: {
        Args: never
        Returns: {
          branch_name: string
          created_at: string
          id: string
          pharmacy_id: string
          pharmacy_name: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      notify_user: {
        Args: {
          _body: string
          _kind: string
          _link: string
          _pharmacy: string
          _title: string
          _user: string
        }
        Returns: undefined
      }
      pharmacy_has_plan_feature: {
        Args: { _feature: string; _pharmacy_id: string }
        Returns: boolean
      }
      pharmacy_is_current: { Args: { _pharmacy_id: string }; Returns: boolean }
      pharmacy_plan_limits: {
        Args: { _pharmacy_id: string }
        Returns: Record<string, unknown>
      }
      pharmacy_staff: {
        Args: { _pharmacy_id: string }
        Returns: {
          branch_id: string
          created_at: string
          email: string
          full_name: string
          is_active: boolean
          membership_id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
      place_wholesale_order: {
        Args: {
          _branch: string
          _buyer: string
          _items: Json
          _method: string
          _receipt_path: string
          _reference: string
          _supplier: string
        }
        Returns: string
      }
      plan_yearly_price: { Args: { _plan_id: string }; Returns: number }
      platform_demand_trends: {
        Args: { _supplier: string }
        Returns: {
          pharmacies: number
          product: string
          strength: string
          units_30d: number
          units_90d: number
          units_prev_30d: number
          your_stock: number
        }[]
      }
      platform_demand_trends_internal: {
        Args: { _supplier: string }
        Returns: {
          pharmacies: number
          product: string
          strength: string
          units_30d: number
          units_90d: number
          units_prev_30d: number
          your_stock: number
        }[]
      }
      receive_wholesale_order: {
        Args: { _note: string; _order: string }
        Returns: undefined
      }
      request_wholesale_quote: {
        Args: {
          _branch: string
          _buyer: string
          _items: Json
          _note: string
          _supplier: string
        }
        Returns: string
      }
      respond_wholesale_quote: {
        Args: {
          _accept: boolean
          _method: string
          _order: string
          _receipt_path: string
          _reference: string
        }
        Returns: undefined
      }
      review_prescription: {
        Args: { _decision: string; _id: string; _method: string; _note: string }
        Returns: string
      }
      review_registration: {
        Args: { _decision: string; _note?: string; _pharmacy_id: string }
        Returns: undefined
      }
      review_subscription_payment: {
        Args: { _decision: string; _note?: string; _payment_id: string }
        Returns: undefined
      }
      review_wholesale_order: {
        Args: { _decision: string; _note: string; _order: string }
        Returns: undefined
      }
      save_business_entry: {
        Args: { _id?: string; _module: string; _pharmacy: string; _row: Json }
        Returns: string
      }
      send_wholesale_quote: {
        Args: {
          _decline?: boolean
          _note: string
          _order: string
          _prices: Json
        }
        Returns: undefined
      }
      set_document_status: {
        Args: { _id: string; _note?: string; _status: string }
        Returns: undefined
      }
      set_wholesale_order_delivery: {
        Args: {
          _address: string
          _contact_name: string
          _contact_phone: string
          _note: string
          _order: string
        }
        Returns: undefined
      }
      shift_action: {
        Args: {
          _action: string
          _branch?: string
          _minutes?: number
          _note?: string
          _pharmacy: string
          _to_user?: string
        }
        Returns: string
      }
      submit_registration: { Args: { _payload: Json }; Returns: string }
      submit_subscription_payment: {
        Args: {
          _method: string
          _pharmacy_id: string
          _plan_slug: string
          _receipt_path: string
          _reference: string
        }
        Returns: string
      }
      supplier_catalog: {
        Args: never
        Returns: {
          dosage_form: string
          generic_name: string
          image_url: string
          is_prescription_required: boolean
          name: string
          product_id: string
          stock: number
          strength: string
          supplier_city: string
          supplier_id: string
          supplier_name: string
          unit_price: number
        }[]
      }
      supplier_directory: {
        Args: never
        Returns: {
          address: string
          city: string
          email: string
          id: string
          name: string
          phone: string
        }[]
      }
      try_uuid: { Args: { _value: string }; Returns: string }
      update_staff_details: {
        Args: { _membership: string; _pharmacy: string; _row: Json }
        Returns: undefined
      }
      user_belongs_to_pharmacy: {
        Args: { pharmacy_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      pharmacy_status:
        | "active"
        | "pending"
        | "suspended"
        | "trial"
        | "expired"
        | "rejected"
      user_role:
        | "super_admin"
        | "pharmacy_owner"
        | "pharmacist"
        | "cashier"
        | "manager"
        | "accountant"
        | "supplier"
        | "delivery_rider"
        | "inventory_manager"
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
    Enums: {
      pharmacy_status: [
        "active",
        "pending",
        "suspended",
        "trial",
        "expired",
        "rejected",
      ],
      user_role: [
        "super_admin",
        "pharmacy_owner",
        "pharmacist",
        "cashier",
        "manager",
        "accountant",
        "supplier",
        "delivery_rider",
        "inventory_manager",
      ],
    },
  },
} as const
