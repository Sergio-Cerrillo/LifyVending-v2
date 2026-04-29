/**
 * API: Crear nuevo cliente
 * POST /api/admin/users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createNewClient, supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Obtener usuario actual
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verificar que sea admin (usar supabaseAdmin para bypass RLS)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    // Parsear body
    const body = await request.json();
    const { email, password, displayName, companyName, commissionHidePercent, commissionPaymentPercent } = body;

    console.log('[CREATE-CLIENT] Datos recibidos RAW:', body);
    console.log('[CREATE-CLIENT] Datos recibidos:', { 
      email, 
      displayName, 
      companyName, 
      commissionHidePercent: commissionHidePercent,
      commissionHidePercent_type: typeof commissionHidePercent,
      commissionPaymentPercent: commissionPaymentPercent,
      commissionPaymentPercent_type: typeof commissionPaymentPercent
    });

    // Validaciones
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y password son requeridos' },
        { status: 400 }
      );
    }

    if (commissionHidePercent !== undefined) {
      if (commissionHidePercent < 0 || commissionHidePercent > 100) {
        return NextResponse.json(
          { error: 'El porcentaje oculto debe estar entre 0 y 100' },
          { status: 400 }
        );
      }
    }

    if (commissionPaymentPercent !== undefined) {
      if (commissionPaymentPercent < 0 || commissionPaymentPercent > 100) {
        return NextResponse.json(
          { error: 'El porcentaje de comisión debe estar entre 0 y 100' },
          { status: 400 }
        );
      }
    }

    // Crear cliente
    const newUser = await createNewClient({
      email,
      password,
      displayName,
      companyName,
      commissionHidePercent,
      commissionPaymentPercent
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email
      }
    });

  } catch (error: any) {
    console.error('Error creando cliente:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
