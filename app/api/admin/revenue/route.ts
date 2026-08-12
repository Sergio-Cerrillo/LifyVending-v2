/**
 * API: Obtener recaudaciones de todas las máquinas (admin)
 * GET /api/admin/revenue
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';
import { ensureRevenueFreshness } from '@/lib/services/revenue-refresh-service';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    
    console.log('[REVENUE API] Auth header presente:', !!authHeader);
    
    if (!authHeader) {
      console.error('[REVENUE API] No se proporcionó token de autorización');
      return NextResponse.json({ error: 'No autorizado - Token faltante' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    console.log('[REVENUE API] Usuario autenticado:', user?.id, 'Error:', authError?.message);

    if (authError || !user) {
      console.error('[REVENUE API] Error de autenticación:', authError?.message);
      return NextResponse.json({ 
        error: 'No autorizado - Token inválido',
        details: authError?.message 
      }, { status: 401 });
    }

    // Verificar que sea admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('[REVENUE API] Perfil del usuario:', profile?.role, 'Error:', profileError?.message);

    if (profileError || !profile) {
      console.error('[REVENUE API] Error obteniendo perfil:', profileError?.message);
      return NextResponse.json({ 
        error: 'Error obteniendo perfil de usuario',
        details: profileError?.message 
      }, { status: 500 });
    }

    if (profile.role !== 'admin') {
      console.error('[REVENUE API] Usuario sin permisos de admin:', user.id, 'Rol:', profile.role);
      return NextResponse.json({ 
        error: 'Permisos insuficientes',
        userRole: profile.role,
        requiredRole: 'admin'
      }, { status: 403 });
    }

    await ensureRevenueFreshness().catch((refreshError) => {
      console.error('[REVENUE API] No se pudo refrescar recaudación antes de responder:', refreshError);
    });

    const revenueProviderFilter = 'frekuent_machine_id.not.is.null,orain_machine_id.not.is.null,televend_machine_id.not.is.null';

    const machinesQuery = supabaseAdmin
      .from('machines')
      .select('*')
      .or(revenueProviderFilter)
      .order('name', { ascending: true });

    // Obtener máquinas con datos de la última tanda de recaudación
    const { data: machines, error } = await machinesQuery;

    if (error) {
      throw new Error(`Error obteniendo máquinas: ${error.message}`);
    }

    const latestByProvider = (machines || []).reduce((acc: Record<string, number>, machine: any) => {
      const provider = machine.televend_machine_id ? 'televend' : 'frekuent';
      const timestamp = machine.last_scraped_at ? new Date(machine.last_scraped_at).getTime() : 0;
      if (timestamp > (acc[provider] || 0)) acc[provider] = timestamp;
      return acc;
    }, {});

    const currentMachines = (machines || []).filter((machine: any) => {
      const provider = machine.televend_machine_id ? 'televend' : 'frekuent';
      const timestamp = machine.last_scraped_at ? new Date(machine.last_scraped_at).getTime() : 0;
      return timestamp > 0 && timestamp === latestByProvider[provider];
    });

    // Formatear datos (solo daily y monthly, weekly eliminado)
    const formattedMachines = currentMachines.map((machine: any) => {
      return {
        id: machine.id,
        name: machine.name,
        location: machine.location,
        status: machine.status,
        lastScraped: machine.last_scraped_at,
        source: machine.televend_machine_id ? 'televend' : 'frekuent',
        daily: {
          total: machine.daily_total || 0,
          card: machine.daily_card || 0,
          cash: machine.daily_cash || 0,
          updatedAt: machine.daily_updated_at
        },
        monthly: {
          total: machine.monthly_total || 0,
          card: machine.monthly_card || 0,
          cash: machine.monthly_cash || 0,
          updatedAt: machine.monthly_updated_at
        }
      };
    });

    // Calcular totales generales
    const totals = formattedMachines.reduce(
      (acc: { daily: number; monthly: number }, machine: any) => ({
        daily: acc.daily + machine.daily.total,
        monthly: acc.monthly + machine.monthly.total
      }), 
      { daily: 0, monthly: 0 }
    );

    // Encontrar la fecha de última actualización más reciente
    const allUpdateDates = formattedMachines
      .flatMap((m: any) => [m.daily.updatedAt, m.monthly.updatedAt, m.lastScraped])
      .filter(Boolean)
      .map((date: string) => new Date(date).getTime());
    
    const lastUpdate = allUpdateDates.length > 0 
      ? new Date(Math.max(...allUpdateDates)).toISOString()
      : null;

    return NextResponse.json({
      machines: formattedMachines,
      totals,
      count: formattedMachines.length,
      lastUpdate
    });

  } catch (error: any) {
    console.error('Error obteniendo recaudaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
