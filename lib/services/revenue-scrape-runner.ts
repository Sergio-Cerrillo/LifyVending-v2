import { supabaseAdmin } from '@/lib/supabase-helpers';
import { scrapeFrekuentRevenueMultiple } from '@/scraper/frekuent-revenue-scraper';
import { generateFrekuentId } from '@/lib/machine-id-utils';

export type RevenueJobAction = 'frekuent';

export type RevenueJobPhase =
  | 'validating'
  | 'frekuent'
  | 'saving'
  | 'completed'
  | 'error';

export interface ActionSummary {
  machinesTouched: number;
  machinesCreated: number;
  machinesUpdated: number;
  revenueUpdates: number;
  totalRevenue: number;
  durationSeconds: number;
}

export interface RevenueJobExecutionResult {
  action: RevenueJobAction;
  machinesScraped: number;
  totalRevenue: number;
  durationSeconds: number;
  details: Record<string, ActionSummary>;
}

export interface RevenueJobProgressEvent {
  phase: RevenueJobPhase;
  progress: number;
  message?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function requireFrekuentCredentials() {
  const username = process.env.FREKUENT_USERNAME || process.env.ORAIN_USERNAME;
  const password = process.env.FREKUENT_PASSWORD || process.env.ORAIN_PASSWORD;

  if (!username || !password) {
    throw new Error('Faltan credenciales de Frekuent/Orain');
  }

  return { username, password };
}

async function saveFrekuentRevenueBulk(
  dailyData: Array<{ machineName: string; location: string; totalRevenue: number }>,
  monthlyData: Array<{ machineName: string; location: string; totalRevenue: number }>,
): Promise<{ daily: ActionSummary; monthly: ActionSummary }> {
  const startedAt = Date.now();
  const scrapedAt = nowIso();
  const combined = new Map<string, {
    machineName: string;
    location: string;
    daily?: number;
    monthly?: number;
  }>();

  for (const item of dailyData) {
    const frekuentId = generateFrekuentId(item.machineName);
    combined.set(frekuentId, {
      machineName: item.machineName,
      location: item.location || 'Sin ubicación',
      daily: item.totalRevenue,
    });
  }

  for (const item of monthlyData) {
    const frekuentId = generateFrekuentId(item.machineName);
    const existing = combined.get(frekuentId);
    combined.set(frekuentId, {
      machineName: item.machineName,
      location: item.location || existing?.location || 'Sin ubicación',
      daily: existing?.daily,
      monthly: item.totalRevenue,
    });
  }

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from('machines')
    .select('id, frekuent_machine_id, orain_machine_id')
    .or('frekuent_machine_id.not.is.null,orain_machine_id.not.is.null');

  if (existingError) {
    throw new Error(`No se pudieron leer las máquinas existentes: ${existingError.message}`);
  }

  const existingByExternalId = new Map<string, { id: string }>();
  for (const row of existingRows || []) {
    const typedRow = row as any;
    if (typedRow.frekuent_machine_id) {
      existingByExternalId.set(typedRow.frekuent_machine_id, { id: typedRow.id });
    }
    if (typedRow.orain_machine_id) {
      existingByExternalId.set(typedRow.orain_machine_id, { id: typedRow.id });
    }
  }

  let machinesCreated = 0;
  const rows = Array.from(combined.entries()).map(([frekuentId, item]) => {
    const existing = existingByExternalId.get(frekuentId);
    if (!existing) machinesCreated += 1;

    return {
      id: existing?.id || crypto.randomUUID(),
      name: item.machineName,
      location: item.location,
      status: 'active',
      frekuent_machine_id: frekuentId,
      orain_machine_id: null,
      last_scraped_at: scrapedAt,
      updated_at: scrapedAt,
      daily_total: item.daily || 0,
      daily_card: 0,
      daily_cash: 0,
      daily_updated_at: scrapedAt,
      monthly_total: item.monthly || 0,
      monthly_card: 0,
      monthly_cash: 0,
      monthly_updated_at: scrapedAt,
    };
  });

  const { error: upsertError } = await supabaseAdmin
    .from('machines')
    .upsert(rows as any[], { onConflict: 'id' });

  if (upsertError) {
    throw new Error(`No se pudo guardar la recaudación en bloque: ${upsertError.message}`);
  }

  const machinesTouched = rows.length;
  const machinesUpdated = machinesTouched - machinesCreated;
  const durationSeconds = round2((Date.now() - startedAt) / 1000);

  return {
    daily: {
      machinesTouched,
      machinesCreated,
      machinesUpdated,
      revenueUpdates: dailyData.length,
      totalRevenue: round2(dailyData.reduce((sum, item) => sum + item.totalRevenue, 0)),
      durationSeconds,
    },
    monthly: {
      machinesTouched,
      machinesCreated: 0,
      machinesUpdated,
      revenueUpdates: monthlyData.length,
      totalRevenue: round2(monthlyData.reduce((sum, item) => sum + item.totalRevenue, 0)),
      durationSeconds,
    },
  };
}

async function runFrekuentBoth(): Promise<{ daily: ActionSummary; monthly: ActionSummary }> {
  const credentials = requireFrekuentCredentials();
  const result = await scrapeFrekuentRevenueMultiple(credentials);

  if (!result.daily.success || !result.monthly.success) {
    throw new Error(result.daily.error || result.monthly.error || 'Scraping Frekuent falló');
  }

  return saveFrekuentRevenueBulk(result.daily.data, result.monthly.data);
}

export async function executeRevenueJob(
  action: RevenueJobAction,
  onProgress?: (event: RevenueJobProgressEvent) => Promise<void> | void,
): Promise<RevenueJobExecutionResult> {
  const startedAt = Date.now();
  const details: Record<string, ActionSummary> = {};

  const emit = async (phase: RevenueJobPhase, progress: number, message?: string) => {
    if (onProgress) {
      await onProgress({ phase, progress, message });
    }
  };

  await emit('validating', 5, 'Validando credenciales y entorno');

  await emit('frekuent', 20, 'Extrayendo recaudación diaria y mensual de Frekuent');
  const frekuent = await runFrekuentBoth();
  details.frekuent_daily = frekuent.daily;
  details.frekuent_monthly = frekuent.monthly;

  await emit('saving', 95, 'Guardando resultados');

  const machinesScraped = Math.max(
    0,
    ...Object.values(details).map(detail => detail.machinesTouched),
  );

  const totalRevenue = round2(Object.values(details)
    .reduce((sum, detail) => sum + detail.totalRevenue, 0));

  const durationSeconds = round2((Date.now() - startedAt) / 1000);

  await emit('completed', 100, 'Completado');

  return {
    action,
    machinesScraped,
    totalRevenue,
    durationSeconds,
    details,
  };
}
