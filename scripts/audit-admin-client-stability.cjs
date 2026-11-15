/*
 * Auditoría de diagnóstico. Ejecuta código original en VM con datos ficticios.
 * No carga .env, no inicia navegadores y no permite peticiones de red reales.
 * Los PASS confirman comportamientos actuales (incluidos fallos), no correcciones.
 * Ejecutar: node scripts/audit-admin-client-stability.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const root = path.resolve(__dirname, '..');
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const quiet = { log() {}, warn() {}, error() {}, debug() {} };
const jsx = (type, props) => ({ type, props });
const ui = new Proxy({}, { get: (_, name) => String(name) });
const noNetwork = () => { throw new Error('RED REAL PROHIBIDA EN ESTA AUDITORÍA'); };

function compile(source, filename, mocks = {}, globals = {}) {
  const module = { exports: {} };
  const context = vm.createContext({
    module, exports: module.exports, console: quiet,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Headers, Response, Request, URL, URLSearchParams, AbortController, DOMException,
    Error, Buffer, crypto: require('node:crypto').webcrypto,
    process: { env: {} }, fetch: noNetwork,
    require(id) {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
      if (id === 'next/server') return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } };
      if (id === 'lucide-react' || id.startsWith('@/components/ui/')) return ui;
      throw new Error(`Importación no simulada: ${id} en ${filename}`);
    },
    ...globals,
  });
  const code = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInContext(code, context, { filename, timeout: 2000 });
  return module.exports;
}
function load(file, mocks = {}, globals = {}) {
  return compile(fs.readFileSync(path.join(root, file), 'utf8'), file, mocks, globals);
}
// Extrae la función original mediante el AST; sus instrucciones no se reescriben.
function originalFunction(file, name, globals) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function walk(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = `const ${node.getText(ast)};`;
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.ok(found, `Función ${name} localizada`);
  return compile(`${found}\nmodule.exports = ${name};`, file, {}, globals);
}
function queryDb(resolve) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, ops: [] };
      let result;
      const chain = new Proxy({}, {
        get(_, key) {
          if (key === 'then') return (yes, no) => {
            if (!result) { calls.push(call); result = Promise.resolve().then(() => resolve(call)); }
            return result.then(yes, no);
          };
          return (...args) => { call.ops.push([key, ...args]); return chain; };
        },
      });
      return chain;
    },
  };
}
function hooks() {
  const values = [], effects = [];
  let index = 0;
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => ({}),
    useState(initial) {
      const at = index++;
      if (!(at in values)) values[at] = typeof initial === 'function' ? initial() : initial;
      return [values[at], (value) => { values[at] = typeof value === 'function' ? value(values[at]) : value; }];
    },
    useEffect(fn) { effects.push(fn); },
    useMemo: (fn) => fn(), useCallback: (fn) => fn,
    useRef: (value) => ({ current: value }),
  };
  return { values, effects, react, render(component) { index = 0; return component({ children: null }); } };
}
const fakeUser = { id: '00000000-0000-4000-8000-000000000001', email: 'audit@example.invalid', user_metadata: {} };
function tokenResponse() {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: fakeUser.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.audit`, refresh_token: 'synthetic-only', token_type: 'bearer', expires_in: 3600, user: fakeUser };
}
const request = (auth = true) => ({ headers: new Headers(auth ? { Authorization: 'Bearer synthetic-only' } : {}), nextUrl: new URL('https://audit.invalid/') });
const authMock = { getUser: async () => ({ data: { user: fakeUser }, error: null }) };
const timeoutFile = 'lib/client-timeouts.ts';

test('timeout: una operación rápida devuelve su resultado', async () => {
  const { withTimeout } = load(timeoutFile);
  assert.equal(await withTimeout(Promise.resolve(42), 50), 42);
});
test('timeout: withTimeout deja ejecutándose la operación original', async () => {
  const { withTimeout } = load(timeoutFile);
  let finished = false;
  const work = delay(30).then(() => { finished = true; });
  await assert.rejects(withTimeout(work, 5), { name: 'RequestTimeoutError' });
  assert.equal(finished, false);
  await work;
  assert.equal(finished, true);
});
test('fetch: una petición lenta sí se aborta al superar el límite', async () => {
  let aborted = false;
  const { fetchWithTimeout } = load(timeoutFile, {}, { fetch: (_, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('aborted', 'AbortError')); })) });
  await assert.rejects(fetchWithTimeout('/synthetic', {}, 5), { name: 'RequestTimeoutError' });
  assert.equal(aborted, true);
});
test('fetch: una cancelación externa se etiqueta erróneamente como timeout', async () => {
  const controller = new AbortController();
  const { fetchWithTimeout } = load(timeoutFile, {}, { fetch: (_, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('navigation', 'AbortError')))) });
  const pending = fetchWithTimeout('/synthetic', { signal: controller.signal }, 500);
  controller.abort();
  await assert.rejects(pending, { name: 'RequestTimeoutError' });
});
test('fetch: el límite termina en las cabeceras y no cubre la lectura del cuerpo', async () => {
  const body = deferred();
  let signal;
  const { fetchWithTimeout } = load(timeoutFile, {}, { fetch: async (_, init) => { signal = init.signal; return { json: () => body.promise }; } });
  const response = await fetchWithTimeout('/synthetic', {}, 5);
  await delay(20);
  assert.equal(signal.aborted, false);
  let parsed = false;
  const pending = response.json().then(() => { parsed = true; });
  await delay(10);
  assert.equal(parsed, false);
  body.resolve({ synthetic: true });
  await pending;
});
test('sesión: TOKEN_REFRESHED bloquea el perfil y getSession con el SDK instalado', async () => {
  let profiles = 0;
  const sdk = createClient('https://audit.invalid', 'synthetic-anon', {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false, storageKey: 'lify-offline-audit' },
    global: { fetch: async (input) => {
      const url = String(input);
      assert.equal(new URL(url).hostname, 'audit.invalid');
      if (url.includes('/auth/v1/token')) return Response.json(tokenResponse());
      if (url.includes('/rest/v1/profiles')) { profiles++; return Response.json({ role: 'admin', display_name: 'Synthetic' }); }
      throw new Error(`Petición SDK inesperada: ${new URL(url).pathname}`);
    } },
  });
  await sdk.auth.getSession();
  await sdk.auth.signInWithPassword({ email: fakeUser.email, password: 'synthetic-only' });
  // Escala temporal 1:100: 10 s -> 100 ms, 25 s -> 250 ms.
  const timeouts = load(timeoutFile, {}, { setTimeout: (fn, ms) => setTimeout(fn, ms / 100) });
  const h = hooks();
  const { AuthProvider } = load('contexts/auth-context.tsx', {
    react: h.react, 'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/lib/supabase-helpers': { supabase: sdk }, '@/lib/client-timeouts': timeouts,
  });
  h.render(AuthProvider);
  h.effects.forEach((fn) => fn());
  await delay(30);
  assert.equal(h.values[0]?.role, 'admin');
  const before = profiles;
  const refresh = sdk.auth.refreshSession();
  await delay(10);
  await assert.rejects(timeouts.withTimeout(sdk.auth.getSession(), 10_000), { name: 'RequestTimeoutError' });
  assert.equal(profiles, before, 'El perfil no alcanza ni siquiera el transporte simulado');
  await refresh;
  await delay(20);
  assert.ok(profiles > before, 'La consulta pendiente se ejecuta después del timeout del perfil');
  sdk.auth.stopAutoRefresh();
});
test('sesión: fallo temporal de perfil sin rol en metadatos deja acceso denegado', async () => {
  const h = hooks();
  const db = queryDb(() => ({ data: null, error: { message: 'synthetic temporary failure' } }));
  const { AuthProvider } = load('contexts/auth-context.tsx', {
    react: h.react, 'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/lib/supabase-helpers': { supabase: { ...db, auth: { getSession: async () => ({ data: { session: { user: fakeUser } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } },
    '@/lib/client-timeouts': load(timeoutFile),
  });
  h.render(AuthProvider);
  h.effects[0]();
  await delay(5);
  assert.equal(h.values[0], null);
  assert.equal(h.values[1], false);
});
test('login: un fallo transitorio al leer el perfil cierra una sesión válida', async () => {
  let signouts = 0;
  const db = queryDb(() => ({ data: null, error: { status: 503, message: 'synthetic unavailable' } }));
  const fn = originalFunction('app/login/page.tsx', 'handleLogin', {
    loading: false, accessGranted: false, email: fakeUser.email, password: 'synthetic-only',
    setLoading() {}, setErrorMessage() {}, toast: { error() {}, success() {} },
    supabase: { ...db, auth: { signInWithPassword: async () => ({ data: { user: fakeUser }, error: null }), signOut: async () => { signouts++; } } },
  });
  await fn({ preventDefault() {} });
  assert.equal(signouts, 1);
});

function routeMocks(role = 'client', resolver, refresh = async () => ({}), rpc = async () => ({ data: [], error: null })) {
  const db = queryDb(resolver || ((call) => ({ data: call.table === 'profiles' ? { role, display_name: 'Synthetic' } : [], error: null })));
  const supabase = { auth: authMock, rpc };
  return { db, mocks: {
    '@/lib/supabase-helpers': { supabase, supabaseAdmin: db },
    '@/lib/services/revenue-refresh-service': { ensureRevenueFreshness: refresh },
    '@/lib/frekuent': { formatDateForFrekuent: () => '2026-11-14T10:00:00+01:00', getFrekuentRevenueMachines: async () => [] },
    '@/lib/machine-id-utils': { generateFrekuentId: (name) => name, generateTelevendId: (name) => name },
  } };
}
for (const [name, file, role] of [
  ['cliente', 'app/api/client/dashboard/route.ts', 'client'],
  ['admin', 'app/api/admin/revenue/route.ts', 'admin'],
]) {
  test(`API ${name}: no responde hasta terminar ensureRevenueFreshness`, async () => {
    const gate = deferred();
    let called = false, done = false;
    const { db, mocks } = routeMocks(role, undefined, () => { called = true; return gate.promise; });
    const route = load(file, mocks);
    const pending = route.GET(request()).then((value) => { done = true; return value; });
    await delay(10);
    assert.equal(called, true);
    assert.equal(done, false);
    assert.equal(db.calls.length, 1, 'Los datos del dashboard aún no se consultan');
    gate.resolve({});
    assert.equal((await pending).status, 200);
  });
  test(`API ${name}: sin Authorization devuelve 401 sin refrescar`, async () => {
    let refreshes = 0;
    const { mocks } = routeMocks(role, undefined, async () => { refreshes++; });
    assert.equal((await load(file, mocks).GET(request(false))).status, 401);
    assert.equal(refreshes, 0);
  });
}
test('API cliente: errores en las tres RPC se convierten en 200 e importes cero', async () => {
  let rpcCalls = 0;
  const { mocks } = routeMocks('client', undefined, undefined, async () => { rpcCalls++; return { data: null, error: { message: 'synthetic RPC failure' } }; });
  const result = await load('app/api/client/dashboard/route.ts', mocks).GET(request());
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(rpcCalls, 3);
  assert.equal(result.body.revenue.monthly.total, 0);
});
test('SDK servidor: getUser(token) no transmite ese token a la RPC posterior', async () => {
  let rpcAuthorization;
  const sdk = createClient('https://audit.invalid', 'synthetic-anon', {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false, storageKey: 'lify-offline-rpc-audit' },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, 'audit.invalid');
      if (url.pathname === '/auth/v1/user') return Response.json(fakeUser);
      if (url.pathname.includes('/rpc/')) { rpcAuthorization = new Headers(init.headers).get('Authorization'); return Response.json([]); }
      throw new Error('Petición inesperada');
    } },
  });
  await sdk.auth.getUser(tokenResponse().access_token);
  await sdk.rpc('get_client_net_revenue', { p_client_id: fakeUser.id, p_period: 'daily' });
  assert.equal(rpcAuthorization, 'Bearer synthetic-anon');
  sdk.auth.stopAutoRefresh();
});
test('API cliente: una fecha inválida en una máquina causa 500', async () => {
  const { mocks } = routeMocks('client', (call) => ({
    data: call.table === 'profiles' ? { role: 'client' } : call.table === 'client_machine_assignments' ? [{ machines: { id: 'synthetic', name: 'Synthetic', daily_updated_at: 'invalid-date' } }] : [], error: null,
  }));
  assert.equal((await load('app/api/client/dashboard/route.ts', mocks).GET(request())).status, 500);
});
test('API usuarios: 100 clientes producen 202 consultas de BD más validar token', async () => {
  const users = Array.from({ length: 100 }, (_, index) => ({ id: `synthetic-${index}`, role: 'client' }));
  const { db, mocks } = routeMocks('admin', (call) => ({
    data: call.table === 'profiles' ? (call.ops.some(([op]) => op === 'in') ? users : { role: 'admin' }) : {}, count: 1, error: null,
  }));
  const result = await load('app/api/admin/users/route.ts', mocks).GET(request());
  assert.equal(result.status, 200);
  assert.equal(result.body.users.length, 100);
  assert.equal(db.calls.length, 202);
});
test('API dashboard antiguo: acepta solicitudes sin autenticación', async () => {
  const db = queryDb(() => ({ data: [], error: null }));
  const route = load('app/api/admin/dashboard/route.ts', { '@supabase/supabase-js': { createClient: () => db } });
  assert.equal((await route.GET(request(false))).status, 200);
});
test('servicio refresco: la ruta de datos antiguos ejecuta escrituras y seis cargas de proveedor', async () => {
  let frekuent = 0, televend = 0;
  const db = queryDb((call) => ({
    data: call.table === 'revenue_scrape_jobs' && call.ops.some(([op]) => op === 'insert') ? { id: 'synthetic-job' } : call.ops.some(([op]) => op === 'maybeSingle') ? null : [], error: null,
  }));
  const refresh = load('lib/services/revenue-refresh-service.ts', {
    '@/lib/supabase-helpers': { supabaseAdmin: db },
    '@/lib/frekuent': { formatDateForFrekuent: () => '2026-11-14T10:00:00+01:00', getMadridTodayRange: () => ({}), getFrekuentRevenueMachines: async () => { frekuent++; return []; } },
    '@/lib/televend': { getTelevendRevenueMachines: async () => { televend++; return []; } },
    '@/lib/machine-id-utils': { generateFrekuentId: (x) => x, generateTelevendId: (x) => x },
  });
  await refresh.ensureRevenueFreshness();
  assert.equal(frekuent, 3);
  assert.equal(televend, 3);
  assert.equal(db.calls.filter((call) => call.ops.some(([op]) => op === 'insert')).length, 2);
  assert.equal(db.calls.filter((call) => call.ops.some(([op]) => op === 'update')).length, 2);
});
test('cliente: respuesta 401 no renueva token ni reintenta automáticamente', async () => {
  let requests = 0, renewals = 0, error;
  const fn = originalFunction('app/client/dashboard/page.tsx', 'loadDashboard', {
    setLoading() {}, setError(value) { error = value; }, setData() {}, router: { push() {} },
    withTimeout: load(timeoutFile).withTimeout,
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic' } } }), refreshSession: () => { renewals++; } } },
    fetchWithTimeout: async () => { requests++; return { ok: false, status: 401, json: async () => ({ error: 'synthetic unauthorized' }) }; },
  });
  await fn();
  assert.equal(requests, 1);
  assert.equal(renewals, 0);
  assert.equal(error, 'synthetic unauthorized');
});
test('sesión: cuatro peticiones simultáneas solicitan cuatro renovaciones', async () => {
  let renewals = 0;
  const session = { access_token: 'synthetic', expires_at: Math.floor(Date.now() / 1000) + 120 };
  const { getFreshAccessToken } = load('lib/auth-session.ts', {
    '@/lib/client-timeouts': load(timeoutFile),
    '@/lib/supabase-helpers': { supabase: { auth: {
      getSession: async () => ({ data: { session }, error: null }),
      refreshSession: async () => { renewals++; await delay(5); return { data: { session }, error: null }; },
    } } },
  });
  await Promise.all(Array.from({ length: 4 }, () => getFreshAccessToken()));
  assert.equal(renewals, 4);
});
test('API comisiones antiguo: acepta solicitudes sin autenticación', async () => {
  const db = queryDb(() => ({ data: [], error: null }));
  const route = load('app/api/admin/commission-snapshots/route.ts', { '@supabase/supabase-js': { createClient: () => db } });
  assert.equal((await route.GET(request(false))).status, 200);
  assert.equal(db.calls[0].table, 'commission_snapshots');
});
test('API configuración: permite leer settings sin validar autenticación', async () => {
  const db = queryDb(() => ({ data: { id: 'synthetic-settings' }, error: null }));
  const service = load('lib/services/settings-service.ts', { '@/lib/supabase-helpers': { supabaseAdmin: db } });
  const route = load('app/api/admin/settings/route.ts', { '@/lib/services/settings-service': service });
  assert.equal((await route.GET()).status, 200);
  assert.equal(db.calls[0].table, 'app_settings');
});
test('API overview: un error al leer settings intenta crearlos durante un GET', async () => {
  const { db, mocks } = routeMocks('admin', (call) => {
    if (call.table === 'profiles') return { data: { role: 'admin', id: 'synthetic-client' }, error: null };
    if (call.table === 'client_settings') {
      return call.ops.some(([op]) => op === 'insert')
        ? { data: { commission_hide_percent: 0, commission_payment_percent: 0 }, error: null }
        : { data: null, error: { message: 'synthetic temporary read failure' } };
    }
    return { data: [], error: null };
  });
  mocks['@/lib/supabase-helpers'].supabaseAdmin.rpc = async () => ({ data: [], error: null });
  const route = load('app/api/admin/clients/[clientId]/overview/route.ts', mocks);
  assert.equal((await route.GET(request(), { params: Promise.resolve({ clientId: 'synthetic-client' }) })).status, 200);
  assert.equal(db.calls.filter((call) => call.table === 'client_settings' && call.ops.some(([op]) => op === 'insert')).length, 1);
});
test('refresco: un job antiguo con índice único puede impedir nuevas actualizaciones', async () => {
  const db = queryDb((call) => {
    if (call.table === 'revenue_scrape_jobs' && call.ops.some(([op]) => op === 'insert')) return { data: null, error: { code: '23505', message: 'synthetic unique conflict' } };
    return { data: call.ops.some(([op]) => op === 'maybeSingle') ? null : [], error: null };
  });
  const refresh = load('lib/services/revenue-refresh-service.ts', {
    '@/lib/supabase-helpers': { supabaseAdmin: db }, '@/lib/frekuent': {}, '@/lib/televend': {}, '@/lib/machine-id-utils': {},
  });
  for (let i = 0; i < 2; i++) {
    const result = await refresh.refreshTelevendRevenueIfStale();
    assert.equal(result.reason, 'already_running');
  }
  assert.equal(db.calls.filter((call) => call.ops.some(([op]) => op === 'update')).length, 0);
});
test('dashboard: últimas ventas pendientes impiden mostrar recaudación ya recibida', async () => {
  const sales = deferred();
  let stats;
  const fn = originalFunction('components/admin/dashboard-overview-page.tsx', 'loadData', {
    setError() {}, setRefreshing() {}, setLoading() {}, setStats(value) { stats = value; }, setLatestSales() {}, toast: { error() {}, success() {} },
    withTimeout: load(timeoutFile).withTimeout,
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic' } } }) } },
    fetchWithTimeout: async (url) => url.includes('latest-sales') ? sales.promise : ({ ok: true, json: async () => ({ machines: [], totals: {}, count: 0 }) }),
  });
  const pending = fn();
  await delay(10);
  assert.equal(stats, undefined);
  sales.resolve({ ok: true, json: async () => ({ sales: [] }) });
  await pending;
  assert.ok(stats);
});
test('stock conjunto: el fallo de un proveedor descarta la respuesta correcta del otro', async () => {
  let data, error;
  const fn = originalFunction('components/admin/stock-live-page.tsx', 'loadStock', {
    data: null, telemetryProvider: 'all', getFreshAccessToken: async () => 'synthetic',
    setError(value) { error = value; }, setLoading() {}, setRefreshing() {}, setData(value) { data = value; },
    getErrorMessage: (_, message) => message, toast: { error() {} },
    fetchWithTimeout: async (url) => ({ ok: url.includes('frekuent'), status: url.includes('frekuent') ? 200 : 502, json: async () => url.includes('frekuent') ? { stockMachines: [{ machineId: 1 }] } : { error: 'synthetic provider failure' } }),
  });
  assert.equal(await fn(), false);
  assert.equal(data, undefined);
  assert.equal(error, 'synthetic provider failure');
});
test('stock: una carga antigua puede sobrescribir la selección más reciente', async () => {
  const oldRequest = deferred();
  let displayed;
  const globals = {
    data: null, getFreshAccessToken: async () => 'synthetic', setError() {}, setLoading() {}, setRefreshing() {},
    setData(value) { displayed = value; }, getErrorMessage: () => 'synthetic', toast: { error() {} },
    fetchWithTimeout: async (url) => url.includes('frekuent') ? oldRequest.promise : ({ ok: true, json: async () => ({ stockMachines: [{ machineId: 2 }] }) }),
  };
  const older = originalFunction('components/admin/stock-live-page.tsx', 'loadStock', { ...globals, telemetryProvider: 'frekuent' })();
  await originalFunction('components/admin/stock-live-page.tsx', 'loadStock', { ...globals, telemetryProvider: 'televend' })();
  assert.equal(displayed.stockMachines[0].source, 'televend');
  oldRequest.resolve({ ok: true, json: async () => ({ stockMachines: [{ machineId: 1 }] }) });
  await older;
  assert.equal(displayed.stockMachines[0].source, 'frekuent');
});
test('render /admin: falla con ReferenceError de BarChart3', () => {
  const { DashboardPage } = load('components/admin/dashboard-page.tsx', {
    '@/contexts/data-context': { useData: () => ({ getDashboardStats: () => ({ monthlyRevenue: 0 }), collections: [], machines: [] }) }, recharts: ui,
  });
  assert.throws(() => DashboardPage(), /BarChart3 is not defined/);
});
test('render recaudaciones antiguo: falla con ReferenceError de DollarSign', () => {
  const h = hooks();
  const { CollectionsPage } = load('components/admin/collections-page.tsx', {
    react: h.react, '@/contexts/data-context': { useData: () => ({ collections: [], machines: [], updateCollection() {} }) },
    '@/contexts/auth-context': { useAuth: () => ({ hasRole: () => true }) },
    './create-collection-sheet': ui, './status-badge': ui,
    sonner: { toast: { error() {}, success() {} } }, 'date-fns': { format: () => '' }, 'date-fns/locale': { es: {} },
  });
  assert.throws(() => h.render(CollectionsPage), /DollarSign is not defined/);
});

function simulatedTelevend({ machineCount = 60, failMachine = null } = {}) {
  const counters = { login: 0, machines: 0, products: 0, columns: 0, aggregates: 0, vends: 0, peakColumns: 0 };
  let activeColumns = 0;
  const machines = Array.from({ length: machineCount }, (_, i) => ({ id: i + 1, caption: `Synthetic ${i + 1}` }));
  const api = load('lib/televend.ts', {}, {
    process: { env: { TELEVEND_USERNAME: 'synthetic-only', TELEVEND_PASSWORD: 'synthetic-only' } },
    fetch: async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/token')) { counters.login++; return Response.json({ access_token: tokenResponse().access_token, expires_in: 3600 }); }
      if (url.pathname.endsWith('/machines')) { counters.machines++; return Response.json({ content: machines, meta: { has_next_page: false } }); }
      if (url.pathname.endsWith('/products')) { counters.products++; return Response.json({ content: [] }); }
      if (url.pathname.endsWith('/columns')) {
        counters.columns++;
        activeColumns++;
        counters.peakColumns = Math.max(counters.peakColumns, activeColumns);
        await delay(4);
        activeColumns--;
        if (url.pathname.includes(`/machines/${failMachine}/`)) return Response.json({ message: 'synthetic failure' }, { status: 500 });
        return Response.json({ content: [] });
      }
      if (url.pathname.endsWith('/vends/aggregate') || url.pathname.endsWith('/vends/aggregation')) {
        counters.aggregates++; return Response.json({ content: { total_revenue: 1 } });
      }
      if (url.pathname.endsWith('/vends')) { counters.vends++; return Response.json({ content: [], meta: { has_next_page: false } }); }
      throw new Error(`Ruta no simulada: ${url.pathname}`);
    },
  });
  return { api, counters };
}
test('proveedor: tres consumidores de stock repiten 180 lecturas para 60 máquinas', async () => {
  const { api, counters } = simulatedTelevend();
  await Promise.all([api.getTelevendStockMachines(), api.getTelevendStockMachines(), api.getTelevendStockMachines()]);
  assert.equal(counters.login, 1);
  assert.equal(counters.columns, 180);
  assert.equal(counters.machines, 6);
  assert.equal(counters.products, 3);
  assert.equal(counters.peakColumns, 18);
});
test('proveedor: una máquina fallida hace fallar la carga completa de stock', async () => {
  const { api } = simulatedTelevend({ machineCount: 12, failMachine: 7 });
  await assert.rejects(api.getTelevendStockMachines(), { name: 'TelevendApiError' });
  // Los demás trabajadores que ya estaban en curso también pueden continuar.
  await delay(15);
});

(async () => {
  let failed = 0;
  console.log('Auditoría aislada: datos ficticios, sin .env ni conexiones reales.');
  console.log('PASS significa diagnóstico reproducido; no significa fallo corregido.');
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`PASS ${name}`); }
    catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); }
  }
  console.log(`Resultado: ${tests.length - failed}/${tests.length} comprobaciones reproducidas.`);
  process.exitCode = failed ? 1 : 0;
})();
