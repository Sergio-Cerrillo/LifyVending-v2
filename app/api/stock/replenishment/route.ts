import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase-helpers';
import type { FrekuentRailUpdateRow } from '@/lib/frekuent';
import type { TelevendQuantityUpdateRow } from '@/lib/televend';
import {
  FrekuentApiError,
  getFrekuentProductOptions,
  refillFrekuentMachineStock,
  updateFrekuentMachineRails,
} from '@/lib/frekuent';
import {
  TelevendApiError,
  refillTelevendMachineStock,
  updateTelevendMachineQuantities,
} from '@/lib/televend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireStockUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No autorizado', status: 401 as const };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

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

  if (!['admin', 'operador'].includes(profile.role)) {
    return { error: 'Permisos insuficientes', status: 403 as const };
  }

  return { user, profile };
}

function numberFromPayload(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function normalizeRailRows(value: unknown): FrekuentRailUpdateRow[] {
  if (!Array.isArray(value)) {
    throw new FrekuentApiError(400, 'Los raíles enviados no son válidos');
  }

  return value.map((row, index) => {
    const item = row as Record<string, unknown>;
    const rail = item.rail == null || item.rail === '' ? null : numberFromPayload(item.rail);
    const number = numberFromPayload(item.number);
    const productId = numberFromPayload(item.product_id);
    const quantity = numberFromPayload(item.quantity);
    const capacity = numberFromPayload(item.capacity);
    const price = numberFromPayload(item.price);
    const min = numberFromPayload(item.min);
    const numberMdb = item.number_mdb == null || item.number_mdb === '' ? null : numberFromPayload(item.number_mdb);

    if (!Number.isInteger(number) || number <= 0) {
      throw new FrekuentApiError(400, `El raíl ${index + 1} tiene un número no válido`);
    }
    if (numberMdb !== null && (!Number.isInteger(numberMdb) || numberMdb <= 0)) {
      throw new FrekuentApiError(400, `El raíl ${number} tiene un número MDB no válido`);
    }
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new FrekuentApiError(400, `El raíl ${number} no tiene producto válido`);
    }
    if (!Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(capacity) || capacity < 0) {
      throw new FrekuentApiError(400, `El raíl ${number} tiene cantidad/capacidad no válida`);
    }
    if (quantity > capacity) {
      throw new FrekuentApiError(400, `El raíl ${number} tiene más cantidad que capacidad`);
    }
    if (!Number.isInteger(price) || price < 0) {
      throw new FrekuentApiError(400, `El raíl ${number} tiene precio no válido`);
    }
    if (!Number.isInteger(min) || min < 0) {
      throw new FrekuentApiError(400, `El raíl ${number} tiene mínimo no válido`);
    }

    return {
      rail: rail === null ? null : rail,
      number,
      number_mdb: numberMdb,
      product_id: productId,
      quantity,
      capacity,
      price,
      min,
    };
  });
}

function normalizeTelevendQuantityRows(value: unknown): TelevendQuantityUpdateRow[] {
  if (!Array.isArray(value)) {
    throw new TelevendApiError(400, 'Las cantidades enviadas no son válidas');
  }

  return value.map((row, index) => {
    const item = row as Record<string, unknown>;
    const columnId = numberFromPayload(item.columnId);
    const quantity = numberFromPayload(item.quantity);

    if (!Number.isInteger(columnId) || columnId <= 0) {
      throw new TelevendApiError(400, `La columna ${index + 1} no es válida`);
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new TelevendApiError(400, `La cantidad de la columna ${index + 1} no es válida`);
    }

    return { columnId, quantity };
  });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStockUser(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const resource = request.nextUrl.searchParams.get('resource');
    if (resource !== 'products') {
      return NextResponse.json({ error: 'Recurso no válido' }, { status: 400 });
    }

    const products = await getFrekuentProductOptions();

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error('[STOCK-REPLENISHMENT-API] Error:', error);

    if (error instanceof FrekuentApiError) {
      return NextResponse.json(
        { error: error.message || error.userMessage },
        { status: error.status },
      );
    }

    const message = error instanceof Error ? error.message : 'Error consultando productos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStockUser(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const payload = await request.json().catch(() => ({}));
    const machineId = Number(payload.machineId);
    const action = typeof payload.action === 'string' ? payload.action : '';
    const provider = payload.provider === 'televend' ? 'televend' : 'frekuent';

    if (!Number.isInteger(machineId) || machineId <= 0) {
      return NextResponse.json({ error: 'ID de máquina no válido' }, { status: 400 });
    }

    if (provider === 'televend') {
      if (action === 'full-refill') {
        await refillTelevendMachineStock(machineId);

        return NextResponse.json({
          success: true,
          provider,
          action,
          machineId,
          updatedAt: new Date().toISOString(),
        });
      }

      if (action === 'update-quantities') {
        const rows = normalizeTelevendQuantityRows(payload.rows);
        await updateTelevendMachineQuantities(machineId, rows);

        return NextResponse.json({
          success: true,
          provider,
          action,
          machineId,
          updatedAt: new Date().toISOString(),
        });
      }

      return NextResponse.json({ error: 'Acción de Televend no válida' }, { status: 400 });
    }

    if (action === 'full-refill') {
      await refillFrekuentMachineStock(machineId);

      return NextResponse.json({
        success: true,
        provider,
        action,
        machineId,
        updatedAt: new Date().toISOString(),
      });
    }

    if (action === 'update-rails') {
      const rows = normalizeRailRows(payload.rows);
      await updateFrekuentMachineRails(machineId, rows);

      return NextResponse.json({
        success: true,
        provider,
        action,
        machineId,
        updatedAt: new Date().toISOString(),
      });
    }

    if (!['full-refill', 'update-rails'].includes(action)) {
      return NextResponse.json({ error: 'Acción de reposición no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('[STOCK-REPLENISHMENT-API] Error:', error);

    if (error instanceof FrekuentApiError) {
      return NextResponse.json(
        { error: error.userMessage || error.message },
        { status: error.status },
      );
    }

    if (error instanceof TelevendApiError) {
      return NextResponse.json(
        { error: error.userMessage || error.message },
        { status: error.status },
      );
    }

    const message = error instanceof Error ? error.message : 'Error actualizando reposición';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
