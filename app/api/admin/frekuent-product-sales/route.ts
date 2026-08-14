import { NextRequest, NextResponse } from 'next/server';
import { formatDateForFrekuent, getFrekuentSalesByProduct } from '@/lib/frekuent';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';

export const dynamic = 'force-dynamic';

interface MachineRow {
  id: string;
  name: string | null;
  frekuent_machine_id: string | null;
  orain_machine_id: string | null;
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: 'Error obteniendo perfil', status: 500 as const };
  }

  if (profile.role !== 'admin') {
    return { error: 'Permisos insuficientes', status: 403 as const };
  }

  return { user };
}

function madridCurrentMonthRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const offset = formatDateForFrekuent(new Date(Date.UTC(year, month - 1, 15, 12, 0, 0)), 'Europe/Madrid').slice(-6);
  const startDate = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000${offset}`).toISOString();

  return {
    startDate,
    endDate: now.toISOString(),
  };
}

function numericId(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const machineIds = Array.isArray(body.machineIds) ? body.machineIds.map(String) : [];
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.map((item: unknown) => String(item || '').trim()).filter(Boolean)
      : ['MONSTER', 'LANJARON'];

    const { data, error } = await supabaseAdmin
      .from('machines')
      .select('id, name, frekuent_machine_id, orain_machine_id')
      .or('frekuent_machine_id.not.is.null,orain_machine_id.not.is.null');

    if (error) throw new Error(`No se pudieron cargar máquinas Frekuent: ${error.message}`);

    const selectedMachines = ((data || []) as MachineRow[])
      .filter((machine) => machineIds.length === 0 || machineIds.includes(machine.id));

    const frekuentIds = selectedMachines
      .map((machine) => numericId(machine.orain_machine_id || machine.frekuent_machine_id))
      .filter((id): id is number => Boolean(id));

    const range = madridCurrentMonthRange();
    const sales = await getFrekuentSalesByProduct({
      machineIds: frekuentIds,
      ...range,
      datesLogic: 'current_month',
    });

    const groups = keywords.map((keyword) => {
      const normalizedKeyword = normalize(keyword);
      const matched = sales.filter((sale) => normalize(sale.productName).includes(normalizedKeyword));
      const amount = matched.reduce((sum, sale) => sum + sale.amount, 0);

      return {
        keyword,
        units: matched.length,
        amount: Math.round(amount * 100) / 100,
        products: Array.from(new Set(matched.map((sale) => sale.productName))).slice(0, 12),
      };
    });

    return NextResponse.json({
      success: true,
      range,
      groups,
    });
  } catch (error) {
    console.error('[ADMIN-FREKUENT-PRODUCT-SALES] Error:', error);
    const message = error instanceof Error ? error.message : 'Error cargando ventas por producto';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
