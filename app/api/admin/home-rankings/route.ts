import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export const dynamic = 'force-dynamic';

type Provider = 'frekuent' | 'televend';

interface MachineRow {
  id: string;
  name: string | null;
  location: string | null;
  status: string | null;
  frekuent_machine_id: string | null;
  televend_machine_id: string | null;
  daily_total: number | null;
  monthly_total: number | null;
  daily_updated_at: string | null;
  monthly_updated_at: string | null;
  last_scraped_at: string | null;
}

interface StockRow {
  machine_id: string;
  machine_name: string | null;
  machine_location: string | null;
  scraped_at: string | null;
  total_capacity: number | null;
  total_available: number | null;
  total_to_replenish: number | null;
}

async function requireAdminOrOperator(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );

  if (authError || !user) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Error obteniendo perfil', status: 500 as const };
  }

  if (!['admin', 'operador'].includes(profile.role)) {
    return { error: 'Permisos insuficientes', status: 403 as const };
  }

  return { user, profile };
}

function getProvider(machine: MachineRow): Provider {
  return machine.televend_machine_id ? 'televend' : 'frekuent';
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function getFillRate(stock?: StockRow) {
  const capacity = Number(stock?.total_capacity || 0);
  const available = Number(stock?.total_available || 0);
  if (capacity <= 0) return null;
  return Math.round((available / capacity) * 100);
}

function getUrgency(fillRate: number | null) {
  if (fillRate === null) return 'unknown';
  if (fillRate <= 0) return 'empty';
  if (fillRate < 65) return 'critical';
  if (fillRate < 75) return 'normal';
  return 'ok';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminOrOperator(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const [machinesResult, stockResult] = await Promise.all([
      supabaseAdmin
        .from('machines')
        .select('id, name, location, status, frekuent_machine_id, televend_machine_id, daily_total, monthly_total, daily_updated_at, monthly_updated_at, last_scraped_at')
        .or('frekuent_machine_id.not.is.null,televend_machine_id.not.is.null')
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('machine_stock_current')
        .select('machine_id, machine_name, machine_location, scraped_at, total_capacity, total_available, total_to_replenish'),
    ]);

    if (machinesResult.error) {
      throw new Error(`No se pudieron cargar máquinas: ${machinesResult.error.message}`);
    }
    if (stockResult.error) {
      throw new Error(`No se pudo cargar stock: ${stockResult.error.message}`);
    }

    const stockByMachine = new Map<string, StockRow>();
    for (const row of (stockResult.data || []) as StockRow[]) {
      stockByMachine.set(row.machine_id, row);
    }

    const machines = ((machinesResult.data || []) as MachineRow[]).map((machine) => {
      const stock = stockByMachine.get(machine.id);
      const fillRate = getFillRate(stock);
      const provider = getProvider(machine);

      return {
        id: machine.id,
        name: machine.name || stock?.machine_name || 'Máquina',
        location: machine.location || stock?.machine_location || null,
        provider,
        dailyTotal: roundCurrency(Number(machine.daily_total || 0)),
        monthlyTotal: roundCurrency(Number(machine.monthly_total || 0)),
        fillRate,
        urgency: getUrgency(fillRate),
        totalToReplenish: Number(stock?.total_to_replenish || 0),
        totalCapacity: Number(stock?.total_capacity || 0),
        totalAvailable: Number(stock?.total_available || 0),
        revenueUpdatedAt: machine.daily_updated_at || machine.monthly_updated_at || machine.last_scraped_at,
        stockUpdatedAt: stock?.scraped_at || null,
      };
    });

    const activeMachines = machines.filter((machine) => machine.id);
    const totalDaily = roundCurrency(activeMachines.reduce((sum, machine) => sum + machine.dailyTotal, 0));
    const totalMonthly = roundCurrency(activeMachines.reduce((sum, machine) => sum + machine.monthlyTotal, 0));
    const totalToReplenish = activeMachines.reduce((sum, machine) => sum + machine.totalToReplenish, 0);

    const topDaily = [...activeMachines]
      .filter((machine) => machine.dailyTotal > 0)
      .sort((a, b) => b.dailyTotal - a.dailyTotal)
      .slice(0, 6);

    const topMonthly = [...activeMachines]
      .filter((machine) => machine.monthlyTotal > 0)
      .sort((a, b) => b.monthlyTotal - a.monthlyTotal)
      .slice(0, 6);

    const stockUrgencyOrder: Record<string, number> = {
      empty: 0,
      critical: 1,
      normal: 2,
      unknown: 3,
      ok: 4,
    };

    const stockPriority = [...activeMachines]
      .filter((machine) => machine.urgency !== 'ok' || machine.totalToReplenish > 0)
      .sort((a, b) => {
        const urgencyDiff = stockUrgencyOrder[a.urgency] - stockUrgencyOrder[b.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        if (b.totalToReplenish !== a.totalToReplenish) return b.totalToReplenish - a.totalToReplenish;
        return (a.fillRate ?? 101) - (b.fillRate ?? 101);
      })
      .slice(0, 6);

    const noSalesToday = [...activeMachines]
      .filter((machine) => machine.dailyTotal <= 0 && machine.monthlyTotal > 0)
      .sort((a, b) => b.monthlyTotal - a.monthlyTotal)
      .slice(0, 6);

    const providerSummary = activeMachines.reduce((acc, machine) => {
      acc[machine.provider].machines += 1;
      acc[machine.provider].dailyTotal = roundCurrency(acc[machine.provider].dailyTotal + machine.dailyTotal);
      acc[machine.provider].monthlyTotal = roundCurrency(acc[machine.provider].monthlyTotal + machine.monthlyTotal);
      return acc;
    }, {
      frekuent: { machines: 0, dailyTotal: 0, monthlyTotal: 0 },
      televend: { machines: 0, dailyTotal: 0, monthlyTotal: 0 },
    } as Record<Provider, { machines: number; dailyTotal: number; monthlyTotal: number }>);

    const lastUpdateCandidates = activeMachines
      .flatMap((machine) => [machine.revenueUpdatedAt, machine.stockUpdatedAt])
      .filter(Boolean)
      .map((value) => new Date(value as string).getTime())
      .filter(Number.isFinite);

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      lastUpdate: lastUpdateCandidates.length > 0
        ? new Date(Math.max(...lastUpdateCandidates)).toISOString()
        : null,
      summary: {
        machines: activeMachines.length,
        totalDaily,
        totalMonthly,
        totalToReplenish,
        criticalMachines: activeMachines.filter((machine) => machine.urgency === 'empty' || machine.urgency === 'critical').length,
        noSalesToday: activeMachines.filter((machine) => machine.dailyTotal <= 0 && machine.monthlyTotal > 0).length,
        providers: providerSummary,
      },
      rankings: {
        topDaily,
        topMonthly,
        stockPriority,
        noSalesToday,
      },
    });
  } catch (error) {
    console.error('[ADMIN-HOME-RANKINGS] Error:', error);
    const message = error instanceof Error ? error.message : 'Error cargando rankings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
