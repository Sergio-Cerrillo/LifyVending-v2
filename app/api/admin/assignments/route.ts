/**
 * API: Asignar máquinas a un cliente
 * POST /api/admin/assignments
 */

import { NextRequest, NextResponse } from 'next/server';
import { assignMachinesToClient, supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export async function POST(request: NextRequest) {
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

    // Parsear body
    const body = await request.json();
    const { clientId, machineIds } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId es requerido' },
        { status: 400 }
      );
    }

    if (!Array.isArray(machineIds)) {
      return NextResponse.json(
        { error: 'machineIds debe ser un array' },
        { status: 400 }
      );
    }

    // Asignar máquinas
    await assignMachinesToClient(clientId, machineIds);

    return NextResponse.json({
      success: true,
      message: `${machineIds.length} máquinas asignadas correctamente`
    });

  } catch (error: any) {
    console.error('Error asignando máquinas:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
