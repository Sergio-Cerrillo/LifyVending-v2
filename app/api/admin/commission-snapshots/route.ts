import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase con service_role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const dynamic = 'force-dynamic';

/**
 * GET: Obtener histórico de comisiones
 * Query params:
 * - clientId: ID del cliente (opcional, si no se proporciona devuelve todos)
 * - year: Año (opcional)
 * - month: Mes (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    let query = supabaseAdmin
      .from('commission_snapshots')
      .select(`
        *,
        profiles:client_id (
          id,
          email,
          display_name,
          company_name
        )
      `)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    if (year) {
      query = query.eq('year', parseInt(year));
    }

    if (month) {
      query = query.eq('month', parseInt(month));
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[COMMISSION-HISTORY] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error fetching commission history' },
      { status: 500 }
    );
  }
}

/**
 * POST: Generar snapshot de comisión para un mes específico
 * Body:
 * - clientId: ID del cliente (opcional, si no se proporciona genera para todos)
 * - month: Mes (1-12)
 * - year: Año
 * - force: Sobrescribir si ya existe (opcional, default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, month, year, force = false } = body;

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      );
    }

    // Validar mes y año
    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Month must be between 1 and 12' },
        { status: 400 }
      );
    }

    // Obtener clientes a procesar
    let clientsToProcess = [];
    
    if (clientId) {
      const { data: client } = await supabaseAdmin
        .from('profiles')
        .select('id, email, display_name')
        .eq('id', clientId)
        .eq('role', 'client')
        .single();
      
      if (!client) {
        return NextResponse.json(
          { error: 'Client not found' },
          { status: 404 }
        );
      }
      
      clientsToProcess = [client];
    } else {
      // Procesar todos los clientes
      const { data: clients } = await supabaseAdmin
        .from('profiles')
        .select('id, email, display_name')
        .eq('role', 'client');
      
      clientsToProcess = clients || [];
    }

    console.log(`[COMMISSION-SNAPSHOT] Procesando ${clientsToProcess.length} clientes para ${month}/${year}`);

    const results = [];

    for (const client of clientsToProcess) {
      try {
        // Obtener configuración de comisión del cliente
        const { data: settings } = await supabaseAdmin
          .from('client_settings')
          .select('commission_hide_percent')
          .eq('client_id', client.id)
          .single();

        const commissionPercent = settings?.commission_hide_percent || 0;

        // Obtener máquinas asignadas al cliente
        const { data: assignments } = await supabaseAdmin
          .from('client_machine_assignments')
          .select('machine_id')
          .eq('client_id', client.id);

        const machineIds = assignments?.map(a => a.machine_id) || [];
        const machinesCount = machineIds.length;

        if (machineIds.length === 0) {
          console.log(`[COMMISSION-SNAPSHOT] Cliente ${client.email} sin máquinas asignadas`);
          results.push({
            clientId: client.id,
            status: 'skipped',
            reason: 'no_machines'
          });
          continue;
        }

        // Calcular fechas del mes
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // Obtener recaudaciones del mes para las máquinas del cliente
        const { data: revenues } = await supabaseAdmin
          .from('machine_revenue_snapshots')
          .select('*')
          .in('machine_id', machineIds)
          .eq('period', 'daily')
          .gte('scraped_at', startDate.toISOString())
          .lte('scraped_at', endDate.toISOString());

        // Calcular totales (tomar el snapshot más reciente de cada máquina por día)
        const revenueByMachineDay = new Map();
        
        revenues?.forEach(rev => {
          const key = `${rev.machine_id}_${new Date(rev.scraped_at).toDateString()}`;
          const existing = revenueByMachineDay.get(key);
          
          if (!existing || new Date(rev.scraped_at) > new Date(existing.scraped_at)) {
            revenueByMachineDay.set(key, rev);
          }
        });

        const uniqueRevenues = Array.from(revenueByMachineDay.values());

        const totalRevenue = uniqueRevenues.reduce((sum, r) => sum + (r.amount_gross || 0), 0);
        const cardRevenue = uniqueRevenues.reduce((sum, r) => sum + (r.anonymous_card || 0), 0);
        const cashRevenue = uniqueRevenues.reduce((sum, r) => sum + (r.anonymous_cash || 0), 0);

        const commissionAmount = (totalRevenue * commissionPercent) / 100;

        // Verificar si ya existe un snapshot para este mes/año
        const { data: existing } = await supabaseAdmin
          .from('commission_snapshots')
          .select('id')
          .eq('client_id', client.id)
          .eq('month', month)
          .eq('year', year)
          .single();

        if (existing && !force) {
          console.log(`[COMMISSION-SNAPSHOT] Ya existe snapshot para ${client.email} ${month}/${year}`);
          results.push({
            clientId: client.id,
            status: 'exists',
            snapshotId: existing.id
          });
          continue;
        }

        // Insertar o actualizar snapshot
        const snapshotData = {
          client_id: client.id,
          month,
          year,
          total_revenue: totalRevenue,
          commission_percent: commissionPercent,
          commission_amount: commissionAmount,
          card_revenue: cardRevenue,
          cash_revenue: cashRevenue,
          machines_count: machinesCount
        };

        if (existing && force) {
          // Actualizar existente
          const { error: updateError } = await supabaseAdmin
            .from('commission_snapshots')
            .update(snapshotData)
            .eq('id', existing.id);

          if (updateError) throw updateError;

          console.log(`[COMMISSION-SNAPSHOT] Actualizado snapshot para ${client.email}: ${commissionAmount.toFixed(2)}€`);
          results.push({
            clientId: client.id,
            status: 'updated',
            commissionAmount,
            snapshotId: existing.id
          });
        } else {
          // Insertar nuevo
          const { data: newSnapshot, error: insertError } = await supabaseAdmin
            .from('commission_snapshots')
            .insert(snapshotData)
            .select()
            .single();

          if (insertError) throw insertError;

          console.log(`[COMMISSION-SNAPSHOT] Creado snapshot para ${client.email}: ${commissionAmount.toFixed(2)}€`);
          results.push({
            clientId: client.id,
            status: 'created',
            commissionAmount,
            snapshotId: newSnapshot.id
          });
        }
      } catch (clientError: any) {
        console.error(`[COMMISSION-SNAPSHOT] Error procesando cliente ${client.email}:`, clientError);
        results.push({
          clientId: client.id,
          status: 'error',
          error: clientError.message
        });
      }
    }

    const summary = {
      total: results.length,
      created: results.filter(r => r.status === 'created').length,
      updated: results.filter(r => r.status === 'updated').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      exists: results.filter(r => r.status === 'exists').length,
      errors: results.filter(r => r.status === 'error').length
    };

    return NextResponse.json({
      success: true,
      summary,
      results
    });
  } catch (error: any) {
    console.error('[COMMISSION-SNAPSHOT] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error creating commission snapshot' },
      { status: 500 }
    );
  }
}
