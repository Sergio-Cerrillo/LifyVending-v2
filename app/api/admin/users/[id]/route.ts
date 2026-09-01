/**
 * API: Eliminar usuario
 * DELETE /api/admin/users/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

async function deleteWhere(table: string, column: string, value: string) {
  const { error } = await supabaseAdmin
    .from(table as any)
    .delete()
    .eq(column, value);

  if (error) {
    throw new Error(`Error limpiando ${table}: ${error.message}`);
  }
}

async function nullWhere(table: string, column: string, value: string, payload: Record<string, null>) {
  const { error } = await supabaseAdmin
    .from(table as any)
    .update(payload as any)
    .eq(column, value);

  if (error) {
    throw new Error(`Error actualizando ${table}: ${error.message}`);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    console.log('[DELETE-API] Iniciando eliminación de usuario:', resolvedParams.id);

    // Verificar autenticación
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[DELETE-API] No hay header de autorización');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('[DELETE-API] Error de autenticación:', authError);
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que sea admin (usar supabaseAdmin para bypass RLS)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      console.error('[DELETE-API] Usuario no es admin');
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const userId = resolvedParams.id;
    console.log('[DELETE-API] Admin verificado, procediendo con userId:', userId);

    if (userId === user.id) {
      return NextResponse.json({
        error: 'No puedes eliminar tu propio usuario desde esta pantalla'
      }, { status: 403 });
    }

    // Verificar que el usuario a eliminar existe
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, email')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[DELETE-API] Error buscando perfil:', profileError);
      return NextResponse.json({ error: 'Error buscando usuario: ' + profileError.message }, { status: 500 });
    }

    if (!targetProfile) {
      console.error('[DELETE-API] Usuario no encontrado');
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    console.log('[DELETE-API] Usuario encontrado:', targetProfile.email, 'rol:', targetProfile.role);

    if (targetProfile.role === 'admin') {
      console.error('[DELETE-API] Intento de eliminar admin');
      return NextResponse.json({ 
        error: 'No se puede eliminar un usuario administrador' 
      }, { status: 403 });
    }

    if (targetProfile.role === 'client') {
      console.log('[DELETE-API] Limpiando dependencias de cliente...');
      await deleteWhere('client_machine_assignments', 'client_id', userId);
      await deleteWhere('client_settings', 'client_id', userId);
      await deleteWhere('client_revenue_history_adjustments', 'client_id', userId);
      await deleteWhere('commission_snapshots', 'client_id', userId);
    }

    if (targetProfile.role === 'reponedor') {
      console.log('[DELETE-API] Limpiando dependencias de reponedor...');
      await nullWhere('replenishment_route_machines', 'completed_by', userId, { completed_by: null });
      await nullWhere('replenishment_route_events', 'user_id', userId, { user_id: null });
      await deleteWhere('replenishment_routes', 'replenisher_id', userId);
    }

    // Eliminar usuario de Auth (esto activará el CASCADE en la BD)
    console.log('[DELETE-API] Eliminando usuario de Auth...');
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('[DELETE-API] Error eliminando usuario de Auth:', deleteError);
      throw new Error(`Error eliminando usuario: ${deleteError.message}`);
    }

    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    console.log('[DELETE-API] Usuario eliminado exitosamente:', targetProfile.email);

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    });

  } catch (error: any) {
    console.error('[DELETE-API] Error inesperado:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
