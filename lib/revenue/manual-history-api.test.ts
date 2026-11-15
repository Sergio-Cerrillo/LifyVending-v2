import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';

// Todas las peticiones de Supabase se interceptan; estas pruebas no acceden a datos reales.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://manual-history.invalid';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

const clientId = '12345678-1234-4234-8234-123456789012';
const machineId = '12345678-1234-4234-8234-123456789013';
const entryId = '12345678-1234-4234-8234-123456789014';
const payload = { machineId, year: 2020, month: 1, amountTotal: 1000, amountType: 'gross' };
const context = { params: Promise.resolve({ clientId }) };

test('API de históricos: autorización, importes, duplicados y protección de cierres', async t => {
  const originalFetch = globalThis.fetch;
  let role = 'admin';
  let assigned = true;
  let duplicate = false;
  let automatic = false;
  let legacySchema = false;
  let saved: any;
  let historyCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'manual-history.invalid');
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/auth/v1/user') return json({ id: clientId, role: 'authenticated' });
    if (url.pathname.endsWith('/profiles')) return json({ role });
    if (url.pathname.endsWith('/client_machine_assignments')) return json(assigned ? [{ machine_id: machineId }] : []);
    if (url.pathname.endsWith('/client_settings')) return json({ commission_hide_percent: 30, commission_payment_percent: 15 });
    if (url.pathname.endsWith('/client_revenue_history_adjustments')) {
      historyCalls++;
      if (duplicate) return json({ code: '23505', message: 'duplicate key' }, 409);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (legacySchema && ('commission_amount' in body || url.searchParams.has('or'))) {
        return json({
          code: 'commission_amount' in body ? 'PGRST204' : '42703',
          message: 'commission_amount' in body
            ? "Could not find the 'commission_amount' column of 'client_revenue_history_adjustments' in the schema cache"
            : 'column client_revenue_history_adjustments.generated_by does not exist',
        }, 400);
      }
      if (legacySchema) {
        assert.ok(!('gross_amount_internal' in body));
        assert.ok(!('hidden_percent_applied' in body));
        assert.ok(!('generated_by' in body));
        assert.ok(!('published_at' in body));
      }
      if (init?.method === 'PATCH' || init?.method === 'DELETE') {
        assert.equal(url.searchParams.get('client_id'), `eq.${clientId}`);
        assert.equal(url.searchParams.get('id'), `eq.${entryId}`);
        if (legacySchema) {
          assert.equal(url.searchParams.get('created_by_user_id'), 'not.is.null');
        } else {
          assert.equal(url.searchParams.get('or'), '(generated_by.is.null,generated_by.neq.system)');
        }
        if (automatic) return init.method === 'DELETE' ? json([]) : json({ code: 'PGRST116', message: 'No rows' }, 406);
      }
      saved = init?.body ? JSON.parse(String(init.body)) : null;
      return json(init?.method === 'DELETE' ? [{ id: entryId }] : { id: entryId, ...saved });
    }
    throw new Error(`Petición inesperada: ${url.pathname}`);
  };
  try {
    const route = await import('../../app/api/admin/clients/[clientId]/historical-adjustments/route');
    const request = (method: string, body: unknown, authenticated = true) => new NextRequest('http://localhost/api/history', {
      method, headers: { ...(authenticated ? { Authorization: 'Bearer test-token' } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    await t.test('rechaza peticiones sin sesión y usuarios cliente', async () => {
      assert.equal((await route.POST(request('POST', payload, false), context))!.status, 401);
      role = 'client';
      assert.equal((await route.POST(request('POST', payload), context))!.status, 403);
      role = 'admin';
      assert.equal(historyCalls, 0);
    });
    await t.test('rechaza máquinas no asignadas sin escribir', async () => {
      assigned = false;
      assert.equal((await route.POST(request('POST', payload), context))!.status, 400);
      assigned = true;
      assert.equal(historyCalls, 0);
    });
    await t.test('guarda el visible filtrado y marca el registro como manual', async () => {
      assert.equal((await route.POST(request('POST', payload), context))!.status, 200);
      assert.equal(saved.client_id, clientId);
      assert.equal(saved.amount_total, 700);
      assert.equal(saved.gross_amount_internal, 1000);
      assert.equal(saved.generated_by, 'manual');
      assert.equal(saved.created_by_user_id, clientId);
    });
    await t.test('informa del duplicado sin sobrescribir', async () => {
      duplicate = true;
      assert.equal((await route.POST(request('POST', payload), context))!.status, 409);
      duplicate = false;
    });
    await t.test('edita un final sin aplicar el porcentaje dos veces', async () => {
      assert.equal((await route.PATCH(request('PATCH', { ...payload, id: entryId, amountTotal: 700, amountType: 'visible' }), context))!.status, 200);
      assert.equal(saved.amount_total, 700);
      assert.equal(saved.gross_amount_internal, null);
    });
    await t.test('impide editar y eliminar entradas automáticas', async () => {
      automatic = true;
      assert.equal((await route.PATCH(request('PATCH', { ...payload, id: entryId }), context))!.status, 409);
      assert.equal((await route.DELETE(request('DELETE', { id: entryId }), context))!.status, 409);
      automatic = false;
    });
    await t.test('elimina entradas manuales acotadas al cliente', async () => {
      assert.equal((await route.DELETE(request('DELETE', { id: entryId }), context))!.status, 200);
    });
    await t.test('crea en el esquema antiguo tras el error exacto de commission_amount', async () => {
      legacySchema = true;
      const callsBefore = historyCalls;
      assert.equal((await route.POST(request('POST', payload), context))!.status, 200);
      assert.equal(historyCalls - callsBefore, 2);
      assert.equal(saved.amount_total, 700);
      assert.equal(saved.created_by_user_id, clientId);
    });
    await t.test('edita el histórico antiguo conservando el importe visible', async () => {
      assert.equal((await route.PATCH(request('PATCH', { ...payload, id: entryId, amountType: 'visible', amountTotal: 700 }), context))!.status, 200);
      assert.equal(saved.amount_total, 700);
    });
    await t.test('protege los cierres automáticos también sin generated_by', async () => {
      automatic = true;
      assert.equal((await route.PATCH(request('PATCH', { ...payload, id: entryId }), context))!.status, 409);
      assert.equal((await route.DELETE(request('DELETE', { id: entryId }), context))!.status, 409);
      automatic = false;
      assert.equal((await route.DELETE(request('DELETE', { id: entryId }), context))!.status, 200);
    });
  } finally { globalThis.fetch = originalFetch; }
});
