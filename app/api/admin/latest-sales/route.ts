import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';
import {
  formatDateForFrekuent,
  getFrekuentLatestSales,
  getFrekuentRevenueMachines,
  getMadridTodayRange,
} from '@/lib/frekuent';
import { getTelevendLatestSales } from '@/lib/televend';

export const dynamic = 'force-dynamic';

type Provider = 'frekuent' | 'televend';

interface MachineRow {
  id: string;
  name: string | null;
  frekuent_machine_id: string | null;
  televend_machine_id: string | null;
  last_scraped_at: string | null;
}

interface LatestSale {
  id: string;
  provider: Provider;
  machineId: number;
  machineName: string;
  productName: string;
  datetime: string;
  paymentMethod: string;
  amount: number;
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
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

  if (profile.role !== 'admin') {
    return { error: 'Permisos insuficientes', status: 403 as const };
  }

  return { user, profile };
}

function madridLocalToUtcIso(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  const offset = formatDateForFrekuent(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)), 'Europe/Madrid').slice(-6);

  return {
    fromTimestamp: new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000${offset}`).toISOString(),
    toTimestamp: now.toISOString(),
  };
}

function providerOf(machine: MachineRow): Provider {
  return machine.televend_machine_id ? 'televend' : 'frekuent';
}

function numericId(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function currentProviderMachines(machines: MachineRow[]) {
  const latestByProvider = machines.reduce((acc: Record<Provider, number>, machine) => {
    const provider = providerOf(machine);
    const timestamp = machine.last_scraped_at ? new Date(machine.last_scraped_at).getTime() : 0;
    if (timestamp > (acc[provider] || 0)) acc[provider] = timestamp;
    return acc;
  }, { frekuent: 0, televend: 0 });

  return machines.filter((machine) => {
    const provider = providerOf(machine);
    const timestamp = machine.last_scraped_at ? new Date(machine.last_scraped_at).getTime() : 0;
    return timestamp > 0 && timestamp === latestByProvider[provider];
  });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const limit = Math.max(1, Math.min(30, Number(request.nextUrl.searchParams.get('limit') || 12)));
    const { data, error } = await supabaseAdmin
      .from('machines')
      .select('id, name, frekuent_machine_id, televend_machine_id, last_scraped_at')
      .or('frekuent_machine_id.not.is.null,televend_machine_id.not.is.null');

    if (error) throw new Error(`No se pudieron cargar máquinas: ${error.message}`);

    const machines = currentProviderMachines((data || []) as MachineRow[]);
    const televendIds = machines
      .map((machine) => numericId(machine.televend_machine_id))
      .filter((id): id is number => Boolean(id))
      .slice(0, 18);
    const nameByTelevendId = new Map(machines.map((machine) => [numericId(machine.televend_machine_id), machine.name || 'Televend']).filter(([id]) => id));

    const frekuentRange = getMadridTodayRange();
    const televendRange = madridLocalToUtcIso();
    const frekuentRevenueMachines = await getFrekuentRevenueMachines({
      ...frekuentRange,
      datesLogic: 'today',
      pageSize: 100,
    }).catch(() => []);
    const frekuentIds = frekuentRevenueMachines
      .filter((machine) => machine.totalMoney > 0 || machine.numberTransactions > 0)
      .sort((a, b) => b.totalMoney - a.totalMoney)
      .map((machine) => machine.machineId)
      .slice(0, 18);
    const nameByFrekuentId = new Map(frekuentRevenueMachines.map((machine) => [machine.machineId, machine.machineName]));

    const [frekuentResult, televendResult] = await Promise.allSettled([
      getFrekuentLatestSales({
        machineIds: frekuentIds,
        startDate: frekuentRange.startDate,
        endDate: frekuentRange.endDate,
        perMachineLimit: 3,
      }),
      getTelevendLatestSales({
        ...televendRange,
        machineIds: televendIds,
        limit: 3,
      }),
    ]);

    const sales: LatestSale[] = [
      ...(frekuentResult.status === 'fulfilled' ? frekuentResult.value.map((sale) => ({
        id: `frekuent-${sale.id}`,
        provider: 'frekuent' as const,
        machineId: sale.machineId,
        machineName: sale.machineName || String(nameByFrekuentId.get(sale.machineId) || 'Frekuent'),
        productName: sale.productName,
        datetime: sale.datetime,
        paymentMethod: sale.paymentMethod,
        amount: sale.amount,
      })) : []),
      ...(televendResult.status === 'fulfilled' ? televendResult.value.map((sale) => ({
        id: `televend-${sale.id}`,
        provider: 'televend' as const,
        machineId: sale.machineId,
        machineName: sale.machineName || String(nameByTelevendId.get(sale.machineId) || 'Televend'),
        productName: sale.productName,
        datetime: sale.datetime,
        paymentMethod: sale.paymentMethod,
        amount: sale.amount,
      })) : []),
    ].sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()).slice(0, limit);

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      sales,
    });
  } catch (error) {
    console.error('[ADMIN-LATEST-SALES] Error:', error);
    const message = error instanceof Error ? error.message : 'Error cargando últimas ventas';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
