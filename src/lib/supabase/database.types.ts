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
      booking_payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          customer_id: string
          id: string
          paid_at: string | null
          payment_method: string
          payment_status: string
          provider_reference: string | null
          rejected_reason: string | null
          slip_amount: number | null
          slip_image_url: string
          submitted_at: string
          updated_at: string
          verification_provider: string | null
          verification_response: Json | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          customer_id: string
          id?: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          provider_reference?: string | null
          rejected_reason?: string | null
          slip_amount?: number | null
          slip_image_url: string
          submitted_at?: string
          updated_at?: string
          verification_provider?: string | null
          verification_response?: Json | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          provider_reference?: string | null
          rejected_reason?: string | null
          slip_amount?: number | null
          slip_image_url?: string
          submitted_at?: string
          updated_at?: string
          verification_provider?: string | null
          verification_response?: Json | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booking_date: string
          booking_time: string
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          customer_id: string
          id: string
          note: string | null
          payment_amount: number | null
          payment_status: string
          picked_up_at: string | null
          service_id: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          customer_id: string
          id?: string
          note?: string | null
          payment_amount?: number | null
          payment_status?: string
          picked_up_at?: string | null
          service_id: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          note?: string | null
          payment_amount?: number | null
          payment_status?: string
          picked_up_at?: string | null
          service_id?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_transactions: {
        Row: {
          id: string
          transaction_date: string
          transaction_type: string
          category: string
          amount: number
          description: string | null
          reference_type: string | null
          reference_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          transaction_date?: string
          transaction_type: string
          category: string
          amount: number
          description?: string | null
          reference_type?: string | null
          reference_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          transaction_date?: string
          transaction_type?: string
          category?: string
          amount?: number
          description?: string | null
          reference_type?: string | null
          reference_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_addresses: {
        Row: {
          address_line: string
          created_at: string
          customer_id: string
          district: string
          house_number: string | null
          id: string
          is_default: boolean
          latitude: number | null
          longitude: number | null
          moo: string | null
          phone_number: string
          place_id: string | null
          postal_code: string
          province: string
          recipient_name: string
          road: string | null
          soi: string | null
          subdistrict: string | null
          updated_at: string
        }
        Insert: {
          address_line: string
          created_at?: string
          customer_id: string
          district: string
          house_number?: string | null
          id?: string
          is_default?: boolean
          latitude?: number | null
          longitude?: number | null
          moo?: string | null
          phone_number: string
          place_id?: string | null
          postal_code: string
          province: string
          recipient_name: string
          road?: string | null
          soi?: string | null
          subdistrict?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string
          created_at?: string
          customer_id?: string
          district?: string
          house_number?: string | null
          id?: string
          is_default?: boolean
          latitude?: number | null
          longitude?: number | null
          moo?: string | null
          phone_number?: string
          place_id?: string | null
          postal_code?: string
          province?: string
          recipient_name?: string
          road?: string | null
          soi?: string | null
          subdistrict?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_capacity: {
        Row: {
          booking_date: string
          booking_time: string
          created_at: string
          id: string
          max_bookings: number
          note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          created_at?: string
          id?: string
          max_bookings?: number
          note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          created_at?: string
          id?: string
          max_bookings?: number
          note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      garage_closed_dates: {
        Row: {
          closed_date: string
          created_at: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          closed_date: string
          created_at?: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          closed_date?: string
          created_at?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      garage_notifications: {
        Row: {
          body: string
          booking_id: string | null
          created_at: string
          customer_id: string
          id: string
          is_read: boolean
          title: string
          type: string
        }
        Insert: {
          body: string
          booking_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_read?: boolean
          title: string
          type?: string
        }
        Update: {
          body?: string
          booking_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_read?: boolean
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "garage_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_operating_days: {
        Row: {
          close_time: string
          created_at: string
          is_open: boolean
          note: string | null
          open_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          close_time?: string
          created_at?: string
          is_open?: boolean
          note?: string | null
          open_time?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          close_time?: string
          created_at?: string
          is_open?: boolean
          note?: string | null
          open_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      homepage_appearance_settings: {
        Row: {
          background_color: string
          background_image_url: string | null
          created_at: string
          id: string
          logo_url: string | null
          setting_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          background_color?: string
          background_image_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          setting_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          background_color?: string
          background_image_url?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          setting_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homepage_appearance_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_footer_settings: {
        Row: {
          address: string | null
          background_color: string
          created_at: string
          email: string | null
          facebook_url: string | null
          id: string
          line_url: string | null
          operating_hours_note: string | null
          phone_number: string | null
          setting_key: string
          shop_name: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          background_color?: string
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          id?: string
          line_url?: string | null
          operating_hours_note?: string | null
          phone_number?: string | null
          setting_key?: string
          shop_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          background_color?: string
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          id?: string
          line_url?: string | null
          operating_hours_note?: string | null
          phone_number?: string | null
          setting_key?: string
          shop_name?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homepage_footer_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_slides: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          link_url: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          link_url?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          link_url?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homepage_slides_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          id: string
          setting_key: string
          shop_name: string
          address: string | null
          phone_number: string | null
          email: string | null
          tax_id: string | null
          branch_name: string | null
          branch_number: string | null
          vat_registered: boolean
          vat_rate: number
          prices_include_vat: boolean
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key?: string
          shop_name?: string
          address?: string | null
          phone_number?: string | null
          email?: string | null
          tax_id?: string | null
          branch_name?: string | null
          branch_number?: string | null
          vat_registered?: boolean
          vat_rate?: number
          prices_include_vat?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          shop_name?: string
          address?: string | null
          phone_number?: string | null
          email?: string | null
          tax_id?: string | null
          branch_name?: string | null
          branch_number?: string | null
          vat_registered?: boolean
          vat_rate?: number
          prices_include_vat?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          note: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          note?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_reminders: {
        Row: {
          created_at: string
          customer_id: string
          due_date: string | null
          due_mileage: number | null
          id: string
          note: string | null
          service_name: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          due_date?: string | null
          due_mileage?: number | null
          id?: string
          note?: string | null
          service_name: string
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          due_date?: string | null
          due_mileage?: number | null
          id?: string
          note?: string | null
          service_name?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          is_read: boolean
          message: string | null
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          is_read?: boolean
          message?: string | null
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          bank_transfer_enabled: boolean
          created_at: string
          id: string
          payment_instructions: string | null
          promptpay_display_name: string
          promptpay_enabled: boolean
          promptpay_id: string | null
          promptpay_qr_image_url: string | null
          setting_key: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_transfer_enabled?: boolean
          created_at?: string
          id?: string
          payment_instructions?: string | null
          promptpay_display_name?: string
          promptpay_enabled?: boolean
          promptpay_id?: string | null
          promptpay_qr_image_url?: string | null
          setting_key?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_transfer_enabled?: boolean
          created_at?: string
          id?: string
          payment_instructions?: string | null
          promptpay_display_name?: string
          promptpay_enabled?: boolean
          promptpay_id?: string | null
          promptpay_qr_image_url?: string | null
          setting_key?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          product_order_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          product_order_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          product_order_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_order_items_product_order_id_fkey"
            columns: ["product_order_id"]
            isOneToOne: false
            referencedRelation: "product_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_orders: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_id: string
          delivery_address: string | null
          delivery_fee: number
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_method: string
          id: string
          note: string | null
          order_number: string
          payment_status: string
          status: string
          subtotal_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_method?: string
          id?: string
          note?: string | null
          order_number: string
          payment_status?: string
          status?: string
          subtotal_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          delivery_address?: string | null
          delivery_fee?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_method?: string
          id?: string
          note?: string | null
          order_number?: string
          payment_status?: string
          status?: string
          subtotal_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_payment_transactions: {
        Row: {
          created_at: string
          id: string
          product_order_id: string
          product_payment_id: string
          provider_reference: string
          verified_amount: number
          verified_at: string
          verified_by_type: string
          verified_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          product_order_id: string
          product_payment_id: string
          provider_reference: string
          verified_amount: number
          verified_at?: string
          verified_by_type: string
          verified_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          product_order_id?: string
          product_payment_id?: string
          provider_reference?: string
          verified_amount?: number
          verified_at?: string
          verified_by_type?: string
          verified_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_payment_transactions_product_order_id_fkey"
            columns: ["product_order_id"]
            isOneToOne: false
            referencedRelation: "product_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_payment_transactions_product_payment_id_fkey"
            columns: ["product_payment_id"]
            isOneToOne: false
            referencedRelation: "product_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_payment_transactions_verified_by_user_id_fkey"
            columns: ["verified_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          payment_method: string
          payment_status: string
          product_order_id: string
          provider_reference: string | null
          rejected_reason: string | null
          slip_amount: number | null
          slip_image_url: string | null
          slip_qr_payload: string | null
          slip_receiver_account: string | null
          slip_receiver_bank: string | null
          slip_receiver_name: string | null
          slip_reference: string | null
          slip_sender_account: string | null
          slip_sender_bank: string | null
          slip_transfer_at: string | null
          submitted_at: string | null
          updated_at: string
          verification_provider: string
          verification_response: Json | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          product_order_id: string
          provider_reference?: string | null
          rejected_reason?: string | null
          slip_amount?: number | null
          slip_image_url?: string | null
          slip_qr_payload?: string | null
          slip_receiver_account?: string | null
          slip_receiver_bank?: string | null
          slip_receiver_name?: string | null
          slip_reference?: string | null
          slip_sender_account?: string | null
          slip_sender_bank?: string | null
          slip_transfer_at?: string | null
          submitted_at?: string | null
          updated_at?: string
          verification_provider?: string
          verification_response?: Json | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string
          payment_status?: string
          product_order_id?: string
          provider_reference?: string | null
          rejected_reason?: string | null
          slip_amount?: number | null
          slip_image_url?: string | null
          slip_qr_payload?: string | null
          slip_receiver_account?: string | null
          slip_receiver_bank?: string | null
          slip_receiver_name?: string | null
          slip_reference?: string | null
          slip_sender_account?: string | null
          slip_sender_bank?: string | null
          slip_transfer_at?: string | null
          submitted_at?: string | null
          updated_at?: string
          verification_provider?: string
          verification_response?: Json | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_payments_product_order_id_fkey"
            columns: ["product_order_id"]
            isOneToOne: false
            referencedRelation: "product_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cost_price: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          product_category_id: string
          sku: string | null
          status: string
          stock_quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          product_category_id: string
          sku?: string | null
          status?: string
          stock_quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          product_category_id?: string
          sku?: string | null
          status?: string
          stock_quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone_number: string
          role: string
          technician_specialty: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          phone_number: string
          role?: string
          technician_specialty?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone_number?: string
          role?: string
          technician_specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          day_of_month: number
          id: string
          is_active: boolean
          name: string
          start_month: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          day_of_month: number
          id?: string
          is_active?: boolean
          name: string
          start_month?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number
          id?: string
          is_active?: boolean
          name?: string
          start_month?: string
          updated_at?: string
        }
        Relationships: []
      }
      repair_job_parts: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          repair_job_id: string
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          repair_job_id: string
          total_price?: never
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          repair_job_id?: string
          total_price?: never
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_job_parts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_job_parts_repair_job_id_fkey"
            columns: ["repair_job_id"]
            isOneToOne: false
            referencedRelation: "repair_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_jobs: {
        Row: {
          booking_id: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          diagnosis: string | null
          id: string
          mechanic_id: string | null
          repair_notes: string | null
          started_at: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          booking_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          diagnosis?: string | null
          id?: string
          mechanic_id?: string | null
          repair_notes?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          booking_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          diagnosis?: string | null
          id?: string
          mechanic_id?: string | null
          repair_notes?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_jobs_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_jobs_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_jobs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_timeline_events: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          repair_job_id: string | null
          status: string
          title: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          repair_job_id?: string | null
          status: string
          title: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          repair_job_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_timeline_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_timeline_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_timeline_events_repair_job_id_fkey"
            columns: ["repair_job_id"]
            isOneToOne: false
            referencedRelation: "repair_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_quote_items: {
        Row: {
          created_at: string
          id: string
          item_name: string
          item_type: string
          quantity: number
          quote_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_name: string
          item_type: string
          quantity?: number
          quote_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_name?: string
          item_type?: string
          quantity?: number
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "service_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_quotes: {
        Row: {
          booking_id: string
          created_at: string
          customer_id: string
          customer_responded_at: string | null
          id: string
          labor_amount: number
          notes: string | null
          parts_amount: number
          status: string
          subtotal: number
          total_amount: number | null
          updated_at: string
          valid_until: string | null
          vehicle_id: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string
          customer_id: string
          customer_responded_at?: string | null
          id?: string
          labor_amount?: number
          notes?: string | null
          parts_amount?: number
          status?: string
          subtotal?: number
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
          vehicle_id?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string
          customer_id?: string
          customer_responded_at?: string | null
          id?: string
          labor_amount?: number
          notes?: string | null
          parts_amount?: number
          status?: string
          subtotal?: number
          total_amount?: number | null
          updated_at?: string
          valid_until?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_quotes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_quotes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_reviews: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          quality_rating: number | null
          rating: number
          service_rating: number | null
          time_rating: number | null
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          quality_rating?: number | null
          rating: number
          service_rating?: number | null
          time_rating?: number | null
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          quality_rating?: number | null
          rating?: number
          service_rating?: number | null
          time_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price: number
          created_at: string
          description: string | null
          estimated_duration_minutes: number
          id: string
          image_url: string | null
          name: string
          service_category_id: string
          status: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          description?: string | null
          estimated_duration_minutes?: number
          id?: string
          image_url?: string | null
          name: string
          service_category_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string | null
          estimated_duration_minutes?: number
          id?: string
          image_url?: string | null
          name?: string
          service_category_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          shopping_cart_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          shopping_cart_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          shopping_cart_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_cart_items_shopping_cart_id_fkey"
            columns: ["shopping_cart_id"]
            isOneToOne: false
            referencedRelation: "shopping_carts"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_carts: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_payrolls: {
        Row: {
          id: string
          technician_id: string
          payroll_month: string
          base_salary: number
          overtime_amount: number
          commission_amount: number
          deduction_amount: number
          net_salary: number
          status: string
          paid_at: string | null
          note: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          technician_id: string
          payroll_month: string
          base_salary?: number
          overtime_amount?: number
          commission_amount?: number
          deduction_amount?: number
          net_salary?: number
          status?: string
          paid_at?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          technician_id?: string
          payroll_month?: string
          base_salary?: number
          overtime_amount?: number
          commission_amount?: number
          deduction_amount?: number
          net_salary?: number
          status?: string
          paid_at?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_payrolls_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_profile_skills: {
        Row: {
          created_at: string
          skill_id: string
          technician_id: string
        }
        Insert: {
          created_at?: string
          skill_id: string
          technician_id: string
        }
        Update: {
          created_at?: string
          skill_id?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_profile_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "technician_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_profile_skills_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_skills: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          customer_id: string
          current_mileage: number | null
          id: string
          image_url: string | null
          license_plate: string
          model: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          customer_id: string
          current_mileage?: number | null
          id?: string
          image_url?: string | null
          license_plate: string
          model?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          customer_id?: string
          current_mileage?: number | null
          id?: string
          image_url?: string | null
          license_plate?: string
          model?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
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
      admin_set_user_role: {
        Args: {
          p_role: string
          p_user_id: string
        }
        Returns: Database["public"]["Tables"]["profiles"]["Row"]
      }
      generate_recurring_expenses: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      add_repair_job_part: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_repair_job_id: string
        }
        Returns: Json
      }
      remove_repair_job_part: {
        Args: {
          p_part_id: string
        }
        Returns: Json
      }
      apply_product_order_inventory: {
        Args: { target_order_id: string }
        Returns: number
      }
      approve_booking_payment: {
        Args: { target_booking_payment_id: string }
        Returns: {
          booking_date: string
          booking_time: string
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          customer_id: string
          id: string
          note: string | null
          payment_amount: number | null
          payment_status: string
          picked_up_at: string | null
          service_id: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_own_product_order_with_inventory_return: {
        Args: { target_order_id: string }
        Returns: number
      }
      cancel_own_product_order_with_reason: {
        Args: { reason: string; target_order_id: string }
        Returns: number
      }
      cancel_product_order_with_inventory_return: {
        Args: { target_order_id: string }
        Returns: number
      }
      complete_repair_job_and_request_payment: {
        Args: {
          diagnosis_text: string
          repair_notes_text: string
          target_work_order_id: string
        }
        Returns: {
          booking_id: string | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          diagnosis: string | null
          id: string
          mechanic_id: string | null
          repair_notes: string | null
          started_at: string | null
          status: string
          updated_at: string
          vehicle_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "repair_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_booking_pickup: {
        Args: { target_booking_id: string }
        Returns: {
          booking_date: string
          booking_time: string
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          customer_id: string
          id: string
          note: string | null
          payment_amount: number | null
          payment_status: string
          picked_up_at: string | null
          service_id: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_is_admin: { Args: never; Returns: boolean }
      current_user_role: { Args: never; Returns: string }
      get_garage_operating_status: {
        Args: { target_date: string }
        Returns: {
          booking_date: string
          close_time: string
          closed_reason: string
          is_open: boolean
          is_special_closed: boolean
          note: string
          open_time: string
          weekday: number
        }[]
      }
      get_garage_slot_availability: {
        Args: { target_date: string; target_time: string }
        Returns: {
          active_booking_count: number
          available_booking_count: number
          booking_date: string
          booking_time: string
          is_open: boolean
          max_bookings: number
        }[]
      }
      is_garage_slot_available: {
        Args: { target_date: string; target_time: string }
        Returns: boolean
      }
      reject_booking_payment: {
        Args: { reason: string; target_booking_payment_id: string }
        Returns: {
          booking_date: string
          booking_time: string
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          customer_id: string
          id: string
          note: string | null
          payment_amount: number | null
          payment_status: string
          picked_up_at: string | null
          service_id: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_booking_payment_slip: {
        Args: {
          slip_payment_method: string
          slip_url: string
          target_booking_id: string
        }
        Returns: {
          amount: number
          booking_id: string
          created_at: string
          customer_id: string
          id: string
          paid_at: string | null
          payment_method: string
          payment_status: string
          provider_reference: string | null
          rejected_reason: string | null
          slip_amount: number | null
          slip_image_url: string
          submitted_at: string
          updated_at: string
          verification_provider: string | null
          verification_response: Json | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "booking_payments"
          isOneToOne: true
          isSetofReturn: false
        }
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


