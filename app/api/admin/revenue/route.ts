/**
 * API: Obtener recaudaciones de todas las máquinas (admin)
 * GET /api/admin/revenue
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

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

    // Obtener todas las máquinas con sus datos de recaudación
    const { data: machines, error } = await supabaseAdmin
      .from('machines')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Error obteniendo máquinas: ${error.message}`);
    }

    // Formatear datos (solo daily y monthly, weekly eliminado)
    const formattedMachines = (machines || []).map((machine: any) => {
      // Determinar la fuente de la máquina
      const source = machine.orain_machine_id ? 'orain' : 'televend';
      
      return {
        id: machine.id,
        name: machine.name,
        location: machine.location,
        status: machine.status,
        lastScraped: machine.last_scraped_at,
        source: source, // 'orain' o 'televend'
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

    // Calcular totales separados por fuente
    const totalsOrain = formattedMachines
      .filter((m: any) => m.source === 'orain')
      .reduce(
        (acc: { daily: number; monthly: number }, machine: any) => ({
          daily: acc.daily + machine.daily.total,
          monthly: acc.monthly + machine.monthly.total
        }), 
        { daily: 0, monthly: 0 }
      );

    const totalsTelevend = formattedMachines
      .filter((m: any) => m.source === 'televend')
      .reduce(
        (acc: { daily: number; monthly: number }, machine: any) => ({
          daily: acc.daily + machine.daily.total,
          monthly: acc.monthly + machine.monthly.total
        }), 
        { daily: 0, monthly: 0 }
      );

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
      totalsOrain,
      totalsTelevend,
      count: formattedMachines.length,
      countOrain: formattedMachines.filter((m: any) => m.source === 'orain').length,
      countTelevend: formattedMachines.filter((m: any) => m.source === 'televend').length,
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
