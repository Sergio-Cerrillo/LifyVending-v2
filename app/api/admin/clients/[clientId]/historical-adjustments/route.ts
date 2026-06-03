import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

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

function normalizePeriodPayload(body: any) {
  const machineId = String(body?.machineId || '').trim();
  const year = Number(body?.year);
  const month = Number(body?.month);
  const amountTotal = Number(body?.amountTotal);

  if (!machineId) {
    throw new Error('Máquina requerida');
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error('Año inválido');
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Mes inválido');
  }

  if (!Number.isFinite(amountTotal) || amountTotal < 0) {
    throw new Error('Importe inválido');
  }

  return {
    machineId,
    year,
    month,
    amountTotal: Math.round(amountTotal * 100) / 100,
    notes: body?.notes ? String(body.notes).trim() : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const { clientId } = await params;

  const { data: client, error: clientError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, display_name, company_name')
    .eq('id', clientId)
    .eq('role', 'client')
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  }

  const { data: settings } = await supabaseAdmin
    .from('client_settings')
    .select('commission_hide_percent, commission_payment_percent')
    .eq('client_id', clientId)
    .maybeSingle();

  const { data: rows, error: rowsError } = await supabaseAdmin
    .from('client_revenue_history_adjustments' as any)
    .select('*, machines(id, name, location)')
    .eq('client_id', clientId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .order('created_at', { ascending: false });

  if (rowsError) {
    return NextResponse.json(
      { error: `No se pudo cargar histórico: ${rowsError.message}` },
      { status: 500 }
    );
  }

  const { data: assignments, error: assignmentsError } = await supabaseAdmin
    .from('client_machine_assignments')
    .select('machine_id, machines(id, name, location)')
    .eq('client_id', clientId);

  if (assignmentsError) {
    return NextResponse.json(
      { error: `No se pudieron cargar máquinas del cliente: ${assignmentsError.message}` },
      { status: 500 }
    );
  }

  const machineOptions = (assignments || [])
    .map((row: any) => row.machines)
    .filter(Boolean);

  return NextResponse.json({
    client: {
      ...client,
      commission_hide_percent: settings?.commission_hide_percent ?? 0,
      commission_payment_percent: settings?.commission_payment_percent ?? 0,
    },
    entries: rows || [],
    machineOptions,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const { clientId } = await params;

  let payload: ReturnType<typeof normalizePeriodPayload>;
  try {
    const body = await request.json();
    payload = normalizePeriodPayload(body);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Payload inválido' }, { status: 400 });
  }

  const { data: assignment } = await supabaseAdmin
    .from('client_machine_assignments')
    .select('machine_id')
    .eq('client_id', clientId)
    .eq('machine_id', payload.machineId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: 'La máquina no está asignada al cliente' }, { status: 400 });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('client_revenue_history_adjustments' as any)
    .insert({
      client_id: clientId,
      machine_id: payload.machineId,
      year: payload.year,
      month: payload.month,
      amount_total: payload.amountTotal,
      notes: payload.notes,
      created_by_user_id: auth.user.id,
      updated_by_user_id: auth.user.id,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: `No se pudo crear registro: ${insertError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, entry: inserted });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const { clientId } = await params;

  let payload: ReturnType<typeof normalizePeriodPayload> & { id: string };
  try {
    const body = await request.json();
    if (!body?.id) throw new Error('ID requerido');

    payload = {
      id: String(body.id),
      ...normalizePeriodPayload(body),
    };
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Payload inválido' }, { status: 400 });
  }

  const { data: assignment } = await supabaseAdmin
    .from('client_machine_assignments')
    .select('machine_id')
    .eq('client_id', clientId)
    .eq('machine_id', payload.machineId)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: 'La máquina no está asignada al cliente' }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('client_revenue_history_adjustments' as any)
    .update({
      machine_id: payload.machineId,
      year: payload.year,
      month: payload.month,
      amount_total: payload.amountTotal,
      notes: payload.notes,
      updated_by_user_id: auth.user.id,
    })
    .eq('id', payload.id)
    .eq('client_id', clientId)
    .select('*')
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: `No se pudo actualizar registro: ${updateError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, entry: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const auth = await requireAdmin(request);
  if ('error' in auth) return auth.error;

  const { clientId } = await params;

  let entryId: string;
  try {
    const body = await request.json();
    if (!body?.id) throw new Error('ID requerido');
    entryId = String(body.id);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Payload inválido' }, { status: 400 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('client_revenue_history_adjustments' as any)
    .delete()
    .eq('id', entryId)
    .eq('client_id', clientId);

  if (deleteError) {
    return NextResponse.json(
      { error: `No se pudo eliminar registro: ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
