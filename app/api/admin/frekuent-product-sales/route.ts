import { NextRequest, NextResponse } from 'next/server';
import { formatDateForFrekuent, getFrekuentRevenueMachines, getFrekuentSalesByProduct } from '@/lib/frekuent';
import { generateFrekuentId } from '@/lib/machine-id-utils';
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
  const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00${offset}`;

  return {
    startDate,
    endDate: formatDateForFrekuent(now, 'Europe/Madrid'),
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

function machineNameMatches(left: string, right: string) {
  const a = generateFrekuentId(left);
  const b = generateFrekuentId(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const leftNumber = extractMachineCode(left);
  const rightNumber = extractMachineCode(right);
  if (leftNumber && rightNumber && leftNumber === rightNumber) {
    const leftWords = meaningfulMachineWords(left);
    const rightWords = meaningfulMachineWords(right);
    return leftWords.some((word) => rightWords.includes(word));
  }

  return false;
}

function extractMachineCode(value: string) {
  const cleaned = value
    .replace(/\bid\s*:?\s*\d+/gi, ' ')
    .replace(/\bmain\s*:?\s*\d+/gi, ' ');
  const matches = cleaned.match(/\b\d{4,6}\b/g);
  return matches?.[0] || null;
}

function meaningfulMachineWords(value: string) {
  const ignored = new Set(['id', 'cafe', 'cafetera', 'litro', 'medio', 'modulo', 'maquina', 'machine']);
  return generateFrekuentId(value)
    .split('_')
    .filter((word) => word.length > 2 && !ignored.has(word) && !/^\d+$/.test(word));
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const machineIds = Array.isArray(body.machineIds) ? body.machineIds.map(String) : [];
    const providerMachineIds = Array.isArray(body.providerMachineIds) ? body.providerMachineIds.map(String) : [];
    const machineNames = Array.isArray(body.machineNames)
      ? body.machineNames.map((item: unknown) => String(item || '').trim()).filter(Boolean)
      : [];
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.map((item: unknown) => String(item || '').trim()).filter(Boolean)
      : ['MONSTER', 'LANJARON'];
    const matchModes = Array.isArray(body.matchModes)
      ? body.matchModes.map((item: unknown) => String(item || '').trim())
      : [];
    const directProviderIds = providerMachineIds
      .map(numericId)
      .filter((id): id is number => Boolean(id));

    let selectedMachines: MachineRow[] = [];
    let revenueMachines: Awaited<ReturnType<typeof getFrekuentRevenueMachines>> = [];

    const range = madridCurrentMonthRange();
    const frekuentIds = new Set<number>(directProviderIds);

    if (frekuentIds.size === 0) {
      const { data, error } = await supabaseAdmin
        .from('machines')
        .select('id, name, frekuent_machine_id, orain_machine_id')
        .or('frekuent_machine_id.not.is.null,orain_machine_id.not.is.null');

      if (error) throw new Error(`No se pudieron cargar máquinas Frekuent: ${error.message}`);

      const requestedMachineKeys = new Set([
        ...machineIds.map((id) => generateFrekuentId(id)),
        ...machineNames.map((name) => generateFrekuentId(name)),
      ].filter(Boolean));
      const requestedNumericIds = machineIds
        .map(numericId)
        .filter((id): id is number => Boolean(id));

      for (const id of requestedNumericIds) frekuentIds.add(id);

      selectedMachines = ((data || []) as MachineRow[])
        .filter((machine) => {
          if (machineIds.length === 0 && machineNames.length === 0) return true;
          if (machineIds.includes(machine.id)) return true;

          const machineKeys = [
            machine.name || '',
            machine.frekuent_machine_id || '',
            machine.orain_machine_id || '',
          ].map((value) => generateFrekuentId(value)).filter(Boolean);

          return machineKeys.some((key) => (
            requestedMachineKeys.has(key)
            || Array.from(requestedMachineKeys).some((requested) => (
              key === requested || key.includes(requested) || requested.includes(key)
            ))
          ));
        });

      const directFrekuentIds = selectedMachines
        .map((machine) => numericId(machine.orain_machine_id || machine.frekuent_machine_id))
        .filter((id): id is number => Boolean(id));
      for (const id of directFrekuentIds) frekuentIds.add(id);

      revenueMachines = await getFrekuentRevenueMachines({
        ...range,
        datesLogic: 'current_month',
        pageSize: 200,
      }).catch(() => []);
      const revenueByNormalizedName = new Map(
        revenueMachines.map((machine) => [generateFrekuentId(machine.machineName), machine.machineId]),
      );

      for (const requestedName of machineNames) {
        const exactMatch = revenueMachines.find((candidate) => generateFrekuentId(candidate.machineName) === generateFrekuentId(requestedName));
        const fuzzyMatch = exactMatch || revenueMachines.find((candidate) => machineNameMatches(candidate.machineName, requestedName));
        if (fuzzyMatch) frekuentIds.add(fuzzyMatch.machineId);
      }

      if (frekuentIds.size < selectedMachines.length) {
        for (const machine of selectedMachines) {
          const externalId = machine.frekuent_machine_id || machine.orain_machine_id || '';
          const normalizedName = generateFrekuentId(machine.name || '');
          const fuzzyMatch = revenueMachines.find((candidate) => (
            machineNameMatches(candidate.machineName, machine.name || '')
            || machineNameMatches(candidate.machineName, externalId)
          ));
          const matchedId = revenueByNormalizedName.get(externalId)
            || revenueByNormalizedName.get(normalizedName)
            || fuzzyMatch?.machineId;
          if (matchedId) frekuentIds.add(matchedId);
        }
      }
    }

    const rawActivityResponses: unknown[] = [];
    const collectRawActivity = (entry: unknown) => {
      if (rawActivityResponses.length < 8) rawActivityResponses.push(entry);
    };

    let sales = await getFrekuentSalesByProduct({
      machineIds: Array.from(frekuentIds),
      ...range,
      datesLogic: 'current_month',
      pageSize: 1000,
      allowEmptyProduct: true,
      completedOnly: true,
      debugCollector: collectRawActivity,
    });
    let salesAttempt = 'current_month';

    if (sales.length === 0 && frekuentIds.size > 0) {
      sales = await getFrekuentSalesByProduct({
        machineIds: Array.from(frekuentIds),
        ...range,
        datesLogic: 'custom',
        pageSize: 1000,
        allowEmptyProduct: true,
        completedOnly: true,
        debugCollector: collectRawActivity,
      });
      salesAttempt = 'custom';
    }

    const groups = keywords.map((keyword, index) => {
      const normalizedKeyword = normalize(keyword);
      const matchMode = matchModes[index] || 'product_name';
      const matched = matchMode === 'completed'
        ? sales
        : sales.filter((sale) => normalize(sale.productName).includes(normalizedKeyword));
      const amount = matched.reduce((sum, sale) => sum + sale.amount, 0);

      return {
        keyword,
        matchMode,
        units: matched.length,
        amount: Math.round(amount * 100) / 100,
        products: Array.from(new Set(matched.map((sale) => sale.productName || '(sin nombre)'))).slice(0, 12),
      };
    });

    return NextResponse.json({
      success: true,
      range,
      groups,
      matchedMachineIds: Array.from(frekuentIds),
      debug: {
        selectedMachines: selectedMachines.map((machine) => ({
          dbId: machine.id,
          name: machine.name,
          frekuentMachineId: machine.frekuent_machine_id,
          orainMachineId: machine.orain_machine_id,
          normalizedName: generateFrekuentId(machine.name || ''),
        })),
        requestedMachineIds: machineIds,
        requestedProviderMachineIds: providerMachineIds,
        requestedMachineNames: machineNames,
        requestedMatchModes: matchModes,
        revenueMachineCandidates: revenueMachines.slice(0, 20).map((machine) => ({
          id: machine.machineId,
          name: machine.machineName,
          normalizedName: generateFrekuentId(machine.machineName),
          totalMoney: machine.totalMoney,
          transactions: machine.numberTransactions,
        })),
        salesAttempt,
        salesCount: sales.length,
        sampleSales: sales.slice(0, 30).map((sale) => ({
          productName: sale.productName,
          machineId: sale.machineId,
          datetime: sale.datetime,
          amount: sale.amount,
          paymentMethod: sale.paymentMethod,
          typeTransformed: sale.typeTransformed,
        })),
        rawActivityResponses,
        uniqueProductNames: Array.from(new Set(sales.map((sale) => sale.productName || '(sin nombre)'))).slice(0, 50),
      },
    });
  } catch (error) {
    console.error('[ADMIN-FREKUENT-PRODUCT-SALES] Error:', error);
    const message = error instanceof Error ? error.message : 'Error cargando ventas por producto';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
