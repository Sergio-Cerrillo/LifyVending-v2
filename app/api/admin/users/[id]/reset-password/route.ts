/**
 * API: Resetear contraseña de cliente
 * POST /api/admin/users/[id]/reset-password
 */

import { NextRequest, NextResponse } from 'next/server';
import { resetUserPassword, supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    // Verificar autenticación y permisos
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
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Resetear contraseña
    await resetUserPassword(resolvedParams.id, newPassword);

    return NextResponse.json({
      success: true,
      message: 'Contraseña reseteada correctamente'
    });

  } catch (error: any) {
    console.error('Error reseteando contraseña:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
