import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase con service_role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Obtener el conteo de máquinas activas
    const { data: machines, error: machinesError } = await supabaseAdmin
      .from('machines')
      .select('id, status')
      .eq('status', 'active');

    if (machinesError) throw machinesError;

    const totalMachines = machines?.length || 0;

    // Obtener snapshots más recientes (últimas 24 horas)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: recentSnapshots, error: snapshotsError } = await supabaseAdmin
      .from('machine_revenue_snapshots')
      .select('*')
      .gte('scraped_at', oneDayAgo.toISOString())
      .order('scraped_at', { ascending: false });

    if (snapshotsError) throw snapshotsError;

    // Calcular última actualización
    const lastUpdate = recentSnapshots && recentSnapshots.length > 0 
      ? new Date(recentSnapshots[0].scraped_at) 
      : null;

    // Calcular totales por periodo
    const dailySnapshots = recentSnapshots?.filter(s => s.period === 'daily') || [];
    const weeklySnapshots = recentSnapshots?.filter(s => s.period === 'weekly') || [];
    const monthlySnapshots = recentSnapshots?.filter(s => s.period === 'monthly') || [];

    // Para cada máquina, obtener el snapshot más reciente de cada periodo
    const getMostRecentByMachine = (snapshots: any[]) => {
      const byMachine = new Map();
      snapshots.forEach(snap => {
        const existing = byMachine.get(snap.machine_id);
        if (!existing || new Date(snap.scraped_at) > new Date(existing.scraped_at)) {
          byMachine.set(snap.machine_id, snap);
        }
      });
      return Array.from(byMachine.values());
    };

    const latestDailyByMachine = getMostRecentByMachine(dailySnapshots);
    const latestWeeklyByMachine = getMostRecentByMachine(weeklySnapshots);
    const latestMonthlyByMachine = getMostRecentByMachine(monthlySnapshots);

    // Calcular totales
    const calculateTotals = (snapshots: any[]) => {
      return snapshots.reduce((acc, snap) => {
        acc.totalRevenue += snap.amount_gross || 0;
        acc.totalCard += snap.anonymous_card || 0;
        acc.totalCash += snap.anonymous_cash || 0;
        return acc;
      }, { totalRevenue: 0, totalCard: 0, totalCash: 0 });
    };

    const dailyTotals = calculateTotals(latestDailyByMachine);
    const weeklyTotals = calculateTotals(latestWeeklyByMachine);
    const monthlyTotals = calculateTotals(latestMonthlyByMachine);

    // Calcular tendencias (comparar con periodo anterior)
    // Para simplicidad, calcularemos el cambio porcentual usando datos históricos
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: previousSnapshots } = await supabaseAdmin
      .from('machine_revenue_snapshots')
      .select('*')
      .gte('scraped_at', twoDaysAgo.toISOString())
      .lt('scraped_at', oneDayAgo.toISOString())
      .eq('period', 'daily');

    const previousDailyByMachine = getMostRecentByMachine(previousSnapshots || []);
    const previousDailyTotals = calculateTotals(previousDailyByMachine);

    const dailyChange = previousDailyTotals.totalRevenue > 0
      ? ((dailyTotals.totalRevenue - previousDailyTotals.totalRevenue) / previousDailyTotals.totalRevenue) * 100
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        lastUpdate: lastUpdate?.toISOString(),
        totalMachines,
        activeMachines: totalMachines,
        daily: {
          totalRevenue: dailyTotals.totalRevenue,
          totalCard: dailyTotals.totalCard,
          totalCash: dailyTotals.totalCash,
          machineCount: latestDailyByMachine.length,
          change: dailyChange
        },
        weekly: {
          totalRevenue: weeklyTotals.totalRevenue,
          totalCard: weeklyTotals.totalCard,
          totalCash: weeklyTotals.totalCash,
          machineCount: latestWeeklyByMachine.length
        },
        monthly: {
          totalRevenue: monthlyTotals.totalRevenue,
          totalCard: monthlyTotals.totalCard,
          totalCash: monthlyTotals.totalCash,
          machineCount: latestMonthlyByMachine.length
        }
      }
    });
  } catch (error: any) {
    console.error('[DASHBOARD] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error fetching dashboard data' },
      { status: 500 }
    );
  }
}
