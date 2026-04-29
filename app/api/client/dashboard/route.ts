/**
 * API: Dashboard del cliente (recaudación NETA)
 * GET /api/client/dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, getLastScrapeRun } from '@/lib/supabase-helpers';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Cliente dashboard - iniciando...');
    
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('❌ No hay header de autorización');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('❌ Error de autenticación:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    console.log('✅ Usuario autenticado:', user.id);

    // Verificar que sea cliente (usar supabaseAdmin para bypass RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, display_name, company_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ Error obteniendo perfil:', profileError);
      return NextResponse.json({ error: 'Error obteniendo perfil' }, { status: 500 });
    }

    if (profile?.role !== 'client') {
      console.error('❌ Usuario no es cliente, rol:', profile?.role);
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    console.log('✅ Perfil cliente verificado');

    // Obtener settings del cliente (comisión)
    const { data: settings } = await supabaseAdmin
      .from('client_settings')
      .select('commission_hide_percent, commission_payment_percent')
      .eq('client_id', user.id)
      .single();

    // Obtener recaudación neta por periodo usando la función SQL
    const periods: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly'];
    
    const revenueByPeriod: Record<string, any> = {};

    for (const period of periods) {
      const { data: revenueData, error: revenueError } = await supabase
        .rpc('get_client_net_revenue', {
          p_client_id: user.id,
          p_period: period
        });

      if (revenueError) {
        console.error(`❌ Error obteniendo revenue ${period}:`, revenueError);
        console.error(`   Details:`, JSON.stringify(revenueError, null, 2));
        // No fallar, solo devolver datos vacíos para este periodo
        revenueByPeriod[period] = { total: 0, machines: [], lastUpdate: null };
        continue;
      }

      const machines = revenueData || [];
      const total = machines.reduce((sum, m) => sum + (parseFloat(m.amount_net as any) || 0), 0);
      const lastUpdate = machines.length > 0 ? machines[0].scraped_at : null;

      revenueByPeriod[period] = {
        total: Math.round(total * 100) / 100,
        machines: machines.map(m => ({
          id: m.machine_id,
          name: m.machine_name,
          location: m.location,
          amountNet: Math.round(parseFloat(m.amount_net as any) * 100) / 100
        })),
        lastUpdate
      };
    }

    // Obtener máquinas asignadas (usar supabaseAdmin para bypass RLS)
    console.log('📦 Obteniendo máquinas asignadas...');
    const { data: assignments, error: assignmentsError } = await supabaseAdmin
      .from('client_machine_assignments')
      .select('machine_id, machines(*)')
      .eq('client_id', user.id);

    if (assignmentsError) {
      console.error('❌ Error obteniendo asignaciones:', assignmentsError);
      return NextResponse.json({ error: 'Error obteniendo máquinas asignadas' }, { status: 500 });
    }

    const machines = (assignments || []).map(a => (a as any).machines).filter(Boolean);
    console.log(`✅ Máquinas asignadas: ${machines.length}`, machines.map(m => m.name));

    // Obtener último scrape run
    console.log('🔄 Obteniendo último scrape...');
    const lastScrape = await getLastScrapeRun(user.id);

    console.log('✅ Dashboard cargado correctamente');
    
    return NextResponse.json({
      success: true,
      profile: {
        displayName: profile.display_name,
        companyName: profile.company_name
      },
      commission: {
        hidePercent: settings?.commission_hide_percent || 0,
        paymentPercent: settings?.commission_payment_percent || 0
      },
      machines,
      revenue: {
        daily: revenueByPeriod.daily,
        weekly: revenueByPeriod.weekly,
        monthly: revenueByPeriod.monthly
      },
      lastScrape: lastScrape ? {
        id: lastScrape.id,
        status: lastScrape.status,
        startedAt: lastScrape.started_at,
        finishedAt: lastScrape.finished_at
      } : null
    });

  } catch (error: any) {
    console.error('❌ Error obteniendo dashboard del cliente:', error);
    console.error('   Stack:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
