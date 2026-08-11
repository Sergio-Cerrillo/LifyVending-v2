import { supabaseAdmin } from '@/lib/supabase-helpers';
import {
  formatDateForFrekuent,
  getFrekuentRevenueMachines,
  getMadridTodayRange,
  type FrekuentRevenueMachine,
} from '@/lib/frekuent';
import { generateFrekuentId } from '@/lib/machine-id-utils';

const FRESHNESS_MINUTES = Number(process.env.REVENUE_REFRESH_FRESHNESS_MINUTES || 30);

type RevenuePeriodKind = 'daily' | 'monthly';

interface SavedMachineRevenue {
  machineDbId: string;
  frekuentMachineId: string;
  normalizedId: string;
  revenue: FrekuentRevenueMachine;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isFresh(value: string | null | undefined, freshnessMinutes = FRESHNESS_MINUTES) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() < freshnessMinutes * 60 * 1000;
}

async function getActiveFrekuentJob() {
  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data } = await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .select('id, started_at, requested_at')
    .eq('action', 'frekuent')
    .in('status', ['queued', 'running'])
    .gte('requested_at', staleCutoff)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as { id: string } | null;
}

async function acquireFrekuentRefreshJob() {
  const active = await getActiveFrekuentJob();
  if (active) return { acquired: false as const, jobId: active.id };

  const { data, error } = await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .insert({
      action: 'frekuent',
      status: 'running',
      phase: 'api_refresh',
      progress: 10,
      started_at: new Date().toISOString(),
      attempts: 1,
    })
    .select('id')
    .single();

  if (error) {
    const conflict = error.code === '23505' || /duplicate|unique|uq_revenue_jobs_action_active/i.test(error.message || '');
    if (conflict) {
      const existing = await getActiveFrekuentJob();
      return { acquired: false as const, jobId: existing?.id || null };
    }

    // Algunas instalaciones antiguas no admitían action='frekuent'. No bloqueamos el refresco por eso.
    if (/check constraint|violates check/i.test(error.message || '')) {
      return { acquired: true as const, jobId: null };
    }

    throw new Error(`No se pudo crear bloqueo de actualización: ${error.message}`);
  }

  return { acquired: true as const, jobId: (data as any).id as string };
}

async function finishFrekuentRefreshJob(
  jobId: string | null,
  status: 'completed' | 'error',
  result: unknown,
  errorMessage?: string,
) {
  if (!jobId) return;

  await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .update({
      status,
      phase: status,
      progress: status === 'completed' ? 100 : 0,
      finished_at: new Date().toISOString(),
      result_json: status === 'completed' ? result : null,
      error_message: errorMessage || null,
    })
    .eq('id', jobId);
}

function madridMonthRange(year: number, month: number) {
  const offsetProbe = formatDateForFrekuent(new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)), 'Europe/Madrid');
  const offset = offsetProbe.slice(-6);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const paddedMonth = String(month).padStart(2, '0');

  return {
    startDate: `${year}-${paddedMonth}-01T00:00:00${offset}`,
    endDate: `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}T23:59:59${offset}`,
  };
}

function currentMadridMonthRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const { startDate } = madridMonthRange(year, month);

  return {
    startDate,
    endDate: formatDateForFrekuent(now, 'Europe/Madrid'),
  };
}

function previousMadridMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);

  let year = Number(parts.find((part) => part.type === 'year')?.value);
  let month = Number(parts.find((part) => part.type === 'month')?.value) - 1;

  if (month === 0) {
    month = 12;
    year -= 1;
  }

  return { year, month };
}

async function latestFrekuentRevenueUpdate() {
  const { data, error } = await supabaseAdmin
    .from('machines')
    .select('last_scraped_at')
    .or('frekuent_machine_id.not.is.null,orain_machine_id.not.is.null')
    .not('last_scraped_at', 'is', null)
    .order('last_scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo comprobar la última actualización: ${error.message}`);
  }

  return data?.last_scraped_at as string | null | undefined;
}

async function loadExistingFrekuentMachines() {
  const { data, error } = await supabaseAdmin
    .from('machines')
    .select('id, name, frekuent_machine_id, orain_machine_id')
    .or('frekuent_machine_id.not.is.null,orain_machine_id.not.is.null');

  if (error) {
    throw new Error(`No se pudieron leer máquinas existentes: ${error.message}`);
  }

  const byExternalId = new Map<string, string>();
  const byNormalizedName = new Map<string, string>();

  for (const row of data || []) {
    const machine = row as any;
    if (machine.frekuent_machine_id) byExternalId.set(String(machine.frekuent_machine_id), machine.id);
    if (machine.orain_machine_id) byExternalId.set(String(machine.orain_machine_id), machine.id);
    if (machine.name) byNormalizedName.set(generateFrekuentId(machine.name), machine.id);
  }

  return { byExternalId, byNormalizedName };
}

async function saveFrekuentRevenue(
  revenues: FrekuentRevenueMachine[],
  period: RevenuePeriodKind,
  scrapedAt: string,
): Promise<SavedMachineRevenue[]> {
  const existing = await loadExistingFrekuentMachines();
  const saved: SavedMachineRevenue[] = [];

	  const rows = revenues.map((revenue) => {
	    const numericId = String(revenue.machineId);
	    const normalizedId = generateFrekuentId(revenue.machineName);
	    const machineDbId = existing.byExternalId.get(numericId)
	      || existing.byExternalId.get(normalizedId)
	      || existing.byNormalizedName.get(normalizedId)
	      || crypto.randomUUID();

	    existing.byExternalId.set(numericId, machineDbId);
	    existing.byExternalId.set(normalizedId, machineDbId);
	    existing.byNormalizedName.set(normalizedId, machineDbId);

    saved.push({
      machineDbId,
      frekuentMachineId: numericId,
      normalizedId,
      revenue,
    });

    const row: Record<string, unknown> = {
      id: machineDbId,
      name: revenue.machineName,
      location: revenue.location || 'Sin ubicación',
      status: 'active',
      frekuent_machine_id: normalizedId,
      orain_machine_id: null,
      last_scraped_at: scrapedAt,
      updated_at: scrapedAt,
    };

    if (period === 'daily') {
      row.daily_total = revenue.totalMoney;
      row.daily_card = revenue.totalCard;
      row.daily_cash = revenue.totalCash;
      row.daily_updated_at = scrapedAt;
    } else {
      row.monthly_total = revenue.totalMoney;
      row.monthly_card = revenue.totalCard;
      row.monthly_cash = revenue.totalCash;
      row.monthly_updated_at = scrapedAt;
    }

    return row;
  });

  if (rows.length === 0) return [];

  const { error } = await supabaseAdmin
    .from('machines')
    .upsert(rows as any[], { onConflict: 'id' });

  if (error) {
    throw new Error(`No se pudo guardar recaudación ${period}: ${error.message}`);
  }

  return saved;
}

async function mapFrekuentRevenueToExistingMachines(
  revenues: FrekuentRevenueMachine[],
): Promise<SavedMachineRevenue[]> {
  const existing = await loadExistingFrekuentMachines();

  return revenues
    .map((revenue) => {
      const numericId = String(revenue.machineId);
      const normalizedId = generateFrekuentId(revenue.machineName);
      const machineDbId = existing.byExternalId.get(numericId)
        || existing.byExternalId.get(normalizedId)
        || existing.byNormalizedName.get(normalizedId);

      if (!machineDbId) return null;

      return {
        machineDbId,
        frekuentMachineId: numericId,
        normalizedId,
        revenue,
      };
    })
    .filter(Boolean) as SavedMachineRevenue[];
}

async function insertHistoricalVisibleAmount(payload: {
  clientId: string;
  machineId: string;
  year: number;
  month: number;
  visibleAmount: number;
  grossAmount: number;
  hiddenPercent: number;
  paymentPercent: number;
  commissionAmount: number;
  sourceRangeStart: string;
  sourceRangeEnd: string;
}) {
  const baseRow = {
    client_id: payload.clientId,
    machine_id: payload.machineId,
    year: payload.year,
    month: payload.month,
    amount_total: payload.visibleAmount,
    notes: null,
    created_by_user_id: null,
    updated_by_user_id: null,
  };

  const internalRow = {
    ...baseRow,
    gross_amount_internal: payload.grossAmount,
    hidden_percent_applied: payload.hiddenPercent,
    payment_percent_applied: payload.paymentPercent,
    commission_amount: payload.commissionAmount,
    source_provider: 'frekuent',
    source_range_start: payload.sourceRangeStart,
    source_range_end: payload.sourceRangeEnd,
    status: 'published',
    generated_by: 'system',
    generated_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from('client_revenue_history_adjustments' as any)
    .upsert(internalRow, { onConflict: 'client_id,machine_id,year,month', ignoreDuplicates: true });

  if (!error) return;

  const missingInternalColumns = /column|schema|cache|gross_amount_internal|hidden_percent_applied|payment_percent_applied/i.test(error.message || '');
  if (!missingInternalColumns) {
    throw new Error(`No se pudo guardar cierre mensual: ${error.message}`);
  }

  const { error: fallbackError } = await supabaseAdmin
    .from('client_revenue_history_adjustments' as any)
    .upsert(baseRow, { onConflict: 'client_id,machine_id,year,month', ignoreDuplicates: true });

  if (fallbackError) {
    throw new Error(`No se pudo guardar cierre mensual: ${fallbackError.message}`);
  }
}

export async function refreshFrekuentRevenueNow() {
  const scrapedAt = new Date().toISOString();
  const todayRange = getMadridTodayRange();
  const monthRange = currentMadridMonthRange();

  const [daily, monthly] = await Promise.all([
    getFrekuentRevenueMachines({ ...todayRange, datesLogic: 'today' }),
    getFrekuentRevenueMachines({ ...monthRange, datesLogic: 'current_month' }),
  ]);

  const dailySaved = await saveFrekuentRevenue(daily, 'daily', scrapedAt);
  const monthlySaved = await saveFrekuentRevenue(monthly, 'monthly', scrapedAt);

  return {
    refreshed: true,
    requestedAt: scrapedAt,
    daily: {
      machines: dailySaved.length,
      total: round2(daily.reduce((sum, item) => sum + item.totalMoney, 0)),
    },
    monthly: {
      machines: monthlySaved.length,
      total: round2(monthly.reduce((sum, item) => sum + item.totalMoney, 0)),
    },
  };
}

export async function refreshFrekuentRevenueIfStale() {
  const latestUpdate = await latestFrekuentRevenueUpdate();

  if (isFresh(latestUpdate)) {
    return {
      refreshed: false,
      reason: 'fresh',
      latestUpdate: latestUpdate || null,
    };
  }

  const lock = await acquireFrekuentRefreshJob();
  if (!lock.acquired) {
    return {
      refreshed: false,
      reason: 'already_running',
      latestUpdate: latestUpdate || null,
    };
  }

  try {
    const result = await refreshFrekuentRevenueNow();
    await finishFrekuentRefreshJob(lock.jobId, 'completed', result);
    return result;
  } catch (error) {
    await finishFrekuentRefreshJob(
      lock.jobId,
      'error',
      null,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

export async function closePendingPreviousMonth() {
  const { year, month } = previousMadridMonth();
  const range = madridMonthRange(year, month);

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from('client_machine_assignments')
    .select('client_id, machine_id');

  if (assignmentsError) {
    throw new Error(`No se pudieron leer asignaciones: ${assignmentsError.message}`);
  }

  const expectedAssignments = assignments || [];
  if (expectedAssignments.length === 0) {
    return {
      closed: false,
      reason: 'no_assignments',
      year,
      month,
    };
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('client_revenue_history_adjustments' as any)
    .select('client_id, machine_id')
    .eq('year', year)
    .eq('month', month);

  if (existingError) {
    throw new Error(`No se pudo comprobar el cierre mensual: ${existingError.message}`);
  }

  const existingKeys = new Set((existing || []).map((row: any) => `${row.client_id}:${row.machine_id}`));
  const pendingAssignments = expectedAssignments.filter((row: any) => !existingKeys.has(`${row.client_id}:${row.machine_id}`));

  if (pendingAssignments.length === 0) {
    return {
      closed: false,
      reason: 'already_closed',
      year,
      month,
    };
  }

  const revenues = await getFrekuentRevenueMachines({
    ...range,
    datesLogic: 'custom',
    pageSize: 200,
  });
  const mappedRevenues = await mapFrekuentRevenueToExistingMachines(revenues);
  const revenueByMachineId = new Map(mappedRevenues.map((item) => [item.machineDbId, item.revenue]));

  const clientIds = Array.from(new Set((assignments || []).map((row: any) => row.client_id).filter(Boolean)));
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from('client_settings')
    .select('client_id, commission_hide_percent, commission_payment_percent')
    .in('client_id', clientIds.length ? clientIds : ['00000000-0000-0000-0000-000000000000']);

  if (settingsError) {
    throw new Error(`No se pudieron leer configuraciones de cliente: ${settingsError.message}`);
  }

  const settingsByClient = new Map((settings || []).map((row: any) => [row.client_id, row]));
  let created = 0;

  for (const assignment of pendingAssignments) {
    const row = assignment as any;
    const revenue = revenueByMachineId.get(row.machine_id);
    if (!revenue) continue;

    const clientSettings = settingsByClient.get(row.client_id) || {};
    const hiddenPercent = Number(clientSettings.commission_hide_percent || 0);
    const paymentPercent = Number(clientSettings.commission_payment_percent || 0);
    const visibleAmount = round2(revenue.totalMoney * (1 - hiddenPercent / 100));
    const commissionAmount = round2(visibleAmount * (paymentPercent / 100));

    await insertHistoricalVisibleAmount({
      clientId: row.client_id,
      machineId: row.machine_id,
      year,
      month,
      visibleAmount,
      grossAmount: revenue.totalMoney,
      hiddenPercent,
      paymentPercent,
      commissionAmount,
      sourceRangeStart: range.startDate,
      sourceRangeEnd: range.endDate,
    });

    created += 1;
  }

  return {
    closed: true,
    year,
    month,
    created,
  };
}

export async function ensureRevenueFreshness() {
  const [refresh, monthlyClose] = await Promise.allSettled([
    refreshFrekuentRevenueIfStale(),
    closePendingPreviousMonth(),
  ]);

  return {
    refresh: refresh.status === 'fulfilled' ? refresh.value : { refreshed: false, error: refresh.reason instanceof Error ? refresh.reason.message : String(refresh.reason) },
    monthlyClose: monthlyClose.status === 'fulfilled' ? monthlyClose.value : { closed: false, error: monthlyClose.reason instanceof Error ? monthlyClose.reason.message : String(monthlyClose.reason) },
  };
}
