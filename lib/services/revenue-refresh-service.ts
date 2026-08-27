import { supabaseAdmin } from '@/lib/supabase-helpers';
import {
  formatDateForFrekuent,
  getFrekuentRevenueMachines,
  getMadridTodayRange,
  type FrekuentRevenueMachine,
} from '@/lib/frekuent';
import {
  getTelevendRevenueMachines,
  type TelevendRevenueMachine,
} from '@/lib/televend';
import { generateFrekuentId, generateTelevendId } from '@/lib/machine-id-utils';

const FRESHNESS_MINUTES = Number(process.env.REVENUE_REFRESH_FRESHNESS_MINUTES || 30);

type RevenuePeriodKind = 'daily' | 'weekly' | 'monthly';

interface SavedMachineRevenue {
  machineDbId: string;
  frekuentMachineId: string;
  normalizedId: string;
  revenue: FrekuentRevenueMachine;
}

interface SavedTelevendMachineRevenue {
  machineDbId: string;
  televendMachineId: string;
  normalizedId: string;
  revenue: TelevendRevenueMachine;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isFresh(value: string | null | undefined, freshnessMinutes = FRESHNESS_MINUTES) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() < freshnessMinutes * 60 * 1000;
}

async function getActiveFrekuentJob() {
  return getActiveRevenueJob('frekuent');
}

async function getActiveRevenueJob(action: 'frekuent' | 'televend') {
  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data } = await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .select('id, started_at, requested_at')
    .eq('action', action)
    .in('status', ['queued', 'running'])
    .gte('requested_at', staleCutoff)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as { id: string } | null;
}

async function acquireFrekuentRefreshJob() {
  return acquireRevenueRefreshJob('frekuent');
}

async function acquireRevenueRefreshJob(action: 'frekuent' | 'televend') {
  const active = await getActiveRevenueJob(action);
  if (active) return { acquired: false as const, jobId: active.id };

  const { data, error } = await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .insert({
      action,
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
      const existing = await getActiveRevenueJob(action);
      return { acquired: false as const, jobId: existing?.id || null };
    }

    // Algunas instalaciones antiguas no admitían estos valores de action. No bloqueamos el refresco por eso.
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
  return finishRevenueRefreshJob(jobId, status, result, errorMessage);
}

async function finishRevenueRefreshJob(
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

function currentMadridWeekRange(now = new Date()) {
  const { year, month, day } = madridParts(now);
  const madridNoon = new Date(madridLocalToUtcIso({ year, month, day, hour: 12 }));

  // Intl no da un número de día de semana. Usamos UTC sobre una fecha construida a mediodía
  // para evitar saltos raros de zona horaria; lunes es inicio operativo.
  const utcDay = madridNoon.getUTCDay();
  const daysFromMonday = utcDay === 0 ? 6 : utcDay - 1;
  const monday = new Date(madridNoon.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);

  return {
    startDate: formatDateForFrekuent(monday, 'Europe/Madrid'),
    endDate: formatDateForFrekuent(now, 'Europe/Madrid'),
  };
}

function madridParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

function madridLocalToUtcIso({
  year,
  month,
  day,
  hour,
  minute = 0,
  second = 0,
  millisecond = 0,
}: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  second?: number;
  millisecond?: number;
}) {
  const offsetProbe = formatDateForFrekuent(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)), 'Europe/Madrid');
  const offset = offsetProbe.slice(-6);
  const localIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(millisecond).padStart(3, '0')}${offset}`;
  return new Date(localIso).toISOString();
}

function getTelevendMadridTodayRange(now = new Date()) {
  const { year, month, day } = madridParts(now);
  return {
    fromTimestamp: madridLocalToUtcIso({ year, month, day, hour: 0 }),
    toTimestamp: madridLocalToUtcIso({ year, month, day, hour: 23, minute: 59, second: 59, millisecond: 999 }),
  };
}

function televendMadridMonthRange(year: number, month: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    fromTimestamp: madridLocalToUtcIso({ year, month, day: 1, hour: 0 }),
    toTimestamp: madridLocalToUtcIso({ year, month, day: lastDay, hour: 23, minute: 59, second: 59, millisecond: 999 }),
  };
}

function currentTelevendMadridMonthRange(now = new Date()) {
  const { year, month } = madridParts(now);
  return {
    fromTimestamp: madridLocalToUtcIso({ year, month, day: 1, hour: 0 }),
    toTimestamp: now.toISOString(),
  };
}

function currentTelevendMadridWeekRange(now = new Date()) {
  const { year, month, day } = madridParts(now);
  const madridNoon = new Date(madridLocalToUtcIso({ year, month, day, hour: 12 }));
  const utcDay = madridNoon.getUTCDay();
  const daysFromMonday = utcDay === 0 ? 6 : utcDay - 1;
  const monday = new Date(madridNoon.getTime() - daysFromMonday * 24 * 60 * 60 * 1000);
  const mondayParts = madridParts(monday);

  return {
    fromTimestamp: madridLocalToUtcIso({ ...mondayParts, hour: 0 }),
    toTimestamp: now.toISOString(),
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

async function latestTelevendRevenueUpdate() {
  const { data, error } = await supabaseAdmin
    .from('machines')
    .select('last_scraped_at')
    .not('televend_machine_id', 'is', null)
    .not('last_scraped_at', 'is', null)
    .order('last_scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`No se pudo comprobar la última actualización de Televend: ${error.message}`);
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

    const serialMatch = String(machine.frekuent_machine_id || machine.name || '').match(/id[_:\s-]*(\d{4,})$/i);
    if (serialMatch?.[1]) byExternalId.set(`serial:${serialMatch[1]}`, machine.id);
  }

  return { byExternalId, byNormalizedName };
}

function frekuentExternalCandidates(revenue: FrekuentRevenueMachine) {
  const machineId = String(revenue.machineId);
  const normalizedId = generateFrekuentId(revenue.machineName);
  const candidates = [machineId, normalizedId];

  if (revenue.machineNumber) candidates.push(generateFrekuentId(revenue.machineNumber));
  if (revenue.serialNumber) {
    candidates.push(String(revenue.serialNumber));
    candidates.push(`serial:${revenue.serialNumber}`);
  }

  const sourceForNumber = `${revenue.machineName} ${revenue.machineNumber || ''}`;
  const machineNumberMatch = sourceForNumber.match(/(?:^|\s)(\d{4})(?:\D*$|\s)/);
  if (machineNumberMatch?.[1] && revenue.serialNumber) {
    candidates.push(generateFrekuentId(`STP ${machineNumberMatch[1]}ID: ${revenue.serialNumber}`));
    candidates.push(generateFrekuentId(`${machineNumberMatch[1]}ID: ${revenue.serialNumber}`));
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

async function loadExistingTelevendMachines() {
  const { data, error } = await supabaseAdmin
    .from('machines')
    .select('id, name, televend_machine_id')
    .not('televend_machine_id', 'is', null);

  if (error) {
    throw new Error(`No se pudieron leer máquinas Televend existentes: ${error.message}`);
  }

  const byExternalId = new Map<string, string>();
  const byNormalizedName = new Map<string, string>();

  for (const row of data || []) {
    const machine = row as any;
    if (machine.televend_machine_id) byExternalId.set(String(machine.televend_machine_id), machine.id);
    if (machine.name) byNormalizedName.set(generateTelevendId(machine.name), machine.id);
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
      const externalCandidates = frekuentExternalCandidates(revenue);
	    const machineDbId = externalCandidates.map((candidate) => existing.byExternalId.get(candidate)).find(Boolean)
	      || existing.byNormalizedName.get(normalizedId)
	      || crypto.randomUUID();

      for (const candidate of externalCandidates) {
        existing.byExternalId.set(candidate, machineDbId);
      }
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
      orain_machine_id: numericId,
      last_scraped_at: scrapedAt,
      updated_at: scrapedAt,
    };

    if (period === 'daily') {
      row.daily_total = revenue.totalMoney;
      row.daily_card = revenue.totalCard;
      row.daily_cash = revenue.totalCash;
      row.daily_updated_at = scrapedAt;
    } else if (period === 'weekly') {
      row.weekly_total = revenue.totalMoney;
      row.weekly_card = revenue.totalCard;
      row.weekly_cash = revenue.totalCash;
      row.weekly_updated_at = scrapedAt;
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

async function saveTelevendRevenue(
  revenues: TelevendRevenueMachine[],
  period: RevenuePeriodKind,
  scrapedAt: string,
): Promise<SavedTelevendMachineRevenue[]> {
  const existing = await loadExistingTelevendMachines();
  const saved: SavedTelevendMachineRevenue[] = [];

  const rows = revenues.map((revenue) => {
    const numericId = String(revenue.machineId);
    const normalizedId = generateTelevendId(revenue.machineName);
    const machineDbId = existing.byExternalId.get(numericId)
      || existing.byExternalId.get(normalizedId)
      || existing.byNormalizedName.get(normalizedId)
      || crypto.randomUUID();

    existing.byExternalId.set(numericId, machineDbId);
    existing.byExternalId.set(normalizedId, machineDbId);
    existing.byNormalizedName.set(normalizedId, machineDbId);

    saved.push({
      machineDbId,
      televendMachineId: numericId,
      normalizedId,
      revenue,
    });

    const row: Record<string, unknown> = {
      id: machineDbId,
      name: revenue.machineName,
      location: revenue.location || 'Sin ubicación',
      status: 'active',
      frekuent_machine_id: null,
      orain_machine_id: null,
      televend_machine_id: numericId,
      last_scraped_at: scrapedAt,
      updated_at: scrapedAt,
    };

    if (period === 'daily') {
      row.daily_total = revenue.totalRevenue;
      row.daily_card = revenue.totalCard;
      row.daily_cash = revenue.totalCash;
      row.daily_updated_at = scrapedAt;
    } else if (period === 'weekly') {
      row.weekly_total = revenue.totalRevenue;
      row.weekly_card = revenue.totalCard;
      row.weekly_cash = revenue.totalCash;
      row.weekly_updated_at = scrapedAt;
    } else {
      row.monthly_total = revenue.totalRevenue;
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
    throw new Error(`No se pudo guardar recaudación Televend ${period}: ${error.message}`);
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
      const externalCandidates = frekuentExternalCandidates(revenue);
      const machineDbId = externalCandidates.map((candidate) => existing.byExternalId.get(candidate)).find(Boolean)
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

async function mapTelevendRevenueToExistingMachines(
  revenues: TelevendRevenueMachine[],
): Promise<SavedTelevendMachineRevenue[]> {
  const existing = await loadExistingTelevendMachines();

  return revenues
    .map((revenue) => {
      const numericId = String(revenue.machineId);
      const normalizedId = generateTelevendId(revenue.machineName);
      const machineDbId = existing.byExternalId.get(numericId)
        || existing.byExternalId.get(normalizedId)
        || existing.byNormalizedName.get(normalizedId);

      if (!machineDbId) return null;

      return {
        machineDbId,
        televendMachineId: numericId,
        normalizedId,
        revenue,
      };
    })
    .filter(Boolean) as SavedTelevendMachineRevenue[];
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
  sourceProvider: 'frekuent' | 'televend';
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
    source_provider: payload.sourceProvider,
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
  const weekRange = currentMadridWeekRange();
  const monthRange = currentMadridMonthRange();

  const [daily, weekly, monthly] = await Promise.all([
    getFrekuentRevenueMachines({ ...todayRange, datesLogic: 'today' }),
    getFrekuentRevenueMachines({ ...weekRange, datesLogic: 'custom' }),
    getFrekuentRevenueMachines({ ...monthRange, datesLogic: 'current_month' }),
  ]);

  const dailySaved = await saveFrekuentRevenue(daily, 'daily', scrapedAt);
  const weeklySaved = await saveFrekuentRevenue(weekly, 'weekly', scrapedAt);
  const monthlySaved = await saveFrekuentRevenue(monthly, 'monthly', scrapedAt);

  return {
    refreshed: true,
    requestedAt: scrapedAt,
    daily: {
      machines: dailySaved.length,
      total: round2(daily.reduce((sum, item) => sum + item.totalMoney, 0)),
    },
    weekly: {
      machines: weeklySaved.length,
      total: round2(weekly.reduce((sum, item) => sum + item.totalMoney, 0)),
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

export async function refreshTelevendRevenueNow() {
  const scrapedAt = new Date().toISOString();
  const todayRange = getTelevendMadridTodayRange();
  const weekRange = currentTelevendMadridWeekRange();
  const monthRange = currentTelevendMadridMonthRange();

  const [daily, weekly, monthly] = await Promise.all([
    getTelevendRevenueMachines(todayRange),
    getTelevendRevenueMachines(weekRange),
    getTelevendRevenueMachines(monthRange),
  ]);

  const dailySaved = await saveTelevendRevenue(daily, 'daily', scrapedAt);
  const weeklySaved = await saveTelevendRevenue(weekly, 'weekly', scrapedAt);
  const monthlySaved = await saveTelevendRevenue(monthly, 'monthly', scrapedAt);

  return {
    refreshed: true,
    requestedAt: scrapedAt,
    daily: {
      machines: dailySaved.length,
      total: round2(daily.reduce((sum, item) => sum + item.totalRevenue, 0)),
      sales: daily.reduce((sum, item) => sum + item.totalSales, 0),
      quantity: daily.reduce((sum, item) => sum + item.totalQuantity, 0),
    },
    weekly: {
      machines: weeklySaved.length,
      total: round2(weekly.reduce((sum, item) => sum + item.totalRevenue, 0)),
      sales: weekly.reduce((sum, item) => sum + item.totalSales, 0),
      quantity: weekly.reduce((sum, item) => sum + item.totalQuantity, 0),
    },
    monthly: {
      machines: monthlySaved.length,
      total: round2(monthly.reduce((sum, item) => sum + item.totalRevenue, 0)),
      sales: monthly.reduce((sum, item) => sum + item.totalSales, 0),
      quantity: monthly.reduce((sum, item) => sum + item.totalQuantity, 0),
    },
  };
}

export async function refreshTelevendRevenueIfStale() {
  const latestUpdate = await latestTelevendRevenueUpdate();

  if (isFresh(latestUpdate)) {
    return {
      refreshed: false,
      reason: 'fresh',
      latestUpdate: latestUpdate || null,
    };
  }

  const lock = await acquireRevenueRefreshJob('televend');
  if (!lock.acquired) {
    return {
      refreshed: false,
      reason: 'already_running',
      latestUpdate: latestUpdate || null,
    };
  }

  try {
    const result = await refreshTelevendRevenueNow();
    await finishRevenueRefreshJob(lock.jobId, 'completed', result);
    return result;
  } catch (error) {
    await finishRevenueRefreshJob(
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
  const televendRange = televendMadridMonthRange(year, month);

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

  const [frekuentRevenues, televendRevenues] = await Promise.allSettled([
    getFrekuentRevenueMachines({
      ...range,
      datesLogic: 'custom',
      pageSize: 200,
    }),
    getTelevendRevenueMachines(televendRange),
  ]);

  const mappedFrekuentRevenues = frekuentRevenues.status === 'fulfilled'
    ? await mapFrekuentRevenueToExistingMachines(frekuentRevenues.value)
    : [];
  const mappedTelevendRevenues = televendRevenues.status === 'fulfilled'
    ? await mapTelevendRevenueToExistingMachines(televendRevenues.value)
    : [];

  const revenueByMachineId = new Map<string, { amount: number; sourceProvider: 'frekuent' | 'televend' }>();
  for (const item of mappedFrekuentRevenues) {
    revenueByMachineId.set(item.machineDbId, { amount: item.revenue.totalMoney, sourceProvider: 'frekuent' });
  }
  for (const item of mappedTelevendRevenues) {
    revenueByMachineId.set(item.machineDbId, { amount: item.revenue.totalRevenue, sourceProvider: 'televend' });
  }

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
    const revenueInfo = revenueByMachineId.get(row.machine_id);
    if (!revenueInfo) continue;

    const clientSettings = settingsByClient.get(row.client_id) || {};
    const hiddenPercent = Number(clientSettings.commission_hide_percent || 0);
    const paymentPercent = Number(clientSettings.commission_payment_percent || 0);
    const visibleAmount = round2(revenueInfo.amount * (1 - hiddenPercent / 100));
    const commissionAmount = round2(visibleAmount * (paymentPercent / 100));

    await insertHistoricalVisibleAmount({
      clientId: row.client_id,
      machineId: row.machine_id,
      year,
      month,
      visibleAmount,
      grossAmount: revenueInfo.amount,
      hiddenPercent,
      paymentPercent,
      commissionAmount,
      sourceRangeStart: revenueInfo.sourceProvider === 'televend' ? televendRange.fromTimestamp : range.startDate,
      sourceRangeEnd: revenueInfo.sourceProvider === 'televend' ? televendRange.toTimestamp : range.endDate,
      sourceProvider: revenueInfo.sourceProvider,
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
  const [refresh, televendRefresh, monthlyClose] = await Promise.allSettled([
    refreshFrekuentRevenueIfStale(),
    refreshTelevendRevenueIfStale(),
    closePendingPreviousMonth(),
  ]);

  return {
    refresh: refresh.status === 'fulfilled' ? refresh.value : { refreshed: false, error: refresh.reason instanceof Error ? refresh.reason.message : String(refresh.reason) },
    televendRefresh: televendRefresh.status === 'fulfilled' ? televendRefresh.value : { refreshed: false, error: televendRefresh.reason instanceof Error ? televendRefresh.reason.message : String(televendRefresh.reason) },
    monthlyClose: monthlyClose.status === 'fulfilled' ? monthlyClose.value : { closed: false, error: monthlyClose.reason instanceof Error ? monthlyClose.reason.message : String(monthlyClose.reason) },
  };
}
