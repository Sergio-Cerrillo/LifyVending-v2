-- =====================================================
-- MIGRACIÓN: Configuración Global del Sistema
-- =====================================================
-- Tabla única con un registro global de configuración
-- Estructura JSONB para máxima flexibilidad y escalabilidad
-- =====================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- General
  company_name TEXT DEFAULT 'LifyVending',
  admin_panel_name TEXT DEFAULT 'Panel Administrativo',
  client_portal_name TEXT DEFAULT 'Portal Cliente',
  support_email TEXT DEFAULT 'info@lifyvending.com',
  support_phone TEXT DEFAULT '',
  timezone TEXT DEFAULT 'Europe/Madrid',
  currency TEXT DEFAULT 'EUR',
  date_format TEXT DEFAULT 'DD/MM/YYYY',
  default_language TEXT DEFAULT 'es',
  legal_footer TEXT DEFAULT '',
  
  -- Scraping
  scraping_config JSONB DEFAULT '{
    "enabled": true,
    "auto_enabled": true,
    "manual_enabled": true,
    "interval_hours": 24,
    "timeout_seconds": 300,
    "max_retries": 3,
    "stock_enabled": true,
    "revenue_enabled": true
  }'::jsonb,
  
  -- Clientes
  clients_config JSONB DEFAULT '{
    "default_percentage": 0,
    "force_password_change": false,
    "allow_manual_refresh": true,
    "max_refreshes_per_day": 5,
    "min_refresh_interval_minutes": 30,
    "show_machine_breakdown": true,
    "show_daily_card": true,
    "show_weekly_card": true,
    "show_monthly_card": true,
    "allow_export": false
  }'::jsonb,
  
  -- Seguridad
  security_config JSONB DEFAULT '{
    "min_password_length": 8,
    "require_uppercase": true,
    "require_number": true,
    "require_symbol": false,
    "session_duration_hours": 24,
    "max_login_attempts": 5,
    "enable_2fa": false,
    "require_confirmation_sensitive": true,
    "log_critical_actions": true
  }'::jsonb,
  
  -- Notificaciones
  notifications_config JSONB DEFAULT '{
    "alert_email": "info@lifyvending.com",
    "notify_scraping_failure": true,
    "notify_update_failure": true,
    "notify_client_created": false,
    "notify_password_reset": true,
    "notify_excess_refreshes": true,
    "email_subject_template": "[LifyVending] {{event}}"
  }'::jsonb,
  
  -- Apariencia
  appearance_config JSONB DEFAULT '{
    "brand_name": "LifyVending",
    "login_welcome_text": "Bienvenido al Panel de Gestión",
    "primary_color": "#3b82f6",
    "secondary_color": "#8b5cf6",
    "logo_url": "",
    "client_dashboard_name": "Mi Dashboard",
    "login_image_url": ""
  }'::jsonb,
  
  -- Mantenimiento
  maintenance_config JSONB DEFAULT '{
    "enabled": false,
    "message": "Sistema en mantenimiento. Volveremos pronto.",
    "log_retention_days": 90
  }'::jsonb,
  
  -- Auditoría
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  
  -- Constraint: solo un registro
  CONSTRAINT single_settings_row CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON app_settings(updated_at DESC);

-- RLS Policies
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden leer
CREATE POLICY "Admins can read settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Solo admins pueden actualizar
CREATE POLICY "Admins can update settings"
  ON app_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Función para auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_app_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS trigger_update_app_settings_timestamp ON app_settings;
CREATE TRIGGER trigger_update_app_settings_timestamp
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_app_settings_timestamp();

-- Insertar registro inicial (con ID fijo)
INSERT INTO app_settings (id)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Vista simplificada para auditoría
-- =====================================================
CREATE OR REPLACE VIEW settings_audit AS
SELECT
  s.id,
  s.company_name,
  s.updated_at,
  s.updated_by,
  p.display_name as updated_by_name,
  p.email as updated_by_email
FROM app_settings s
LEFT JOIN profiles p ON s.updated_by = p.id;

-- RLS para la vista
ALTER VIEW settings_audit SET (security_barrier = true);

COMMENT ON TABLE app_settings IS 'Configuración global del sistema (registro único)';
COMMENT ON COLUMN app_settings.scraping_config IS 'Configuración del motor de scraping (Orain/Televend)';
COMMENT ON COLUMN app_settings.clients_config IS 'Configuración por defecto para clientes y portal cliente';
COMMENT ON COLUMN app_settings.security_config IS 'Políticas de seguridad y autenticación';
COMMENT ON COLUMN app_settings.notifications_config IS 'Configuración de alertas y notificaciones por email';
COMMENT ON COLUMN app_settings.appearance_config IS 'Personalización de marca y apariencia del sistema';
COMMENT ON COLUMN app_settings.maintenance_config IS 'Modo mantenimiento y retención de logs';
