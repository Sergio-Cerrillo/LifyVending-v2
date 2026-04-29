// =====================================================
// Servicio de Configuración Global
// =====================================================

import { supabaseAdmin } from '@/lib/supabase-helpers';
import type {
  AppSettings,
  GeneralSettings,
  ScrapingSettings,
  ClientsSettings,
  SecuritySettings,
  NotificationsSettings,
  AppearanceSettings,
  MaintenanceSettings,
  SettingsAudit,
  ScrapingStatus,
} from '@/lib/types/settings';

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Obtiene la configuración global del sistema
 */
export async function getSettings(): Promise<AppSettings | null> {
  const supabase = supabaseAdmin;
  
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .single();
  
  if (error) {
    console.error('Error fetching settings:', error);
    return null;
  }
  
  return data;
}

/**
 * Actualiza configuración general
 */
export async function updateGeneralSettings(
  settings: Partial<GeneralSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = supabaseAdmin;
  
  const { error } = await supabase
    .from('app_settings')
    .update(settings)
    .eq('id', SETTINGS_ID);
  
  if (error) {
    console.error('Error updating general settings:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Actualiza configuración de scraping
 */
export async function updateScrapingConfig(
  config: Partial<ScrapingSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = supabaseAdmin;
  
  // Primero obtener config actual
  const current = await getSettings();
  if (!current) {
    return { success: false, error: 'No se pudo obtener configuración actual' };
  }
  
  const updated_config = {
    ...current.scraping_config,
    ...config,
  };
  
  const { error } = await supabase
    .from('app_settings')
    .update({ scraping_config: updated_config })
    .eq('id', SETTINGS_ID);
  
  if (error) {
    console.error('Error updating scraping config:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Actualiza configuración de clientes
 */
export async function updateClientsConfig(
  config: Partial<ClientsSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = supabaseAdmin;
  
  const current = await getSettings();
  if (!current) {
    return { success: false, error: 'No se pudo obtener configuración actual' };
  }
  
  const updated_config = {
    ...current.clients_config,
    ...config,
  };
  
  const { error } = await supabase
    .from('app_settings')
    .update({ clients_config: updated_config })
    .eq('id', SETTINGS_ID);
  
  if (error) {
    console.error('Error updating clients config:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Actualiza configuración de seguridad
 */
export async function updateSecurityConfig(
  config: Partial<SecuritySettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = supabaseAdmin;
  
  const current = await getSettings();
  if (!current) {
    return { success: false, error: 'No se pudo obtener configuración actual' };
  }
  
  const updated_config = {
    ...current.security_config,
    ...config,
  };
  
  const { error } = await supabase
    .from('app_settings')
    .update({ security_config: updated_config })
    .eq('id', SETTINGS_ID);
  
  if (error) {
    console.error('Error updating security config:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Actualiza configuración de notificaciones
 */
export async function updateNotificationsConfig(
  config: Partial<NotificationsSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = supabaseAdmin;
  
  const current = await getSettings();
  if (!current) {
    return { success: false, error: 'No se pudo obtener configuración actual' };
  }
  
  const updated_config = {
    ...current.notifications_config,
    ...config,
  };
  
  const { error } = await supabase
    .from('app_settings')
    .update({ notifications_config: updated_config })
    .eq('id', SETTINGS_ID);
  
  if (error) {
    console.error('Error updating notifications config:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Actualiza configuración de apariencia
 */
export async function updateAppearanceConfig(
  config: Partial<AppearanceSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = supabaseAdmin;
  
  const current = await getSettings();
  if (!current) {
    return { success: false, error: 'No se pudo obtener configuración actual' };
  }
  
  const updated_config = {
    ...current.appearance_config,
    ...config,
  };
  
  const { error } = await supabase
    .from('app_settings')
    .update({ appearance_config: updated_config })
    .eq('id', SETTINGS_ID);
  
  if (error) {
    console.error('Error updating appearance config:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Actualiza configuración de mantenimiento
 */
export async function updateMaintenanceConfig(
  config: Partial<MaintenanceSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = supabaseAdmin;
  
  const current = await getSettings();
  if (!current) {
    return { success: false, error: 'No se pudo obtener configuración actual' };
  }
  
  const updated_config = {
    ...current.maintenance_config,
    ...config,
  };
  
  const { error } = await supabase
    .from('app_settings')
    .update({ maintenance_config: updated_config })
    .eq('id', SETTINGS_ID);
  
  if (error) {
    console.error('Error updating maintenance config:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Obtiene información de auditoría
 */
export async function getSettingsAudit(): Promise<SettingsAudit | null> {
  const supabase = supabaseAdmin;
  
  const { data, error } = await supabase
    .from('settings_audit')
    .select('*')
    .single();
  
  if (error) {
    console.error('Error fetching settings audit:', error);
    return null;
  }
  
  return data;
}

/**
 * Obtiene estadísticas de scraping (si existe la tabla scrape_runs)
 */
export async function getScrapingStatus(): Promise<ScrapingStatus | null> {
  const supabase = supabaseAdmin;
  
  try {
    const { data, error } = await supabase
      .from('scrape_runs')
      .select('started_at, ended_at, status, error_message')
      .order('started_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.warn('Tabla scrape_runs no disponible:', error.message);
      return null;
    }
    
    if (!data || data.length === 0) {
      return {
        last_execution: null,
        avg_duration_seconds: null,
        total_runs: 0,
        successful_runs: 0,
        failed_runs: 0,
        total_errors: 0,
        success_rate: 0,
      };
    }
    
    const total_runs = data.length;
    const successful_runs = data.filter((r: any) => r.status === 'completed');
    const failed_runs = data.filter((r: any) => r.status === 'failed');
    
    // Calcular duración promedio de runs exitosos
    const durations = successful_runs
      .filter((r: any) => r.started_at && r.ended_at)
      .map((r: any) => {
        const start = new Date(r.started_at!).getTime();
        const end = new Date(r.ended_at!).getTime();
        return (end - start) / 1000; // segundos
      });
    
    const avg_duration_seconds =
      durations.length > 0
        ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length
        : null;
    
    const success_rate =
      total_runs > 0 ? (successful_runs.length / total_runs) * 100 : 0;
    
    return {
      last_execution: data[0].started_at,
      avg_duration_seconds: avg_duration_seconds
        ? Math.round(avg_duration_seconds)
        : null,
      total_runs,
      successful_runs: successful_runs.length,
      failed_runs: failed_runs.length,
      total_errors: failed_runs.length,
      success_rate: Math.round(success_rate),
      last_run_at: data[0]?.started_at,
      last_run_status: data[0]?.status === 'completed' ? 'success' as const : 'failed' as const,
    };
  } catch (error) {
    console.warn('Error calculando estadísticas de scraping:', error);
    return null;
  }
}

/**
 * Ejecutar scraping manualmente (trigger API)
 */
export async function triggerManualScraping(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetch('/api/admin/force-scrape', {
      method: 'POST',
    });
    
    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error triggering scraping:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}
