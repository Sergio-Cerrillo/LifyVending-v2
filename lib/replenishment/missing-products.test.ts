import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';
import { resolveLegacyTelevendMachineId } from './televend-machine-id';
import { missingProducts } from './missing-products';
import { generateFrekuentId } from '../machine-id-utils';

test('agrupa el mismo producto en varios raíles y conserva tamaños y variedades', () => {
  const result = missingProducts([
    { productName: 'AGUA 50 CL', line: 'A1', unitsToReplenish: 4 },
    { productName: 'agua 50 cl', line: 'A2', unitsToReplenish: 5 },
    { productName: 'AGUA 1 L', line: 'B1', unitsToReplenish: 2 },
    { productName: 'AGUA CON GAS', line: 'C1', unitsToReplenish: 0 },
    { productName: 'No válido', unitsToReplenish: NaN },
    { productName: 'No falta', unitsToReplenish: -2 },
  ]);
  assert.deepEqual(result, [
    { productName: 'AGUA 50 CL', units: 9, lines: ['A1', 'A2'] },
    { productName: 'AGUA 1 L', units: 2, lines: ['B1'] },
  ]);
  assert.deepEqual(missingProducts([]), []);
});

test('faltantes: acceso por ruta, consulta solo de lectura y aislamiento de proveedores', async () => {
  let role = 'reponedor';
  let owner = 'user-id';
  let provider = 'televend';
  let missingId = false;
  let noDetails = false;
  let legacyTelevend = false;
  const stockCalls: Array<{ provider: string; ids: number[] }> = [];
  const stock = (source: string, ids: number[]) => {
    assert.equal(ids.length, 1);
    assert.ok(ids[0] > 0);
    stockCalls.push({ provider: source, ids: [...ids] });
    return [{ machineId: ids[0], products: noDetails ? [] : [
      { productName: 'Agua', line: '1', unitsToReplenish: 5 },
      { productName: 'Agua', line: '2', unitsToReplenish: 3 },
    ] }];
  };
  const module = { exports: {} as any };
  const code = ts.transpileModule(readFileSync('app/api/admin/routes/stock/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mocks: Record<string, unknown> = {
    '@/lib/supabase-helpers': {
      supabase: { auth: { getUser: async () => ({ data: { user: { id: 'user-id' } }, error: null }) } },
      supabaseAdmin: { from: (table: string) => ({ select: () => ({ eq: () => ({ single: async () => {
        if (table === 'profiles') return { data: { role }, error: null };
        if (table === 'replenishment_routes') return { data: { replenisher_id: owner }, error: null };
        assert.equal(table, 'replenishment_route_machines');
        return { error: null, data: { route_id: 'route-id', machine: {
          name: legacyTelevend ? 'Adelte Facturaciones Palma : Cafetera Adelte Facturaciones Palma 5133' : missingId ? 'Unknown' : 'Máquina prueba', location: 'Oficina',
          televend_machine_id: provider === 'televend' ? legacyTelevend ? 'televend_adelte_facturaciones_palma_cafetera_adelte_facturaciones_palma_5133' : '87' : null,
          frekuent_machine_id: 'id-por-nombre', orain_machine_id: null,
        } } };
      } }) }) }) },
    },
    '@/lib/frekuent': {
      getFrekuentMachines: async () => [{ label: 'Máquina prueba', value: 45 }],
      getFrekuentStockMachines: async (ids: number[]) => stock('frekuent', ids),
    },
    '@/lib/televend': { getTelevendMachineOptions: async () => [{ value: 203591, label: 'Cafetera Adelte Facturaciones Palma 5133' }], getTelevendStockMachines: async (ids: number[]) => stock('televend', ids) },
    '@/lib/machine-id-utils': { generateFrekuentId },
    '@/lib/replenishment/televend-machine-id': { resolveLegacyTelevendMachineId },
    '@/lib/replenishment/missing-products': { missingProducts },
  };
  vm.runInNewContext(code, {
    module, exports: module.exports, console,
    require(id: string) {
      if (id === 'next/server') return { NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) } };
      if (id in mocks) return mocks[id];
      throw new Error(`Importación no simulada: ${id}`);
    },
  });
  const request = (authorized = true, id = '12345678-1234-4234-8234-123456789012') => ({
    headers: new Headers(authorized ? { Authorization: 'Bearer fixture' } : {}),
    nextUrl: new URL(`http://localhost/api/admin/routes/stock?routeMachineId=${id}`),
  });
  const get = module.exports.GET;
  assert.equal((await get(request(false))).status, 401);
  role = 'client';
  assert.equal((await get(request())).status, 403);
  role = 'reponedor';
  owner = 'another-user';
  assert.equal((await get(request())).status, 403);
  assert.equal(stockCalls.length, 0);
  owner = 'user-id';
  assert.equal((await get(request(true, 'invalid'))).status, 400);
  const response = await get(request());
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.totalUnits, 8);
  assert.equal(data.products.length, 1);
  assert.deepEqual(stockCalls[0], { provider: 'televend', ids: [87] });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  provider = 'frekuent';
  assert.equal((await get(request())).status, 200);
  assert.deepEqual(stockCalls[1], { provider: 'frekuent', ids: [45] });
  missingId = true;
  assert.equal((await get(request())).status, 422);
  assert.equal(stockCalls.length, 2);
  missingId = false;
  role = 'admin'; owner = 'another-user';
  assert.equal((await get(request())).status, 200);
  legacyTelevend = true; provider = 'televend';
  assert.equal((await get(request())).status, 200);
  assert.deepEqual(stockCalls.at(-1), { provider: 'televend', ids: [203591] });
  noDetails = true;
  assert.equal((await get(request())).status, 502);
});

test('resuelve la cafetera 5133 antigua sin confundir el número comercial con el ID del proveedor', () => {
  const machine = {
    name: 'Adelte Facturaciones Palma : Cafetera Adelte Facturaciones Palma 5133',
    televend_machine_id: 'televend_adelte_facturaciones_palma_cafetera_adelte_facturaciones_palma_5133',
  };
  const options = [{ value: 203591, label: 'Cafetera Adelte Facturaciones Palma 5133' }];
  assert.equal(resolveLegacyTelevendMachineId(machine, options), 203591);
  assert.equal(resolveLegacyTelevendMachineId(machine, [...options, { ...options[0], value: 999 }]), null);
  assert.equal(resolveLegacyTelevendMachineId(machine, [{ value: 5133, label: 'Otra cafetera 5133' }]), null);
  assert.equal(resolveLegacyTelevendMachineId(machine, []), null);
});
