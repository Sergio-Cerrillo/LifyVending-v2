import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';
import {
  executeRevenueJob,
  type RevenueJobAction,
} from '@/lib/services/revenue-scrape-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type JobStatus = 'queued' | 'running' | 'completed' | 'error' | 'canceled';

const VALID_ACTIONS: RevenueJobAction[] = ['frekuent'];

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

function normalizeByAction(rows: any[]) {
  const byAction: Record<string, any> = {};

  for (const row of rows) {
    if (!byAction[row.action]) {
      byAction[row.action] = row;
    }
  }

  return byAction;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const { data, error } = await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json(
      { error: `No se pudo leer cola de jobs: ${error.message}` },
      { status: 500 }
    );
  }

  const rows = data || [];
  const activeJob = rows.find((row: any) => row.status === 'running' || row.status === 'queued') || null;

  return NextResponse.json({
    activeJob,
    byAction: normalizeByAction(rows),
    jobs: rows,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const action = body.action as RevenueJobAction;

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  }

  const { data: activeRows } = await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .select('id, action, status, requested_at')
    .in('status', ['queued', 'running'] as JobStatus[])
    .order('requested_at', { ascending: true });

  const active = activeRows || [];
  const hasSameActionActive = active.some((row: any) => row.action === action);

  if (hasSameActionActive) {
    return NextResponse.json(
      {
        error: 'Ya existe un job activo para esta acción',
        active,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .insert({
      action,
      status: 'running',
      phase: 'validating',
      progress: 1,
      requested_by_user_id: auth.user.id,
      requested_at: now,
      started_at: now,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: `No se pudo crear el job: ${insertError?.message}` },
      { status: 500 }
    );
  }

  try {
    const result = await executeRevenueJob(action, async ({ phase, progress, message }) => {
      await supabaseAdmin
        .from('revenue_scrape_jobs' as any)
        .update({ phase, progress, error_message: message || null })
        .eq('id', inserted.id);
    });

    const finishedAt = new Date().toISOString();
    await supabaseAdmin
      .from('revenue_scrape_jobs' as any)
      .update({
        status: 'completed',
        phase: 'completed',
        progress: 100,
        finished_at: finishedAt,
        result_json: result,
        error_message: null,
      })
      .eq('id', inserted.id);

    return NextResponse.json({
      success: true,
      message: 'Scraping completado correctamente',
      job: { ...inserted, status: 'completed', result_json: result },
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error ejecutando Frekuent';

    await supabaseAdmin
      .from('revenue_scrape_jobs' as any)
      .update({
        status: 'error',
        phase: 'error',
        progress: 100,
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq('id', inserted.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
