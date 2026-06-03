import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-helpers';
import { executeRevenueJob } from '@/lib/services/revenue-scrape-runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAuthOk(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET) return false;
  return authHeader === expected;
}

export async function GET(request: NextRequest) {
  if (!getAuthOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let scrapeRunId: string | null = null;

  try {
    const { data: scrapeRun } = await supabaseAdmin
      .from('scrape_runs')
      .insert({
        triggered_by_user_id: null,
        triggered_role: 'cron',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    scrapeRunId = scrapeRun?.id || null;

    const result = await executeRevenueJob('televend');

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
      action: 'televend',
      scrapeRunId,
      result,
    });
  } catch (error: any) {
    const message = error?.message || 'Error ejecutando cron de Televend';

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
        action: 'televend',
        scrapeRunId,
        error: message,
      },
      { status: 500 }
    );
  }
}
