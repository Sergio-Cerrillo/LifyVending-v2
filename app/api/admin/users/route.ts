/**
 * API: Gestionar usuarios operativos
 * GET /api/admin/users
 * POST /api/admin/users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createNewClient, supabase, supabaseAdmin } from '@/lib/supabase-helpers';

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return { error: 'No autorizado', status: 401 as const };

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (authError || !user) return { error: 'No autorizado', status: 401 as const };

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: 'Permisos insuficientes', status: 403 as const };
  }

  return { user, profile };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .in('role', ['client', 'reponedor'])
      .order('created_at', { ascending: false });

    if (usersError) {
      throw new Error(`Error obteniendo usuarios: ${usersError.message}`);
    }

    const enrichedUsers = await Promise.all(
      (users || []).map(async (profile) => {
        if (profile.role === 'client') {
          const [{ data: settingsData }, { count }] = await Promise.all([
            supabaseAdmin
              .from('client_settings')
              .select('*')
              .eq('client_id', profile.id)
              .single(),
            supabaseAdmin
              .from('client_machine_assignments')
              .select('*', { count: 'exact', head: true })
              .eq('client_id', profile.id),
          ]);

          return {
            ...profile,
            machineCount: count || 0,
            commissionHidePercent: settingsData?.commission_hide_percent ?? 0,
            commissionPaymentPercent: settingsData?.commission_payment_percent ?? 0,
            routeCount: 0,
          };
        }

        const { count, error: routeCountError } = await supabaseAdmin
          .from('replenishment_routes' as any)
          .select('*', { count: 'exact', head: true })
          .eq('replenisher_id', profile.id);

        if (routeCountError) {
          console.warn('[GET-USERS] No se pudo contar rutas del reponedor:', routeCountError.message);
        }

        return {
          ...profile,
          machineCount: 0,
          commissionHidePercent: 0,
          commissionPaymentPercent: 0,
          routeCount: routeCountError ? 0 : count || 0,
        };
      })
    );

    return NextResponse.json({ users: enrichedUsers });
  } catch (error: any) {
    console.error('Error obteniendo usuarios:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

async function createReplenisher(params: {
  email: string;
  password: string;
  displayName?: string | null;
}) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      role: 'reponedor',
      name: params.displayName || params.email,
    },
  });

  if (authError) {
    throw new Error(`Error creando reponedor: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error('No se pudo crear el reponedor');
  }

  await supabaseAdmin
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email: params.email,
      role: 'reponedor',
      display_name: params.displayName || null,
      company_name: null,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'id' });

  return authData.user;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Parsear body
    const body = await request.json();
    const { email, password, displayName, companyName, commissionHidePercent, commissionPaymentPercent } = body;
    const role = body.role === 'reponedor' ? 'reponedor' : 'client';

    const parsedHide = Number(commissionHidePercent);
    const parsedPayment = Number(commissionPaymentPercent);

    const normalizedHidePercent = Number.isFinite(parsedHide) ? parsedHide : 30;
    const normalizedPaymentPercent = Number.isFinite(parsedPayment) ? parsedPayment : 15;

    console.log('[CREATE-USER] Datos recibidos:', { 
      role,
      email, 
      displayName, 
      companyName, 
      commissionHidePercent: normalizedHidePercent,
      commissionHidePercent_type: typeof normalizedHidePercent,
      commissionPaymentPercent: normalizedPaymentPercent,
      commissionPaymentPercent_type: typeof normalizedPaymentPercent
    });

    // Validaciones
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y password son requeridos' },
        { status: 400 }
      );
    }

    if (role === 'client' && (normalizedHidePercent < 0 || normalizedHidePercent > 100)) {
      return NextResponse.json(
        { error: 'El porcentaje oculto debe estar entre 0 y 100' },
        { status: 400 }
      );
    }

    if (role === 'client' && (normalizedPaymentPercent < 0 || normalizedPaymentPercent > 100)) {
      return NextResponse.json(
        { error: 'El porcentaje de comisión debe estar entre 0 y 100' },
        { status: 400 }
      );
    }

    const newUser = role === 'reponedor'
      ? await createReplenisher({ email, password, displayName })
      : await createNewClient({
        email,
        password,
        displayName,
        companyName,
        commissionHidePercent: normalizedHidePercent,
        commissionPaymentPercent: normalizedPaymentPercent
      });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email
      }
    });

  } catch (error: any) {
    console.error('Error creando usuario:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
