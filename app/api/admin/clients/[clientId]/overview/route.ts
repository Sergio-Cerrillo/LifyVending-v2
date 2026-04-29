/**
 * API: Overview de cliente para admin (bruto vs neto)
 * GET /api/admin/clients/[clientId]/overview
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const resolvedParams = await params;
    console.log('[OVERVIEW-API] Iniciando para cliente:', resolvedParams.clientId);

    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[OVERVIEW-API] No hay header de autorización');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[OVERVIEW-API] Error de autenticación:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin (usar supabaseAdmin para bypass RLS)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      console.error('[OVERVIEW-API] Usuario no es admin');
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    console.log('[OVERVIEW-API] Usuario admin verificado');

    // Obtener información del cliente
    const { data: clientProfile, error: clientError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', resolvedParams.clientId)
      .single();

    if (clientError) {
      console.error('[OVERVIEW-API] Error obteniendo perfil cliente:', clientError);
      return NextResponse.json({ error: 'Error obteniendo cliente: ' + clientError.message }, { status: 500 });
    }

    if (!clientProfile) {
      console.error('[OVERVIEW-API] Cliente no encontrado');
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    console.log('[OVERVIEW-API] Cliente encontrado:', clientProfile.email);

    // Obtener settings del cliente (query separado)
    const { data: clientSettings, error: settingsError } = await supabaseAdmin
      .from('client_settings')
      .select('*')
      .eq('client_id', resolvedParams.clientId)
      .single();

    // Si no tiene settings, crear registro con valores por defecto
    let settings = clientSettings;
    
    if (!settings) {
      console.log('[OVERVIEW-API] ⚠️ Cliente sin settings, creando registro por defecto...');
      
      const { data: newSettings, error: createSettingsError } = await supabaseAdmin
        .from('client_settings')
        .insert({
          client_id: resolvedParams.clientId,
          commission_hide_percent: 0,
          commission_payment_percent: 0
        })
        .select()
        .single();
      
      if (createSettingsError) {
        console.error('[OVERVIEW-API] Error creando settings por defecto:', createSettingsError);
        // Usar valores por defecto si falla
        settings = {
          commission_hide_percent: 0,
          commission_payment_percent: 0
        } as any;
      } else {
        console.log('[OVERVIEW-API] ✅ Settings creados con valores por defecto');
        settings = newSettings;
      }
    } else {
      console.log('[OVERVIEW-API] Settings encontrados:', settings);
    }

    // Obtener máquinas asignadas
    const { data: assignments } = await supabaseAdmin
      .from('client_machine_assignments')
      .select('machine_id, machines(*)')
      .eq('client_id', resolvedParams.clientId);

    const machines = (assignments || []).map(a => (a as any).machines);
    console.log('[OVERVIEW-API] Máquinas asignadas:', machines.length);

    // Obtener overview usando la función SQL
    const { data: overviewData, error: overviewError } = await supabaseAdmin
      .rpc('get_admin_client_overview', {
        p_client_id: resolvedParams.clientId
      });

    if (overviewError) {
      console.error('[OVERVIEW-API] Error en RPC get_admin_client_overview:', overviewError);
      // No fallar si no hay datos de revenue, solo retornar vacío
    }

    console.log('[OVERVIEW-API] Overview data:', overviewData);

    // Formatear respuesta
    console.log('[OVERVIEW-API] Settings raw del cliente:', settings);
    console.log('[OVERVIEW-API] commission_hide_percent:', settings?.commission_hide_percent);
    console.log('[OVERVIEW-API] commission_payment_percent:', settings?.commission_payment_percent);
    
    const response = {
      client: {
        id: clientProfile.id,
        email: clientProfile.email,
        displayName: clientProfile.display_name,
        companyName: clientProfile.company_name,
        commissionHidePercent: settings?.commission_hide_percent ?? 0,
        commissionPaymentPercent: settings?.commission_payment_percent ?? 0
      },
      machines: machines,
      revenue: {
        daily: overviewData?.find((d: any) => d.period === 'daily') || null,
        weekly: overviewData?.find((d: any) => d.period === 'weekly') || null,
        monthly: overviewData?.find((d: any) => d.period === 'monthly') || null
      }
    };

    console.log('[OVERVIEW-API] Respuesta final - commissionHidePercent:', response.client.commissionHidePercent);
    console.log('[OVERVIEW-API] Respuesta final - commissionPaymentPercent:', response.client.commissionPaymentPercent);
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[OVERVIEW-API] Error inesperado:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
