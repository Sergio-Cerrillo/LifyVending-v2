import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';
import {
  FrekuentApiError,
  getFrekuentStockMachines,
  type FrekuentStockMachine,
} from '@/lib/frekuent';
import {
  TelevendApiError,
  getTelevendStockMachines,
} from '@/lib/televend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Provider = 'frekuent' | 'televend';

async function requireDashboardUser(request: NextRequest) {
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

function summarizeMachines(provider: Provider, machines: FrekuentStockMachine[]) {
  const totalCapacity = machines.reduce((sum, machine) => sum + machine.totalCapacity, 0);
  const totalAvailable = machines.reduce((sum, machine) => sum + machine.totalAvailable, 0);

  return {
    provider,
    requestedAt: new Date().toISOString(),
    total: machines.length,
    empty: machines.filter((machine) => machine.urgency === 'empty').length,
    critical: machines.filter((machine) => machine.urgency === 'critical').length,
    normal: machines.filter((machine) => machine.urgency === 'normal').length,
    ok: machines.filter((machine) => machine.urgency === 'ok').length,
    unknown: machines.filter((machine) => machine.urgency === 'unknown').length,
    fillRate: totalCapacity > 0 ? Math.round((totalAvailable / totalCapacity) * 100) : 0,
    totalToReplenish: machines.reduce((sum, machine) => sum + machine.totalToReplenish, 0),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireDashboardUser(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const providerParam = request.nextUrl.searchParams.get('provider');
    const provider: Provider = providerParam === 'televend' ? 'televend' : 'frekuent';
    const machines = provider === 'televend'
      ? await getTelevendStockMachines()
      : await getFrekuentStockMachines();

    return NextResponse.json({
      success: true,
      status: summarizeMachines(provider, machines),
    });
  } catch (error) {
    console.error('[ADMIN-STOCK-STATUS] Error:', error);

    if (error instanceof FrekuentApiError || error instanceof TelevendApiError) {
      return NextResponse.json(
        { error: error.userMessage },
        { status: error.status },
      );
    }

    const message = error instanceof Error ? error.message : 'Error consultando estado de máquinas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
