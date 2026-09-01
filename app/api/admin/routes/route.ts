import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export const dynamic = 'force-dynamic';

type ProfileRole = 'admin' | 'client' | 'operador' | 'reponedor';

async function requireRouteUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );

  if (authError || !user) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, display_name, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Error obteniendo perfil', status: 500 as const };
  }

  if (!['admin', 'reponedor'].includes(profile.role)) {
    return { error: 'Permisos insuficientes', status: 403 as const };
  }

  return { user, profile: profile as typeof profile & { role: ProfileRole } };
}

function getProvider(machine: any) {
  return machine?.televend_machine_id ? 'televend' : 'frekuent';
}

function getExternalMachineId(machine: any) {
  const provider = getProvider(machine);
  const rawId = provider === 'televend'
    ? machine?.televend_machine_id
    : machine?.frekuent_machine_id || machine?.orain_machine_id;
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getFillRate(stock?: any) {
  const capacity = Number(stock?.total_capacity || 0);
  const available = Number(stock?.total_available || 0);
  if (capacity <= 0) return null;
  return Math.round((available / capacity) * 100);
}

function getUrgency(fillRate: number | null, stock?: any) {
  if (fillRate === null && Number(stock?.total_to_replenish || 0) > 0) return 'critical';
  if (fillRate === null) return 'unknown';
  if (fillRate <= 0) return 'empty';
  if (fillRate < 65) return 'critical';
  if (fillRate < 75) return 'normal';
  return 'ok';
}

function normalizeMachine(machine: any, stock?: any) {
  const fillRate = getFillRate(stock);
  return {
    id: machine.id,
    name: machine.name || stock?.machine_name || 'Máquina',
    location: machine.location || stock?.machine_location || null,
    provider: getProvider(machine),
    externalMachineId: getExternalMachineId(machine),
    fillRate,
    urgency: getUrgency(fillRate, stock),
    totalToReplenish: Number(stock?.total_to_replenish || 0),
    stockUpdatedAt: stock?.scraped_at || null,
  };
}

function uniqueMachineIds(machineIds: unknown[]) {
  return Array.from(new Set(machineIds.map(String).map((id) => id.trim()).filter(Boolean)));
}

async function loadStockByMachine(machineIds?: string[]) {
  let query = supabaseAdmin
    .from('machine_stock_current')
    .select('machine_id, machine_name, machine_location, scraped_at, total_capacity, total_available, total_to_replenish');

  if (machineIds?.length) {
    query = query.in('machine_id', machineIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`No se pudo cargar stock: ${error.message}`);

  return (data || []).reduce((map: Map<string, any>, row: any) => {
    map.set(row.machine_id, row);
    return map;
  }, new Map<string, any>());
}

async function updateRouteStatus(routeId: string) {
  const { data: rows, error } = await supabaseAdmin
    .from('replenishment_route_machines' as any)
    .select('status')
    .eq('route_id', routeId);

  if (error) return;

  const total = rows?.length || 0;
  const done = (rows || []).filter((row: any) => row.status === 'done').length;
  const status = total > 0 && done === total ? 'completed' : done > 0 ? 'in_progress' : 'planned';

  await supabaseAdmin
    .from('replenishment_routes' as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', routeId);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRouteUser(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const isAdmin = auth.profile.role === 'admin';

    let routesQuery = supabaseAdmin
      .from('replenishment_routes' as any)
      .select('*')
      .order('scheduled_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      routesQuery = routesQuery.eq('replenisher_id', auth.user.id);
    }

    const [routesResult, replenishersResult, machinesResult] = await Promise.all([
      routesQuery,
      isAdmin
        ? supabaseAdmin
          .from('profiles')
          .select('id, email, display_name, role')
          .eq('role', 'reponedor')
          .order('display_name', { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
      isAdmin
        ? supabaseAdmin
          .from('machines')
          .select('*')
          .or('frekuent_machine_id.not.is.null,orain_machine_id.not.is.null,televend_machine_id.not.is.null')
          .order('name', { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (routesResult.error) {
      throw new Error(`No se pudieron cargar rutas: ${routesResult.error.message}`);
    }
    if (replenishersResult.error) {
      throw new Error(`No se pudieron cargar reponedores: ${replenishersResult.error.message}`);
    }
    if (machinesResult.error) {
      throw new Error(`No se pudieron cargar máquinas: ${machinesResult.error.message}`);
    }

    const routes = routesResult.data || [];
    const routeIds = routes.map((route: any) => route.id);
    const replenisherIds = Array.from(new Set(routes.map((route: any) => route.replenisher_id).filter(Boolean)));

    const [routeMachinesResult, routeProfilesResult, stockByMachine] = await Promise.all([
      routeIds.length
        ? supabaseAdmin
          .from('replenishment_route_machines' as any)
          .select('*, machine:machines(*)')
          .in('route_id', routeIds)
          .order('position', { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
      replenisherIds.length
        ? supabaseAdmin
          .from('profiles')
          .select('id, email, display_name, role')
          .in('id', replenisherIds)
        : Promise.resolve({ data: [], error: null } as any),
      loadStockByMachine(),
    ]);

    if (routeMachinesResult.error) {
      throw new Error(`No se pudieron cargar máquinas de ruta: ${routeMachinesResult.error.message}`);
    }
    if (routeProfilesResult.error) {
      throw new Error(`No se pudieron cargar perfiles de ruta: ${routeProfilesResult.error.message}`);
    }

    const profilesById = new Map((routeProfilesResult.data || []).map((profile: any) => [profile.id, profile]));
    const routeMachinesByRoute = new Map<string, any[]>();

    for (const row of routeMachinesResult.data || []) {
      const stock = stockByMachine.get(row.machine_id);
      const list = routeMachinesByRoute.get(row.route_id) || [];
      list.push({
        id: row.id,
        routeId: row.route_id,
        machineId: row.machine_id,
        position: row.position,
        status: row.status,
        completedAt: row.completed_at,
        notes: row.notes,
        machine: normalizeMachine(row.machine, stock),
      });
      routeMachinesByRoute.set(row.route_id, list);
    }

    const shapedRoutes = routes.map((route: any) => {
      const machines = routeMachinesByRoute.get(route.id) || [];
      const done = machines.filter((machine) => machine.status === 'done').length;
      return {
        id: route.id,
        name: route.name,
        scheduledDate: route.scheduled_date,
        status: route.status,
        notes: route.notes,
        createdAt: route.created_at,
        replenisherId: route.replenisher_id,
        replenisher: profilesById.get(route.replenisher_id) || null,
        machines,
        totalMachines: machines.length,
        doneMachines: done,
        pendingMachines: Math.max(machines.length - done, 0),
      };
    });

    const selectableMachines = (machinesResult.data || []).map((machine: any) => {
      const stock = stockByMachine.get(machine.id);
      return normalizeMachine(machine, stock);
    });

    return NextResponse.json({
      success: true,
      userRole: auth.profile.role,
      routes: shapedRoutes,
      replenishers: replenishersResult.data || [],
      machines: selectableMachines,
    });
  } catch (error: any) {
    console.error('[ADMIN-ROUTES] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRouteUser(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (auth.profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admin puede crear rutas' }, { status: 403 });
    }

    const body = await request.json();
    const scheduledDate = String(body.scheduledDate || '').trim();
    const name = String(body.name || '').trim() || `Ruta (${scheduledDate})`;
    const replenisherId = String(body.replenisherId || '').trim();
    const machineIds = Array.isArray(body.machineIds) ? uniqueMachineIds(body.machineIds) : [];
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!scheduledDate || !replenisherId || machineIds.length === 0) {
      return NextResponse.json({ error: 'Fecha, reponedor y máquinas son obligatorios' }, { status: 400 });
    }

    const { data: replenisher, error: replenisherError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', replenisherId)
      .single();

    if (replenisherError || replenisher?.role !== 'reponedor') {
      return NextResponse.json({ error: 'El usuario asignado debe ser reponedor' }, { status: 400 });
    }

    const { data: route, error: routeError } = await supabaseAdmin
      .from('replenishment_routes' as any)
      .insert({
        name,
        scheduled_date: scheduledDate,
        replenisher_id: replenisherId,
        notes,
        created_by: auth.user.id,
      })
      .select('*')
      .single();

    if (routeError) {
      throw new Error(`No se pudo crear la ruta: ${routeError.message}`);
    }

    const rows = machineIds.map((machineId: string, index: number) => ({
      route_id: route.id,
      machine_id: machineId,
      position: index + 1,
      status: 'pending',
    }));

    const { error: machinesError } = await supabaseAdmin
      .from('replenishment_route_machines' as any)
      .insert(rows);

    if (machinesError) {
      await supabaseAdmin.from('replenishment_routes' as any).delete().eq('id', route.id);
      throw new Error(`No se pudieron asignar máquinas: ${machinesError.message}`);
    }

    await supabaseAdmin
      .from('replenishment_route_events' as any)
      .insert({
        route_id: route.id,
        user_id: auth.user.id,
        event_type: 'route_created',
        metadata: { machineCount: machineIds.length },
      });

    return NextResponse.json({ success: true, routeId: route.id });
  } catch (error: any) {
    console.error('[ADMIN-ROUTES] Error creando ruta:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireRouteUser(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();

    if (body.action === 'update-route') {
      if (auth.profile.role !== 'admin') {
        return NextResponse.json({ error: 'Solo admin puede editar rutas' }, { status: 403 });
      }

      const routeId = String(body.routeId || '').trim();
      const scheduledDate = String(body.scheduledDate || '').trim();
      const name = String(body.name || '').trim() || `Ruta (${scheduledDate})`;
      const replenisherId = String(body.replenisherId || '').trim();
      const machineIds = Array.isArray(body.machineIds) ? uniqueMachineIds(body.machineIds) : [];

      if (!routeId || !scheduledDate || !replenisherId || machineIds.length === 0) {
        return NextResponse.json({ error: 'Fecha, reponedor y máquinas son obligatorios' }, { status: 400 });
      }

      const { data: route, error: routeError } = await supabaseAdmin
        .from('replenishment_routes' as any)
        .select('id')
        .eq('id', routeId)
        .single();

      if (routeError || !route) {
        return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 });
      }

      const { data: replenisher, error: replenisherError } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', replenisherId)
        .single();

      if (replenisherError || replenisher?.role !== 'reponedor') {
        return NextResponse.json({ error: 'El usuario asignado debe ser reponedor' }, { status: 400 });
      }

      const { error: updateRouteError } = await supabaseAdmin
        .from('replenishment_routes' as any)
        .update({
          name,
          scheduled_date: scheduledDate,
          replenisher_id: replenisherId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', routeId);

      if (updateRouteError) {
        throw new Error(`No se pudo editar la ruta: ${updateRouteError.message}`);
      }

      const { data: existingRows, error: existingError } = await supabaseAdmin
        .from('replenishment_route_machines' as any)
        .select('id, machine_id, status')
        .eq('route_id', routeId);

      if (existingError) {
        throw new Error(`No se pudieron leer las máquinas de la ruta: ${existingError.message}`);
      }

      const existingByMachine = new Map((existingRows || []).map((row: any) => [row.machine_id, row]));
      const nextMachineSet = new Set(machineIds);
      const removedIds = (existingRows || [])
        .filter((row: any) => !nextMachineSet.has(row.machine_id))
        .map((row: any) => row.id);

      if (removedIds.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('replenishment_route_machines' as any)
          .delete()
          .in('id', removedIds);

        if (deleteError) {
          throw new Error(`No se pudieron quitar máquinas: ${deleteError.message}`);
        }
      }

      const inserts = machineIds
        .filter((machineId) => !existingByMachine.has(machineId))
        .map((machineId, index) => ({
          route_id: routeId,
          machine_id: machineId,
          position: index + 1,
          status: 'pending',
        }));

      if (inserts.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('replenishment_route_machines' as any)
          .insert(inserts);

        if (insertError) {
          throw new Error(`No se pudieron añadir máquinas: ${insertError.message}`);
        }
      }

      await Promise.all(machineIds.map((machineId, index) => {
        const existing = existingByMachine.get(machineId);
        if (!existing) return Promise.resolve();
        return supabaseAdmin
          .from('replenishment_route_machines' as any)
          .update({ position: index + 1 })
          .eq('id', existing.id);
      }));

      await Promise.all([
        updateRouteStatus(routeId),
        supabaseAdmin
          .from('replenishment_route_events' as any)
          .insert({
            route_id: routeId,
            user_id: auth.user.id,
            event_type: 'route_updated',
            metadata: { machineCount: machineIds.length, removedCount: removedIds.length, addedCount: inserts.length },
          }),
      ]);

      return NextResponse.json({ success: true });
    }

    const routeMachineId = String(body.routeMachineId || '').trim();
    const status = body.status === 'done' ? 'done' : 'pending';

    if (!routeMachineId) {
      return NextResponse.json({ error: 'Falta la máquina de ruta' }, { status: 400 });
    }

    const { data: routeMachine, error: routeMachineError } = await supabaseAdmin
      .from('replenishment_route_machines' as any)
      .select('*')
      .eq('id', routeMachineId)
      .single();

    if (routeMachineError || !routeMachine) {
      return NextResponse.json({ error: 'Máquina de ruta no encontrada' }, { status: 404 });
    }

    const { data: route, error: routeError } = await supabaseAdmin
      .from('replenishment_routes' as any)
      .select('*')
      .eq('id', routeMachine.route_id)
      .single();

    if (routeError || !route) {
      return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 });
    }

    if (auth.profile.role !== 'admin' && route.replenisher_id !== auth.user.id) {
      return NextResponse.json({ error: 'No puedes modificar esta ruta' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('replenishment_route_machines' as any)
      .update({
        status,
        completed_at: status === 'done' ? now : null,
        completed_by: status === 'done' ? auth.user.id : null,
      })
      .eq('id', routeMachineId);

    if (updateError) {
      throw new Error(`No se pudo actualizar la máquina: ${updateError.message}`);
    }

    await Promise.all([
      updateRouteStatus(routeMachine.route_id),
      supabaseAdmin
        .from('replenishment_route_events' as any)
        .insert({
          route_id: routeMachine.route_id,
          route_machine_id: routeMachine.id,
          machine_id: routeMachine.machine_id,
          user_id: auth.user.id,
          event_type: status === 'done' ? 'machine_done' : 'machine_pending',
          metadata: {},
        }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ADMIN-ROUTES] Error actualizando ruta:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
