import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase con service_role para operaciones de administración
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

// GET - Obtener todos los empleados
export async function GET(request: NextRequest) {
  try {
    // Obtener todos los usuarios usando Admin API
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.error('Error obteniendo usuarios:', error);
      return NextResponse.json(
        { error: 'Error al obtener empleados' },
        { status: 500 }
      );
    }

    // Obtener perfiles desde la tabla profiles para roles correctos
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, display_name');

    if (profilesError) {
      console.error('Error obteniendo perfiles:', profilesError);
    }

    // Crear un mapa de perfiles por ID
    const profilesMap = new Map(
      profiles?.map(p => [p.id, p]) || []
    );

    // Transformar usuarios combinando datos de Auth y Profiles
    const employees = users.map(user => {
      const profile = profilesMap.get(user.id);
      return {
        id: user.id,
        email: user.email,
        name: profile?.display_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Sin nombre',
        role: profile?.role || user.user_metadata?.role || 'operador',
        permissions: user.user_metadata?.permissions || [],
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
      };
    });

    return NextResponse.json({ employees });
  } catch (error: any) {
    console.error('Error en GET /api/admin/employees:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear un nuevo empleado
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, role, permissions } = body;

    // Validaciones
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, contraseña y nombre son obligatorios' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Verificar que el rol es válido
    const validRoles = ['admin', 'operador'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Rol inválido' },
        { status: 400 }
      );
    }

    // Crear usuario en Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        name,
        role,
        permissions: permissions || [],
      },
    });

    if (error) {
      console.error('Error creando usuario:', error);
      if (error.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'Este email ya está registrado' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: data.user.id,
        email: data.user.email,
        name,
        role,
        permissions: permissions || [],
      },
    });
  } catch (error: any) {
    console.error('Error en POST /api/admin/employees:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar un empleado
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { error: 'ID de usuario es obligatorio' },
        { status: 400 }
      );
    }

    // Eliminar usuario de Supabase Auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error('Error eliminando usuario:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Empleado eliminado exitosamente',
    });
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/employees:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar un empleado (opcional para futuras mejoras)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, role, permissions } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'ID de usuario es obligatorio' },
        { status: 400 }
      );
    }

    // Actualizar metadatos del usuario
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        name,
        role,
        permissions: permissions || [],
      },
    });

    if (error) {
      console.error('Error actualizando usuario:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: data.user.id,
        email: data.user.email,
        name,
        role,
        permissions: permissions || [],
      },
    });
  } catch (error: any) {
    console.error('Error en PUT /api/admin/employees:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
