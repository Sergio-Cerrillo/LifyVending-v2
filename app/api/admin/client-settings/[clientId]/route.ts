/**
 * API: Actualizar configuración del cliente (porcentajes)
 * PUT /api/admin/client-settings/[clientId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const resolvedParams = await params;
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

    // Parsear body
    const body = await request.json();
    const { commissionHidePercent, commissionPaymentPercent } = body;

    console.log('[CLIENT-SETTINGS] Recibido body:', { 
      commissionHidePercent, 
      commissionPaymentPercent,
      clientId: resolvedParams.clientId 
    });

    // Validar al menos uno de los campos
    if (commissionHidePercent === undefined && commissionPaymentPercent === undefined) {
      console.error('[CLIENT-SETTINGS] No se proporcionaron porcentajes');
      return NextResponse.json(
        { error: 'Debe proporcionar al menos un porcentaje para actualizar' },
        { status: 400 }
      );
    }

    // Validar rangos
    if (commissionHidePercent !== undefined && (commissionHidePercent < 0 || commissionHidePercent > 100)) {
      console.error('[CLIENT-SETTINGS] Porcentaje oculto fuera de rango:', commissionHidePercent);
      return NextResponse.json(
        { error: 'El porcentaje oculto debe estar entre 0 y 100' },
        { status: 400 }
      );
    }

    if (commissionPaymentPercent !== undefined && (commissionPaymentPercent < 0 || commissionPaymentPercent > 100)) {
      console.error('[CLIENT-SETTINGS] Porcentaje de comisión fuera de rango:', commissionPaymentPercent);
      return NextResponse.json(
        { error: 'El porcentaje de comisión debe estar entre 0 y 100' },
        { status: 400 }
      );
    }

    // Preparar datos para UPSERT - SIEMPRE incluir ambos campos para evitar valores NULL
    const upsertData = {
      client_id: resolvedParams.clientId,
      commission_hide_percent: commissionHidePercent !== undefined ? commissionHidePercent : 0,
      commission_payment_percent: commissionPaymentPercent !== undefined ? commissionPaymentPercent : 0
    };

    console.log('[CLIENT-SETTINGS] Ejecutando UPSERT con:', upsertData);

    // Usar UPSERT para crear o actualizar configuración
    // Si el registro no existe, lo crea; si existe, lo actualiza
    const { data: upsertResult, error: upsertError } = await supabaseAdmin
      .from('client_settings')
      .upsert(upsertData, {
        onConflict: 'client_id'
      })
      .select();

    if (upsertError) {
      console.error('[CLIENT-SETTINGS] Error en upsert:', upsertError);
      throw new Error(`Error actualizando configuración: ${upsertError.message}`);
    }

    console.log('[CLIENT-SETTINGS] ✅ Configuración guardada correctamente:', upsertResult);

    return NextResponse.json({
      success: true,
      message: 'Porcentaje de comisión actualizado correctamente'
    });

  } catch (error: any) {
    console.error('Error actualizando comisión:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
