/**
 * CLIENTE SUPABASE Y HELPERS
 * 
 * Configuración centralizada de Supabase con helpers
 * para operaciones comunes
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Cliente público (para operaciones del lado del cliente)
// Este es seguro para usar en el navegador
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Cliente con service role (solo para servidor/API routes)
// NUNCA importar esto en componentes del cliente
function getSupabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no está configurada');
  }
  
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// Export como función para que solo se evalúe cuando se necesita (en servidor)
export const supabaseAdmin = typeof window === 'undefined' 
  ? getSupabaseAdmin() 
  : null as any;

// Types helpers
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Machine = Database['public']['Tables']['machines']['Row'];
export type ClientSettings = Database['public']['Tables']['client_settings']['Row'];
export type MachineRevenueSnapshot = Database['public']['Tables']['machine_revenue_snapshots']['Row'];
export type ClientMachineAssignment = Database['public']['Tables']['client_machine_assignments']['Row'];
export type ScrapeRun = Database['public']['Tables']['scrape_runs']['Row'];

export type UserRole = 'admin' | 'client';
export type RevenuePeriod = 'daily' | 'weekly' | 'monthly';
export type ScrapeStatus = 'pending' | 'running' | 'completed' | 'error';

/**
 * Verifica si el usuario actual es admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return data?.role === 'admin';
}

/**
 * Obtener perfil de usuario
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error obteniendo perfil:', error);
    return null;
  }

  return data;
}

/**
 * Crear nuevo cliente (solo admin)
 */
export async function createNewClient(params: {
  email: string;
  password: string;
  displayName?: string;
  companyName?: string;
  commissionHidePercent?: number;
  commissionPaymentPercent?: number;
}) {
  // Crear usuario en Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true
  });

  if (authError) {
    throw new Error(`Error creando usuario: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error('No se pudo crear el usuario');
  }

  // Crear perfil
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: authData.user.id,
      email: params.email,
      role: 'client',
      display_name: params.displayName || null,
      company_name: params.companyName || null
    });

  if (profileError) {
    throw new Error(`Error creando perfil: ${profileError.message}`);
  }

  // Crear settings con valores por defecto si no se proporcionan
  const hidePercent = params.commissionHidePercent !== undefined ? params.commissionHidePercent : 0;
  const paymentPercent = params.commissionPaymentPercent !== undefined ? params.commissionPaymentPercent : 0;

  console.log('[CREATE-CLIENT] Creando settings con % Oculto:', hidePercent, '% Comisión:', paymentPercent);

  const { data: settingsData, error: settingsError } = await supabaseAdmin
    .from('client_settings')
    .insert({
      client_id: authData.user.id,
      commission_hide_percent: hidePercent,
      commission_payment_percent: paymentPercent
    })
    .select();

  if (settingsError) {
    console.error('[CREATE-CLIENT] Error creando settings:', settingsError);
    throw new Error(`Error creando settings: ${settingsError.message}`);
  }

  console.log('[CREATE-CLIENT] ✅ Settings guardados en BD:', settingsData);

  return authData.user;
}

/**
 * Actualizar porcentaje de comisión de un cliente
 */
export async function updateClientCommission(
  clientId: string,
  commissionPercent: number
) {
  const { error } = await supabaseAdmin
    .from('client_settings')
    .update({ commission_hide_percent: commissionPercent })
    .eq('client_id', clientId);

  if (error) {
    throw new Error(`Error actualizando comisión: ${error.message}`);
  }
}

/**
 * Asignar máquinas a un cliente
 */
export async function assignMachinesToClient(
  clientId: string,
  machineIds: string[]
) {
  // Primero eliminar asignaciones existentes
  await supabaseAdmin
    .from('client_machine_assignments')
    .delete()
    .eq('client_id', clientId);

  // Insertar nuevas asignaciones
  if (machineIds.length > 0) {
    const assignments = machineIds.map(machineId => ({
      client_id: clientId,
      machine_id: machineId
    }));

    const { error } = await supabaseAdmin
      .from('client_machine_assignments')
      .insert(assignments);

    if (error) {
      throw new Error(`Error asignando máquinas: ${error.message}`);
    }
  }
}

/**
 * Guardar snapshots de recaudación en DB
 */
export async function saveMachineRevenueSnapshots(
  snapshots: Array<{
    machineId: string;
    period: RevenuePeriod;
    amountGross: number;
    anonymousTotal: number;
    anonymousCard: number;
    anonymousCash: number;
    scrapedAt: Date;
  }>
) {
  const { error } = await supabaseAdmin
    .from('machine_revenue_snapshots')
    .insert(
      snapshots.map(s => ({
        machine_id: s.machineId,
        period: s.period,
        amount_gross: s.amountGross,
        anonymous_total: s.anonymousTotal,
        anonymous_card: s.anonymousCard,
        anonymous_cash: s.anonymousCash,
        scraped_at: s.scrapedAt.toISOString()
      }))
    );

  if (error) {
    throw new Error(`Error guardando snapshots: ${error.message}`);
  }
}

/**
 * Crear scrape run
 */
export async function createScrapeRun(params: {
  triggeredByUserId: string;
  triggeredRole: UserRole;
}) {
  const { data, error } = await supabaseAdmin
    .from('scrape_runs')
    .insert({
      triggered_by_user_id: params.triggeredByUserId,
      triggered_role: params.triggeredRole,
      status: 'running'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creando scrape run: ${error.message}`);
  }

  return data;
}

/**
 * Actualizar scrape run
 */
export async function updateScrapeRun(
  id: string,
  params: {
    status: ScrapeStatus;
    machinesScraped?: number;
    errorMessage?: string;
  }
) {
  const { error } = await supabaseAdmin
    .from('scrape_runs')
    .update({
      status: params.status,
      finished_at: new Date().toISOString(),
      machines_scraped: params.machinesScraped,
      error_message: params.errorMessage
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Error actualizando scrape run: ${error.message}`);
  }
}

/**
 * Obtener o crear máquina por nombre/ID de Orain
 */
export async function getOrCreateMachine(params: {
  orainMachineId?: string;
  name: string;
  location?: string;
}) {
  // Intentar encontrar por nombre primero
  let { data: existing } = await supabaseAdmin
    .from('machines')
    .select('*')
    .eq('name', params.name)
    .single();

  if (existing) {
    // Actualizar location y last_scraped_at
    await supabaseAdmin
      .from('machines')
      .update({
        location: params.location,
        last_scraped_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    return existing;
  }

  // Crear nueva máquina
  const { data: newMachine, error } = await supabaseAdmin
    .from('machines')
    .insert({
      orain_machine_id: params.orainMachineId,
      name: params.name,
      location: params.location,
      last_scraped_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creando máquina: ${error.message}`);
  }

  return newMachine!;
}

/**
 * Resetear contraseña de usuario
 */
export async function resetUserPassword(userId: string, newPassword: string) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword
  });

  if (error) {
    throw new Error(`Error reseteando contraseña: ${error.message}`);
  }
}

/**
 * Obtener último scrape run
 */
export async function getLastScrapeRun(userId?: string): Promise<ScrapeRun | null> {
  let query = supabaseAdmin
    .from('scrape_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1);

  if (userId) {
    query = query.eq('triggered_by_user_id', userId);
  }

  const { data, error } = await query.single();

  if (error) {
    return null;
  }

  return data;
}
