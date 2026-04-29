/**
 * API: Listar todos los clientes (admin)
 * GET /api/admin/clients
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin (usar supabaseAdmin para bypass RLS)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    // Obtener todos los clientes
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .order('created_at', { ascending: false });

    if (clientsError) {
      throw new Error(`Error obteniendo clientes: ${clientsError.message}`);
    }

    console.log('[GET-CLIENTS] Total de clientes encontrados:', clients?.length || 0);

    // Obtener conteo de máquinas y settings por cliente
    const clientsWithCount = await Promise.all(
      (clients || []).map(async (client) => {
        // Obtener settings del cliente (query separado con supabaseAdmin)
        const { data: settingsData } = await supabaseAdmin
          .from('client_settings')
          .select('*')
          .eq('client_id', client.id)
          .single();

        // Obtener conteo de máquinas
        const { count } = await supabaseAdmin
          .from('client_machine_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id);

        console.log('[GET-CLIENTS] Cliente:', client.email);
        console.log('[GET-CLIENTS]   - settings raw:', settingsData);
        console.log('[GET-CLIENTS]   - commission_hide_percent:', settingsData?.commission_hide_percent);
        console.log('[GET-CLIENTS]   - commission_payment_percent:', settingsData?.commission_payment_percent);
        
        const commissionHidePercent = settingsData?.commission_hide_percent ?? 0;
        const commissionPaymentPercent = settingsData?.commission_payment_percent ?? 0;
        
        console.log('[GET-CLIENTS]   - FINAL commissionHidePercent:', commissionHidePercent);
        console.log('[GET-CLIENTS]   - FINAL commissionPaymentPercent:', commissionPaymentPercent);

        return {
          ...client,
          machineCount: count || 0,
          commissionHidePercent,
          commissionPaymentPercent
        };
      })
    );

    return NextResponse.json({
      clients: clientsWithCount
    });

  } catch (error: any) {
    console.error('Error obteniendo clientes:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
