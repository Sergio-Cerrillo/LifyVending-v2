import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';
import {
  FrekuentApiError,
  getFrekuentStockMachines,
} from '@/lib/frekuent';
import {
  TelevendApiError,
  getTelevendStockMachines,
} from '@/lib/televend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireStockUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
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

function parseMachineIds(value: string | null): number[] {
  if (!value) return [];

  const ids = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item));

  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error('Parámetro machineIds no válido');
  }

  return Array.from(new Set(ids));
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStockUser(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const machineIds = parseMachineIds(request.nextUrl.searchParams.get('machineIds'));
    const provider = request.nextUrl.searchParams.get('provider') === 'televend' ? 'televend' : 'frekuent';
    const stockMachines = provider === 'televend'
      ? await getTelevendStockMachines(machineIds)
      : await getFrekuentStockMachines(machineIds);

    if (process.env.NODE_ENV === 'development') {
      console.log('[STOCK-LIVE] Respuesta recibida', {
        provider,
        machines: stockMachines.length,
        filteredMachines: machineIds.length,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'live',
      provider,
      requestedAt: new Date().toISOString(),
      selectedMachineIds: machineIds,
      stockMachines,
    });
  } catch (error) {
    console.error('[STOCK-API] Error:', error);

    if (error instanceof FrekuentApiError) {
      return NextResponse.json(
        { error: error.userMessage },
        { status: error.status },
      );
    }

    if (error instanceof TelevendApiError) {
      return NextResponse.json(
        { error: error.userMessage },
        { status: error.status },
      );
    }

    const message = error instanceof Error ? error.message : 'Error consultando Stock';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
