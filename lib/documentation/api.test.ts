import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { previousMadridMonthRange } from './calculations';
import { documentationPriceSchema } from './pricing';

function loadRoute(file: string, mocks: Record<string, unknown>) {
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, console, Date, URL,
    require(id: string) {
      if (id === 'next/server') return { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } };
      if (id in mocks) return mocks[id];
      throw new Error(`Importación inesperada: ${id}`);
    },
  });
  return module.exports;
}

test('API de precios: guarda y recupera precios y fijo por botella con protección admin', async () => {
  const records = new Map<string, any>();
  let allowed = true;
  const route = loadRoute('app/api/admin/documentation/prices/route.ts', {
    '@/lib/documentation/admin-auth': { requireDocumentationAdmin: async () => allowed ? { user: { id: 'admin-id' } } : { error: Response.json({}, { status: 403 }) } },
    '@/lib/documentation/pricing': { documentationPriceSchema },
    '@/lib/supabase-helpers': { supabaseAdmin: { from: (table: string) => {
      assert.equal(table, 'documentation_product_prices');
      return { select: async () => ({ data: [...records.values()], error: null }), upsert: async (row: any, options: any) => {
        assert.equal(options.onConflict, 'product_key'); records.set(row.product_key, row); return { error: null };
      } };
    } } },
  });
  const price = { productKey: 'agua', priceWithVat: 3.5, saleWithoutVat: 2.89, purchaseWithoutVat: 0.3, fixedPerBottle: 0.5 };
  const request = () => new Request('http://localhost/prices', { method: 'PATCH', body: JSON.stringify(price) });
  allowed = false;
  assert.equal((await route.PATCH(request())).status, 403);
  assert.equal(records.size, 0);
  allowed = true;
  assert.equal((await route.PATCH(request())).status, 200);
  const result = await (await route.GET(new Request('http://localhost/prices'))).json();
  assert.equal(result.catalog.agua.priceWithVat, 3.5);
  assert.equal(result.catalog.agua.fixedPerBottle, 0.5);
  assert.equal(records.get('agua').updated_by, 'admin-id');
  price.priceWithVat = 4;
  await route.PATCH(request());
  assert.equal(records.size, 1);
  assert.equal((await (await route.GET(new Request('http://localhost/prices'))).json()).catalog.agua.priceWithVat, 4);
  const invalid = new Request('http://localhost/prices', { method: 'PATCH', body: JSON.stringify({ ...price, priceWithVat: -10 }) });
  assert.equal((await route.PATCH(invalid)).status, 400);
});

test('mes anterior: consulta ambos proveedores, conserva bruto y no sustituye ausencias por cero', async () => {
  let failFrekuent = false;
  let calls = 0;
  const route = loadRoute('app/api/admin/documentation/revenue/route.ts', {
    '@/lib/documentation/admin-auth': { requireDocumentationAdmin: async () => ({ user: { id: 'admin-id' } }) },
    '@/lib/documentation/calculations': { previousMadridMonthRange: () => previousMadridMonthRange(new Date('2026-11-15T12:00:00Z')) },
    '@/lib/machine-id-utils': { generateFrekuentId: (name: string) => name.toLowerCase() },
    '@/lib/supabase-helpers': { supabaseAdmin: { from: () => ({ select: () => ({ or: async () => ({ error: null, data: [
      { id: 'tv', name: 'TV', televend_machine_id: '2' },
      { id: 'fk', name: 'FK', frekuent_machine_id: 'fk', orain_machine_id: '3' },
      { id: 'missing', name: 'Missing', televend_machine_id: '99' },
    ] }) }) }) } },
    '@/lib/frekuent': { getFrekuentRevenueMachines: async (range: any) => {
      calls++;
      assert.equal(range.startDate, '2026-10-01T00:00:00+02:00');
      assert.equal(range.datesLogic, 'custom');
      if (failFrekuent) throw new Error('provider unavailable');
      return [{ machineId: 3, machineName: 'FK', totalMoney: 1000, totalCard: 700, totalCash: 300 }];
    } },
    '@/lib/televend': { getTelevendRevenueMachines: async (range: any) => {
      calls++;
      assert.equal(range.fromTimestamp, '2026-09-30T22:00:00.000Z');
      assert.equal(range.toTimestamp, '2026-10-31T22:59:59.999Z');
      return [{ machineId: 2, totalRevenue: 2000, totalCard: 1500, totalCash: 500 }];
    } },
  });
  const response = await route.GET(new Request('http://localhost/revenue'));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(calls, 2);
  assert.equal(payload.machines[0].previous_month.total, 2000);
  assert.equal(payload.machines[1].previous_month.total, 1000);
  assert.equal(payload.machines[2].previous_month, null);
  failFrekuent = true;
  const partial = await (await route.GET(new Request('http://localhost/revenue'))).json();
  assert.equal(partial.warnings.length, 1);
  assert.equal(partial.machines[1].previous_month, null);
  assert.equal(partial.machines[0].previous_month.total, 2000);
});
