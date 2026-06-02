import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-helpers';
import {
  executeRevenueJob,
  type RevenueJobAction,
  type RevenueJobPhase,
} from '@/lib/services/revenue-scrape-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAuthOk(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) return false;
  return authHeader === expected;
}

async function claimNextQueuedJob() {
  const { data: queuedJobs, error: queuedError } = await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .select('*')
    .eq('status', 'queued')
    .order('requested_at', { ascending: true })
    .limit(1);

  if (queuedError) {
    throw new Error(`Error leyendo cola: ${queuedError.message}`);
  }

  const next = queuedJobs?.[0];
  if (!next) return null;

  const lockToken = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .update({
      status: 'running',
      phase: 'validating',
      progress: 1,
      started_at: now,
      lock_token: lockToken,
      locked_at: now,
      attempts: (next.attempts || 0) + 1,
    })
    .eq('id', next.id)
    .eq('status', 'queued')
    .select('*')
    .single();

  if (claimError || !claimed) {
    return null;
  }

  return claimed;
}

async function updateJobProgress(jobId: string, lockToken: string, phase: RevenueJobPhase, progress: number, message?: string) {
  await supabaseAdmin
    .from('revenue_scrape_jobs' as any)
    .update({
      phase,
      progress,
      error_message: message || null,
    })
    .eq('id', jobId)
    .eq('lock_token', lockToken);
}

export async function GET(request: NextRequest) {
  if (!getAuthOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const claimed = await claimNextQueuedJob();
  if (!claimed) {
    return NextResponse.json({ success: true, processed: false, message: 'No queued jobs' });
  }

  const jobId = claimed.id as string;
  const lockToken = claimed.lock_token as string;
  const action = claimed.action as RevenueJobAction;
  let scrapeRunId: string | null = null;

  try {
    const { data: scrapeRun } = await supabaseAdmin
      .from('scrape_runs')
      .insert({
        triggered_by_user_id: claimed.requested_by_user_id || null,
        triggered_role: 'admin',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    scrapeRunId = scrapeRun?.id || null;

    const result = await executeRevenueJob(action, async ({ phase, progress, message }) => {
      await updateJobProgress(jobId, lockToken, phase, progress, message);
    });

    await supabaseAdmin
      .from('revenue_scrape_jobs' as any)
      .update({
        status: 'completed',
        phase: 'completed',
        progress: 100,
        finished_at: new Date().toISOString(),
        result_json: {
          ...result,
          scrapeRunId,
        },
        error_message: null,
      })
      .eq('id', jobId)
      .eq('lock_token', lockToken);

    if (scrapeRunId) {
      await supabaseAdmin
        .from('scrape_runs')
        .update({
          status: 'completed',
          finished_at: new Date().toISOString(),
          machines_scraped: result.machinesScraped,
        })
        .eq('id', scrapeRunId);
    }

    return NextResponse.json({
      success: true,
      processed: true,
      jobId,
      action,
      result,
    });
  } catch (error: any) {
    const message = error?.message || 'Error desconocido procesando job';

    await supabaseAdmin
      .from('revenue_scrape_jobs' as any)
      .update({
        status: 'error',
        phase: 'error',
        progress: 100,
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq('id', jobId)
      .eq('lock_token', lockToken);

    if (scrapeRunId) {
      await supabaseAdmin
        .from('scrape_runs')
        .update({
          status: 'error',
          finished_at: new Date().toISOString(),
          error_message: message,
        })
        .eq('id', scrapeRunId);
    }

    return NextResponse.json(
      {
        success: false,
        processed: true,
        jobId,
        action,
        error: message,
      },
      { status: 500 }
    );
  }
}
