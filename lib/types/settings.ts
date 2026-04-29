// =====================================================
// Tipos para Configuración Global del Sistema
// =====================================================

export interface ScrapingConfig {
  enabled: boolean;
  auto_enabled: boolean;
  manual_enabled: boolean;
  interval_hours: number;
  timeout_seconds: number;
  max_retries: number;
  stock_enabled: boolean;
  revenue_enabled: boolean;
}

export interface ClientsConfig {
  default_percentage: number;
  force_password_change: boolean;
  allow_manual_refresh: boolean;
  max_refreshes_per_day: number;
  min_refresh_interval_minutes: number;
  show_machine_breakdown: boolean;
  show_daily_card: boolean;
  show_weekly_card: boolean;
  show_monthly_card: boolean;
  allow_export: boolean;
}

export interface SecurityConfig {
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
  session_timeout_minutes: number;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  require_email_verification: boolean;
  two_factor_enabled: boolean;
  ip_whitelist_enabled: boolean;
  allowed_ips?: string[];
  rate_limit_enabled: boolean;
  rate_limit_requests_per_minute: number;
}

export interface NotificationsConfig {
  email_notifications_enabled: boolean;
  notify_on_scrape_failure: boolean;
  notify_on_machine_offline: boolean;
  notify_on_low_stock: boolean;
  notify_on_new_client: boolean;
  admin_email: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_from_name?: string;
  smtp_from_email?: string;
}

export interface AppearanceConfig {
  theme: 'light' | 'dark' | 'system';
  primary_color: string;
  logo_url?: string;
  favicon_url?: string;
  company_logo_url?: string;
  show_branding: boolean;
  custom_css?: string;
  welcome_message?: string;
  footer_text?: string;
}

export interface MaintenanceConfig {
  maintenance_mode: boolean;
  maintenance_message?: string;
  allow_admin_access: boolean;
  scheduled_maintenance: boolean;
  maintenance_start?: string;
  maintenance_end?: string;
}

export interface AppSettings {
  id: string;
  
  // General
  company_name: string;
  admin_panel_name: string;
  client_portal_name: string;
  support_email: string;
  support_phone: string;
  timezone: string;
  currency: string;
  date_format: string;
  default_language: string;
  legal_footer: string;
  
  // Configuraciones JSONB
  scraping_config: ScrapingConfig;
  clients_config: ClientsConfig;
  security_config: SecurityConfig;
  notifications_config: NotificationsConfig;
  appearance_config: AppearanceConfig;
  maintenance_config: MaintenanceConfig;
  
  // Auditoría
  updated_at: string;
  updated_by: string | null;
}

// Tipos parciales para formularios
export type GeneralSettings = Pick<
  AppSettings,
  | 'company_name'
  | 'admin_panel_name'
  | 'client_portal_name'
  | 'support_email'
  | 'support_phone'
  | 'timezone'
  | 'currency'
  | 'date_format'
  | 'default_language'
  | 'legal_footer'
>;

export type ScrapingSettings = AppSettings['scraping_config'];
export type ClientsSettings = AppSettings['clients_config'];
export type SecuritySettings = AppSettings['security_config'];
export type NotificationsSettings = AppSettings['notifications_config'];
export type AppearanceSettings = AppSettings['appearance_config'];
export type MaintenanceSettings = AppSettings['maintenance_config'];

// Vista de auditoría
export interface SettingsAudit {
  id: string;
  company_name: string;
  updated_at: string;
  updated_by: string | null;
  updated_by_name: string | null;
  updated_by_email: string | null;
}

// Resultado de scraping para dashboard
export interface ScrapingStatus {
  last_execution: string | null;
  avg_duration_seconds: number | null;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  total_errors: number;
  success_rate: number;
  last_run_at?: string;
  last_run_status?: 'success' | 'failed';
}
