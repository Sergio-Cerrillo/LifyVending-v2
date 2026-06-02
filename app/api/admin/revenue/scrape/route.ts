import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';
import { scrapeFrekuentRevenueMultiple } from '@/scraper/frekuent-revenue-scraper';
import { TelevendScraper } from '@/scraper/televend-scraper';
import { generateFrekuentId, generateTelevendId } from '@/lib/machine-id-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ScrapeAction = 'frekuent_daily' | 'frekuent_monthly' | 'televend' | 'all_queue';

type ScrapePhase =
  | 'idle'
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

interface ActionSummary {
  machinesTouched: number;
  machinesCreated: number;
  machinesUpdated: number;
  revenueUpdates: number;
  totalRevenue: number;
  durationSeconds: number;
}

let activeRevenueJob: {
  action: ScrapeAction;
  phase: ScrapePhase;
  startedAt: string;
  runId?: string;
} | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 }) };
  }

  return { user };
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

async function createScrapeRun(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('scrape_runs')
    .insert({
      triggered_by_user_id: userId,
      triggered_role: 'admin',
      status: 'running',
      started_at: nowIso(),
      error_message: null,
      machines_scraped: 0,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`No se pudo crear scrape_run: ${error?.message}`);
  }

  return data.id;
}

async function closeScrapeRun(runId: string, status: 'completed' | 'error', machinesScraped: number, errorMessage?: string) {
  await supabaseAdmin
    .from('scrape_runs')
    .update({
      status,
      finished_at: nowIso(),
      machines_scraped: machinesScraped,
      error_message: errorMessage || null,
    })
    .eq('id', runId);
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

async function runFrekuentPeriod(period: 'daily' | 'monthly'): Promise<ActionSummary> {
  const credentials = requireFrekuentCredentials();
  const result = await scrapeFrekuentRevenueMultiple(credentials);
  const selected = period === 'daily' ? result.daily : result.monthly;

  if (!selected.success) {
    throw new Error(selected.error || `Scraping Frekuent ${period} falló`);
  }

  const items: RevenueItem[] = selected.data.map((item) => ({
    machineName: item.machineName,
    location: item.location || 'Sin ubicación',
    source: 'frekuent',
    period,
    totalRevenue: item.totalRevenue,
    card: 0,
    cash: 0,
  }));

  return applyRevenueItems(items);
}

async function runFrekuentBothQueue(): Promise<{ daily: ActionSummary; monthly: ActionSummary }> {
  const credentials = requireFrekuentCredentials();
  const result = await scrapeFrekuentRevenueMultiple(credentials);

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

async function runTelevend(): Promise<ActionSummary> {
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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  return NextResponse.json({
    isRunning: activeRevenueJob !== null,
    activeJob: activeRevenueJob,
    now: nowIso(),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  if (activeRevenueJob) {
    return NextResponse.json(
      {
        error: 'Ya hay un scraping de recaudaciones en ejecución',
        activeJob: activeRevenueJob,
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as ScrapeAction;

  if (!action || !['frekuent_daily', 'frekuent_monthly', 'televend', 'all_queue'].includes(action)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  }

  let runId: string | undefined;
  const startedAt = Date.now();

  try {
    activeRevenueJob = {
      action,
      phase: 'validating',
      startedAt: nowIso(),
    };

    runId = await createScrapeRun(auth.user.id);
    activeRevenueJob.runId = runId;

    const details: Record<string, ActionSummary> = {};

    if (action === 'frekuent_daily') {
      activeRevenueJob.phase = 'frekuent_daily';
      details.frekuent_daily = await runFrekuentPeriod('daily');
    } else if (action === 'frekuent_monthly') {
      activeRevenueJob.phase = 'frekuent_monthly';
      details.frekuent_monthly = await runFrekuentPeriod('monthly');
    } else if (action === 'televend') {
      activeRevenueJob.phase = 'televend';
      details.televend = await runTelevend();
    } else {
      activeRevenueJob.phase = 'frekuent_daily';
      const frekuent = await runFrekuentBothQueue();
      details.frekuent_daily = frekuent.daily;
      details.frekuent_monthly = frekuent.monthly;

      activeRevenueJob.phase = 'televend';
      details.televend = await runTelevend();
    }

    activeRevenueJob.phase = 'saving';

    const machinesScraped = Object.values(details)
      .reduce((sum, d) => sum + d.machinesTouched, 0);

    const totalRevenue = round2(Object.values(details)
      .reduce((sum, d) => sum + d.totalRevenue, 0));

    if (runId) {
      await closeScrapeRun(runId, 'completed', machinesScraped);
    }

    const durationSeconds = round2((Date.now() - startedAt) / 1000);

    activeRevenueJob.phase = 'completed';

    return NextResponse.json({
      success: true,
      action,
      durationSeconds,
      machinesScraped,
      totalRevenue,
      details,
      scrapeRunId: runId,
    });
  } catch (error: any) {
    if (runId) {
      await closeScrapeRun(runId, 'error', 0, error?.message || 'Error desconocido');
    }

    if (activeRevenueJob) {
      activeRevenueJob.phase = 'error';
    }

    return NextResponse.json(
      {
        error: error?.message || 'Error ejecutando scraping',
        action,
      },
      { status: 500 }
    );
  } finally {
    activeRevenueJob = null;
  }
}
