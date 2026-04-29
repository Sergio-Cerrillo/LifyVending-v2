/**
 * TIPOS GENERADOS DE SUPABASE
 * 
 * Este archivo define la estructura de la base de datos
 * Para regenerar: npx supabase gen types typescript --local > lib/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 'admin' | 'client'
          email: string
          display_name: string | null
          company_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: 'admin' | 'client'
          email: string
          display_name?: string | null
          company_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'admin' | 'client'
          email?: string
          display_name?: string | null
          company_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      client_settings: {
        Row: {
          id: string
          client_id: string
          commission_hide_percent: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          commission_hide_percent?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          commission_hide_percent?: number
          created_at?: string
          updated_at?: string
        }
      }
      machines: {
        Row: {
          id: string
          orain_machine_id: string | null
          televend_machine_id: string | null
          name: string
          location: string | null
          status: string | null
          last_scraped_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          orain_machine_id?: string | null
          televend_machine_id?: string | null
          name: string
          location?: string | null
          status?: string | null
          last_scraped_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          orain_machine_id?: string | null
          televend_machine_id?: string | null
          name?: string
          location?: string | null
          status?: string | null
          last_scraped_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      client_machine_assignments: {
        Row: {
          id: string
          client_id: string
          machine_id: string
          assigned_at: string
        }
        Insert: {
          id?: string
          client_id: string
          machine_id: string
          assigned_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          machine_id?: string
          assigned_at?: string
        }
      }
      machine_revenue_snapshots: {
        Row: {
          id: string
          machine_id: string
          scraped_at: string
          period: 'daily' | 'weekly' | 'monthly'
          amount_gross: number
          anonymous_total: number | null
          anonymous_card: number | null
          anonymous_cash: number | null
          created_at: string
        }
        Insert: {
          id?: string
          machine_id: string
          scraped_at: string
          period: 'daily' | 'weekly' | 'monthly'
          amount_gross?: number
          anonymous_total?: number | null
          anonymous_card?: number | null
          anonymous_cash?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          machine_id?: string
          scraped_at?: string
          period?: 'daily' | 'weekly' | 'monthly'
          amount_gross?: number
          anonymous_total?: number | null
          anonymous_card?: number | null
          anonymous_cash?: number | null
          created_at?: string
        }
      }
      scrape_runs: {
        Row: {
          id: string
          triggered_by_user_id: string | null
          triggered_role: 'admin' | 'client' | null
          status: 'pending' | 'running' | 'completed' | 'error'
          started_at: string
          finished_at: string | null
          error_message: string | null
          machines_scraped: number | null
          created_at: string
        }
        Insert: {
          id?: string
          triggered_by_user_id?: string | null
          triggered_role?: 'admin' | 'client' | null
          status?: 'pending' | 'running' | 'completed' | 'error'
          started_at?: string
          finished_at?: string | null
          error_message?: string | null
          machines_scraped?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          triggered_by_user_id?: string | null
          triggered_role?: 'admin' | 'client' | null
          status?: 'pending' | 'running' | 'completed' | 'error'
          started_at?: string
          finished_at?: string | null
          error_message?: string | null
          machines_scraped?: number | null
          created_at?: string
        }
      }
      commission_snapshots: {
        Row: {
          id: string
          client_id: string
          month: number
          year: number
          total_revenue: number
          commission_percent: number
          commission_amount: number
          card_revenue: number | null
          cash_revenue: number | null
          machines_count: number
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          month: number
          year: number
          total_revenue?: number
          commission_percent: number
          commission_amount: number
          card_revenue?: number | null
          cash_revenue?: number | null
          machines_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          month?: number
          year?: number
          total_revenue?: number
          commission_percent?: number
          commission_amount?: number
          card_revenue?: number | null
          cash_revenue?: number | null
          machines_count?: number
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_client_net_revenue: {
        Args: {
          p_client_id: string
          p_period: 'daily' | 'weekly' | 'monthly'
          p_machine_id?: string
        }
        Returns: Array<{
          machine_id: string
          machine_name: string
          location: string | null
          period: 'daily' | 'weekly' | 'monthly'
          amount_net: number
          scraped_at: string
        }>
      }
      get_admin_client_overview: {
        Args: {
          p_client_id: string
        }
        Returns: Array<{
          period: 'daily' | 'weekly' | 'monthly'
          total_gross: number
          total_net: number
          commission_percent: number
          machine_count: number
          last_update: string
        }>
      }
    }
    Enums: {
      user_role: 'admin' | 'client'
      revenue_period: 'daily' | 'weekly' | 'monthly'
      scrape_status: 'pending' | 'running' | 'completed' | 'error'
    }
  }
}
