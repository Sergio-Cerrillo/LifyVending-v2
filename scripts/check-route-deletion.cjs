// Comprueba la API real sin realizar peticiones ni borrados en la base de datos.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleObject = { exports: {} };
const routeId = '12345678-1234-4234-8234-123456789012';
let role = 'admin';
let exists = true;
let databaseError = false;
const deletions = [];
const supabaseAdmin = { from(table) {
  if (table === 'profiles') return { select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'admin', role }, error: null }) }) }) };
  assert.equal(table, 'replenishment_routes', 'Solo se borra la ruta, nunca máquinas ni perfiles');
  return { delete() {
    const operation = { table };
    deletions.push(operation);
    return { eq(column, value) {
      assert.equal(column, 'id');
      operation.id = value;
      return { select(columns) {
        assert.equal(columns, 'id');
        return { maybeSingle: async () => ({ data: exists && !databaseError ? { id: value } : null, error: databaseError ? { message: 'database unavailable' } : null }) };
      } };
    } };
  } };
} };
const code = ts.transpileModule(fs.readFileSync('app/api/admin/routes/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(code, {
  module: moduleObject, exports: moduleObject.exports,
  console: { error() {} },
  require(id) {
    if (id === 'next/server') return { NextResponse: { json: (body, init) => Response.json(body, init) } };
    if (id === '@/lib/supabase-helpers') return { supabaseAdmin, supabase: { auth: { getUser: async () => ({ data: { user: { id: 'admin' } }, error: null }) } } };
    throw new Error(`Importación inesperada: ${id}`);
  },
});
const request = (body, authenticated = true) => new Request('http://localhost/api/admin/routes', {
  method: 'DELETE', headers: { ...(authenticated ? { Authorization: 'Bearer fixture' } : {}), 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
(async () => {
  const remove = moduleObject.exports.DELETE;
  assert.equal((await remove(request({ routeId }, false))).status, 401);
  for (const deniedRole of ['reponedor', 'client', 'operador']) {
    role = deniedRole;
    assert.equal((await remove(request({ routeId }))).status, 403);
  }
  role = 'admin';
  assert.equal(deletions.length, 0);
  for (const body of [{}, { routeId: '' }, { routeId: 'all' }, { routeId: [] }, 'invalid-json']) {
    assert.equal((await remove(request(body))).status, 400);
  }
  assert.equal(deletions.length, 0);
  const response = await remove(request({ routeId }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, routeId });
  assert.deepEqual(deletions, [{ table: 'replenishment_routes', id: routeId }]);
  exists = false;
  assert.equal((await remove(request({ routeId }))).status, 404);
  exists = true;
  databaseError = true;
  const failed = await remove(request({ routeId }));
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).success, undefined);
  console.log('PASS: eliminación exclusiva para admin, validación de ID, borrado de una sola ruta, 404 y fallo de base de datos.');
})().catch(error => { console.error(error); process.exitCode = 1; });
