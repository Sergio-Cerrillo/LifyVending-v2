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
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
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

    return NextResponse.json({
      machines: formattedMachines,
      totals,
      totalsOrain,
      totalsTelevend,
      count: formattedMachines.length,
      countOrain: formattedMachines.filter((m: any) => m.source === 'orain').length,
      countTelevend: formattedMachines.filter((m: any) => m.source === 'televend').length
    });

  } catch (error: any) {
    console.error('Error obteniendo recaudaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
