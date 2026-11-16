import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';
import { getFrekuentMachines, getFrekuentStockMachines } from '@/lib/frekuent';
import { getTelevendMachineOptions, getTelevendStockMachines } from '@/lib/televend';
import { generateFrekuentId } from '@/lib/machine-id-utils';
import { resolveLegacyTelevendMachineId } from '@/lib/replenishment/televend-machine-id';
import { missingProducts } from '@/lib/replenishment/missing-products';

export const dynamic = 'force-dynamic';

function positiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: NextRequest) {
  try {
    const header = request.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser(header.slice(7));
    if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profileError) return NextResponse.json({ error: 'No se pudo validar el perfil' }, { status: 500 });
    if (!['admin', 'reponedor'].includes(profile?.role || '')) return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });

    const routeMachineId = request.nextUrl.searchParams.get('routeMachineId') || '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routeMachineId)) {
      return NextResponse.json({ error: 'Máquina de ruta inválida' }, { status: 400 });
    }
    const { data: assignment, error: assignmentError } = await supabaseAdmin.from('replenishment_route_machines' as any)
      .select('route_id, machine:machines(id, name, location, frekuent_machine_id, orain_machine_id, televend_machine_id)')
      .eq('id', routeMachineId).single();
    if (assignmentError || !assignment?.machine) return NextResponse.json({ error: 'Máquina de ruta no encontrada' }, { status: 404 });
    const { data: route, error: routeError } = await supabaseAdmin.from('replenishment_routes' as any)
      .select('replenisher_id').eq('id', assignment.route_id).single();
    if (routeError || !route) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 });
    if (profile.role !== 'admin' && route.replenisher_id !== user.id) {
      return NextResponse.json({ error: 'No tienes acceso a esta ruta' }, { status: 403 });
    }

    const machine = assignment.machine;
    const provider = machine.televend_machine_id ? 'televend' : 'frekuent';
    let externalId = provider === 'televend'
      ? positiveId(machine.televend_machine_id)
      : positiveId(machine.orain_machine_id) || positiveId(machine.frekuent_machine_id);
    if (!externalId && provider === 'frekuent') {
      // Frekuent también se guarda con un identificador de nombre en nuestra BD.
      const options = await getFrekuentMachines();
      const key = generateFrekuentId(machine.name || '');
      const matches = options.filter(option => key && generateFrekuentId(option.label) === key);
      if (matches.length === 1) externalId = positiveId(matches[0].value);
    }
    if (!externalId && provider === 'televend') {
      externalId = resolveLegacyTelevendMachineId(machine, await getTelevendMachineOptions());
    }
    if (!externalId) return NextResponse.json({ error: 'No se pudo identificar esta máquina en su proveedor de stock.' }, { status: 422 });
    // Nunca pasar una lista vacía: eso consultaría todas las máquinas del proveedor.
    const stockMachines = provider === 'televend'
      ? await getTelevendStockMachines([externalId])
      : await getFrekuentStockMachines([externalId]);
    const stock = stockMachines.find(item => item.machineId === externalId);
    if (!stock || !stock.products?.length) return NextResponse.json({ error: 'El proveedor no ha devuelto el detalle de productos de esta máquina. Prueba de nuevo más tarde.' }, { status: 502 });
    const products = missingProducts(stock.products);
    return NextResponse.json({
      machineName: machine.name, location: machine.location, provider,
      requestedAt: new Date().toISOString(), products,
      totalUnits: products.reduce((sum, product) => sum + product.units, 0),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[ROUTE-STOCK] Error consultando faltantes:', error);
    return NextResponse.json({ error: 'No se pudo consultar el stock. Vuelve a intentarlo.' }, { status: 502 });
  }
}
