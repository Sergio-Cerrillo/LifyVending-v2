import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HistoricalRevenueCard, HistoricalRevenueMonthSummary } from '../../components/revenue/historical-revenue-card';

test('la tarjeta visible muestra recaudación y comisión sin información interna', () => {
  const html = renderToStaticMarkup(createElement(HistoricalRevenueCard, {
    machineName: 'Máquina de prueba', machineLocation: 'Oficina', amountTotal: 700, commissionAmount: 105,
  }));
  assert.match(html, /Recaudación/);
  assert.match(html, /700,00/);
  assert.match(html, /Comisión/);
  assert.match(html, /105,00/);
  assert.doesNotMatch(html, /oculto|bruto|manual|automático/i);
  const summary = renderToStaticMarkup(createElement(HistoricalRevenueMonthSummary, {
    label: 'octubre de 2026', amountTotal: 1400, commissionAmount: 210,
  }));
  assert.match(summary, /1\.?400,00/);
  assert.match(summary, /210,00/);
});

test('el formulario previsualiza recaudación y comisión con la tarjeta compartida y guarda la recaudación', async () => {
  const states: any[] = [];
  const effects: Array<() => void> = [];
  let cursor = 0;
  const calls: Array<{ method?: string; body?: string }> = [];
  const machineId = '12345678-1234-4234-8234-123456789013';
  const data = {
    client: { commission_hide_percent: 30, commission_payment_percent: 15 },
    machineOptions: [{ id: machineId, name: 'Máquina de prueba', location: 'Oficina' }],
    entries: ['system', 'manual'].map((generated_by, index) => ({
      id: String(index), machine_id: machineId, year: 2020, month: 1, amount_total: 700,
      generated_by, machines: { name: 'Máquina de prueba', location: 'Oficina' }, notes: null,
    })),
  };
  const module = { exports: {} as any };
  const ui = new Proxy({}, { get: (_target, name) => String(name) });
  const mocks: Record<string, unknown> = {
    react: {
      useState(initial: unknown) {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value: unknown) => { states[index] = value; }];
      },
      useCallback: (fn: unknown) => fn,
      useEffect: (fn: () => void) => effects.push(fn),
    },
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    '@/lib/supabase-helpers': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'fake' } } }) } } },
    '@/lib/client-timeouts': {
      withTimeout: (promise: Promise<unknown>) => promise,
      fetchWithTimeout: async (_url: string, init: { method?: string; body?: string }) => {
        calls.push(init);
        return { ok: true, json: async () => init.method === 'GET' ? data : { success: true } };
      },
    },
    sonner: { toast: { success() {} } },
    '@/components/revenue/historical-revenue-card': { HistoricalRevenueCard, HistoricalRevenueMonthSummary },
  };
  const source = readFileSync('components/admin/client-revenue-history.tsx', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console,
    require(id: string) {
      if (id in mocks) return mocks[id];
      if (id.startsWith('@/components/ui/')) return ui;
      throw new Error(`Importación inesperada: ${id}`);
    },
  });
  const render = () => { cursor = 0; return module.exports.ClientRevenueHistory({ clientId: 'test-client' }); };
  const nodes = (tree: any): any[] => {
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    return [tree, ...nodes(tree.props?.children)];
  };
  render();
  effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  let tree = render();
  for (const [id, value] of [['history-machine', machineId], ['history-period', '2020-01'], ['history-amount', '1000']]) {
    nodes(tree).find(node => node.props?.id === id).props.onChange({ target: { value } });
    tree = render();
  }
  const cards = nodes(tree).filter(node => node.type === HistoricalRevenueCard);
  // Vista previa, cierre automático y entrada manual comparten exactamente la tarjeta y los importes.
  assert.equal(cards.length, 3);
  for (const card of cards) {
    assert.equal(card.props.amountTotal, 700);
    assert.equal(card.props.commissionAmount, 105);
  }
  await nodes(tree).find(node => node.props?.id === 'history-form').props.onSubmit({ preventDefault() {} });
  const saved = JSON.parse(calls.find(call => call.method === 'POST')!.body!);
  assert.equal(saved.amountTotal, 1000);
  assert.equal(saved.amountType, 'gross');
  assert.equal(saved.machineId, machineId);
  assert.ok(!('commissionAmount' in saved));
});
