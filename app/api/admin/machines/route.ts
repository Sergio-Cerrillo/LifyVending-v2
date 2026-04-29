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
