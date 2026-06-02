import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';
import type { RevenueJobAction } from '@/lib/services/revenue-scrape-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JobStatus = 'queued' | 'running' | 'completed' | 'error' | 'canceled';

const VALID_ACTIONS: RevenueJobAction[] = ['frekuent_daily', 'frekuent_monthly', 'televend', 'all_queue'];

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
  const hasAllQueueActive = active.some((row: any) => row.action === 'all_queue');
  const hasSameActionActive = active.some((row: any) => row.action === action);

  if (action === 'all_queue' && active.length > 0) {
    return NextResponse.json(
      {
        error: 'No se puede encolar all_queue mientras hay jobs activos',
        active,
      },
      { status: 409 }
    );
  }

  if (action !== 'all_queue' && (hasAllQueueActive || hasSameActionActive)) {
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
      status: 'queued',
      phase: 'queued',
      progress: 0,
      requested_by_user_id: auth.user.id,
      requested_at: now,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: `No se pudo crear el job: ${insertError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Job encolado correctamente',
    job: inserted,
  });
}
