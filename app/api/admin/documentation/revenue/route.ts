import { NextResponse } from 'next/server';
import { requireDocumentationAdmin } from '@/lib/documentation/admin-auth';
import { previousMadridMonthRange } from '@/lib/documentation/calculations';
import { supabaseAdmin } from '@/lib/supabase-helpers';
import { getFrekuentRevenueMachines } from '@/lib/frekuent';
import { getTelevendRevenueMachines } from '@/lib/televend';
import { generateFrekuentId } from '@/lib/machine-id-utils';

export async function GET(request: Request) {
  const auth = await requireDocumentationAdmin(request);
  if ('error' in auth) return auth.error;
  try {
    const range = previousMadridMonthRange();
    const { data: machines, error } = await supabaseAdmin.from('machines').select('id, name, location, frekuent_machine_id, orain_machine_id, televend_machine_id')
      .or('frekuent_machine_id.not.is.null,orain_machine_id.not.is.null,televend_machine_id.not.is.null');
    if (error) throw error;
    const [frekuent, televend] = await Promise.allSettled([
      machines?.some((m: any) => !m.televend_machine_id) ? getFrekuentRevenueMachines({ ...range, datesLogic: 'custom', pageSize: 200 }) : Promise.resolve([]),
      machines?.some((m: any) => m.televend_machine_id) ? getTelevendRevenueMachines({ fromTimestamp: new Date(range.startDate).toISOString(), toTimestamp: new Date(range.endDate).toISOString() }) : Promise.resolve([]),
    ]);
    const warnings: string[] = [];
    if (frekuent.status === 'rejected') warnings.push('No se pudo consultar Frekuent. Sus máquinas quedan sin datos para este mes.');
    if (televend.status === 'rejected') warnings.push('No se pudo consultar Televend. Sus máquinas quedan sin datos para este mes.');
    if (frekuent.status === 'rejected' && televend.status === 'rejected') throw new Error('No se pudo consultar el mes anterior. Vuelve a intentarlo.');
    const fetchedAt = new Date().toISOString();
    const rows = (machines || []).map((m: any) => {
      const source = m.televend_machine_id ? 'televend' : 'frekuent';
      const tv = televend.status === 'fulfilled' ? televend.value.find(r => String(r.machineId) === String(m.televend_machine_id)) : undefined;
      const fk = frekuent.status === 'fulfilled' ? frekuent.value.find(r => String(r.machineId) === String(m.orain_machine_id) || String(r.machineId) === String(m.frekuent_machine_id) || generateFrekuentId(r.machineName) === generateFrekuentId(m.name)) : undefined;
      const revenue = source === 'televend' ? tv : fk;
      return {
        id: m.id, name: m.name, location: m.location, source,
        providerMachineId: revenue ? String(revenue.machineId) : null,
        previous_month: revenue ? { total: source === 'televend' ? tv!.totalRevenue : fk!.totalMoney, card: revenue.totalCard, cash: revenue.totalCash, updatedAt: fetchedAt } : null,
      };
    });
    return NextResponse.json({ machines: rows, range, warnings, fetchedAt });
  } catch (error) {
    console.error('[DOCUMENTATION] Error consultando mes anterior', error);
    return NextResponse.json({ error: 'No se pudo consultar el mes anterior. Vuelve a intentarlo.' }, { status: 502 });
  }
}
