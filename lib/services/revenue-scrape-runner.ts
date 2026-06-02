import { supabaseAdmin } from '@/lib/supabase-helpers';
import { scrapeFrekuentRevenueMultiple } from '@/scraper/frekuent-revenue-scraper';
import { TelevendScraper } from '@/scraper/televend-scraper';
import { generateFrekuentId, generateTelevendId } from '@/lib/machine-id-utils';

export type RevenueJobAction = 'frekuent_daily' | 'frekuent_monthly' | 'televend' | 'all_queue';

export type RevenueJobPhase =
  | 'validating'
  | 'frekuent_daily'
  | 'frekuent_monthly'
  | 'televend'
  | 'saving'
  | 'completed'
  | 'error';

interface RevenueItem {
  machineName: string;
  location: string;
  source: 'frekuent' | 'televend';
  period: 'daily' | 'monthly';
  totalRevenue: number;
  card?: number;
  cash?: number;
}

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

function isTransientPuppeteerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();

  return (
    normalized.includes('detached frame')
    || normalized.includes('execution context was destroyed')
    || normalized.includes('cannot find context with specified id')
  );
}

function requireFrekuentCredentials() {
  const username = process.env.FREKUENT_USERNAME || process.env.ORAIN_USERNAME;
  const password = process.env.FREKUENT_PASSWORD || process.env.ORAIN_PASSWORD;

  if (!username || !password) {
    throw new Error('Faltan credenciales de Frekuent/Orain');
  }

  return { username, password };
}

function requireTelevendCredentials() {
  const username = process.env.TELEVEND_USERNAME;
  const password = process.env.TELEVEND_PASSWORD;

  if (!username || !password) {
    throw new Error('Faltan credenciales de Televend');
  }

  return { username, password };
}

async function resolveMachineId(item: RevenueItem): Promise<{ machineId: string; created: boolean }> {
  const frekuentMachineId = item.source === 'frekuent' ? generateFrekuentId(item.machineName) : null;
  const televendMachineId = item.source === 'televend' ? generateTelevendId(item.machineName) : null;

  let existingMachineId: string | null = null;

  if (frekuentMachineId) {
    const { data: byFrekuent } = await supabaseAdmin
      .from('machines')
      .select('id')
      .eq('frekuent_machine_id', frekuentMachineId)
      .maybeSingle();

    if (byFrekuent?.id) {
      existingMachineId = byFrekuent.id;
    } else {
      const { data: byOrain } = await supabaseAdmin
        .from('machines')
        .select('id')
        .eq('orain_machine_id', frekuentMachineId)
        .maybeSingle();

      if (byOrain?.id) {
        existingMachineId = byOrain.id;
        await supabaseAdmin
          .from('machines')
          .update({
            frekuent_machine_id: frekuentMachineId,
            orain_machine_id: null,
          })
          .eq('id', byOrain.id);
      }
    }
  }

  if (!existingMachineId && televendMachineId) {
    const { data: byTelevend } = await supabaseAdmin
      .from('machines')
      .select('id')
      .eq('televend_machine_id', televendMachineId)
      .maybeSingle();

    if (byTelevend?.id) {
      existingMachineId = byTelevend.id;
    }
  }

  if (existingMachineId) {
    return { machineId: existingMachineId, created: false };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('machines')
    .insert({
      name: item.machineName,
      location: item.location || 'Sin ubicación',
      status: 'active',
      frekuent_machine_id: frekuentMachineId,
      televend_machine_id: televendMachineId,
      last_scraped_at: nowIso(),
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    throw new Error(`No se pudo crear máquina ${item.machineName}: ${insertError?.message}`);
  }

  return { machineId: inserted.id, created: true };
}

async function applyRevenueItems(items: RevenueItem[]): Promise<ActionSummary> {
  const startedAt = Date.now();
  const touched = new Set<string>();
  let machinesCreated = 0;
  let machinesUpdated = 0;
  let revenueUpdates = 0;

  for (const item of items) {
    const { machineId, created } = await resolveMachineId(item);

    if (created) {
      machinesCreated += 1;
    } else if (!touched.has(machineId)) {
      machinesUpdated += 1;
    }

    touched.add(machineId);

    const updateData: Record<string, any> = {
      last_scraped_at: nowIso(),
    };

    if (item.period === 'daily') {
      updateData.daily_total = item.totalRevenue;
      updateData.daily_card = item.card || 0;
      updateData.daily_cash = item.cash || 0;
      updateData.daily_updated_at = nowIso();
    } else {
      updateData.monthly_total = item.totalRevenue;
      updateData.monthly_card = item.card || 0;
      updateData.monthly_cash = item.cash || 0;
      updateData.monthly_updated_at = nowIso();
    }

    const { error: updateError } = await supabaseAdmin
      .from('machines')
      .update(updateData)
      .eq('id', machineId);

    if (updateError) {
      throw new Error(`No se pudo actualizar recaudación de ${item.machineName}: ${updateError.message}`);
    }

    revenueUpdates += 1;
  }

  const totalRevenue = round2(items.reduce((sum, i) => sum + i.totalRevenue, 0));

  return {
    machinesTouched: touched.size,
    machinesCreated,
    machinesUpdated,
    revenueUpdates,
    totalRevenue,
    durationSeconds: round2((Date.now() - startedAt) / 1000),
  };
}

async function runFrekuentBoth(): Promise<{ daily: ActionSummary; monthly: ActionSummary }> {
  const credentials = requireFrekuentCredentials();
  let result;

  try {
    result = await scrapeFrekuentRevenueMultiple(credentials);
  } catch (error) {
    if (!isTransientPuppeteerError(error)) {
      throw error;
    }

    console.warn('[REVENUE RUNNER] Error transitorio de Puppeteer detectado en Frekuent. Reintentando una vez...');
    result = await scrapeFrekuentRevenueMultiple(credentials);
  }

  if (!result.daily.success || !result.monthly.success) {
    throw new Error(result.daily.error || result.monthly.error || 'Scraping Frekuent falló');
  }

  const dailyItems: RevenueItem[] = result.daily.data.map((item) => ({
    machineName: item.machineName,
    location: item.location || 'Sin ubicación',
    source: 'frekuent',
    period: 'daily',
    totalRevenue: item.totalRevenue,
    card: 0,
    cash: 0,
  }));

  const monthlyItems: RevenueItem[] = result.monthly.data.map((item) => ({
    machineName: item.machineName,
    location: item.location || 'Sin ubicación',
    source: 'frekuent',
    period: 'monthly',
    totalRevenue: item.totalRevenue,
    card: 0,
    cash: 0,
  }));

  const daily = await applyRevenueItems(dailyItems);
  const monthly = await applyRevenueItems(monthlyItems);

  return { daily, monthly };
}

async function runTelevendBoth(): Promise<ActionSummary> {
  const credentials = requireTelevendCredentials();
  const scraper = new TelevendScraper({
    username: credentials.username,
    password: credentials.password,
    headless: true,
  });

  try {
    const results = await scraper.scrapeAllMachinesRevenue();

    const items: RevenueItem[] = results.flatMap((item) => ([
      {
        machineName: item.machineName,
        location: item.location || 'Sin ubicación',
        source: 'televend' as const,
        period: 'daily' as const,
        totalRevenue: item.daily,
        card: 0,
        cash: 0,
      },
      {
        machineName: item.machineName,
        location: item.location || 'Sin ubicación',
        source: 'televend' as const,
        period: 'monthly' as const,
        totalRevenue: item.monthly,
        card: 0,
        cash: 0,
      },
    ]));

    return applyRevenueItems(items);
  } finally {
    await scraper.close().catch(() => {});
  }
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

  if (action === 'frekuent_daily') {
    await emit('frekuent_daily', 20, 'Ejecutando Frekuent diario');
    const frekuent = await runFrekuentBoth();
    details.frekuent_daily = frekuent.daily;
  } else if (action === 'frekuent_monthly') {
    await emit('frekuent_monthly', 20, 'Ejecutando Frekuent mensual');
    const frekuent = await runFrekuentBoth();
    details.frekuent_monthly = frekuent.monthly;
  } else if (action === 'televend') {
    await emit('televend', 20, 'Ejecutando Televend');
    details.televend = await runTelevendBoth();
  } else {
    await emit('frekuent_daily', 20, 'Cola: Frekuent diario');
    const frekuent = await runFrekuentBoth();
    details.frekuent_daily = frekuent.daily;

    await emit('frekuent_monthly', 45, 'Cola: Frekuent mensual');
    details.frekuent_monthly = frekuent.monthly;

    await emit('televend', 65, 'Cola: Televend');
    details.televend = await runTelevendBoth();
  }

  await emit('saving', 95, 'Guardando resultados');

  const machinesScraped = Object.values(details)
    .reduce((sum, detail) => sum + detail.machinesTouched, 0);

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
