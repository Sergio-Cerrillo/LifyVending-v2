/**
 * API: Listar todas las máquinas
 * GET /api/admin/machines
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

    // Obtener todas las máquinas
    const { data: machines, error } = await supabaseAdmin
      .from('machines')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Error obteniendo máquinas: ${error.message}`);
    }

    // Añadir campo source a cada máquina
    const machinesWithSource = (machines || []).map(machine => ({
      ...machine,
      source: machine.orain_machine_id ? 'orain' : 'televend'
    }));

    return NextResponse.json({
      machines: machinesWithSource
    });

  } catch (error: any) {
    console.error('Error obteniendo máquinas:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * API: Borrar todas las máquinas
 * DELETE /api/admin/machines
 */
export async function DELETE(request: NextRequest) {
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

    // Verificar que sea admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    // Parsear body para verificar si es deleteAll
    const body = await request.json();
    if (!body.deleteAll) {
      return NextResponse.json({ error: 'Parámetro deleteAll requerido' }, { status: 400 });
    }

    console.log('[DELETE MACHINES] Iniciando borrado de todas las máquinas...');

    // Eliminar todas las máquinas (CASCADE eliminará automáticamente las referencias)
    const { error: deleteError, count } = await supabaseAdmin
      .from('machines')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Condición para eliminar todos

    if (deleteError) {
      console.error('[DELETE MACHINES] Error:', deleteError);
      throw new Error(`Error eliminando máquinas: ${deleteError.message}`);
    }

    console.log(`[DELETE MACHINES] ✅ ${count || 0} máquinas eliminadas`);

    return NextResponse.json({
      success: true,
      message: `${count || 0} máquinas eliminadas correctamente`,
      count: count || 0
    });

  } catch (error: any) {
    console.error('[DELETE MACHINES] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
