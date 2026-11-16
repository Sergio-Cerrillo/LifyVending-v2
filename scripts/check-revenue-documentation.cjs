/* Renderiza la página real con proveedores y autenticación ficticios, sin datos reales.
 * node scripts/check-revenue-documentation.cjs [--serve]
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = '/tmp/newlify-documentation-preview';
const catalog = {};
let failedSaves = false;
const machine = { id: 'fixture-tv', name: 'Máquina de prueba Televend', source: 'televend', location: 'Oficina', daily: { total: 100 }, monthly: { total: 1000 } };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await esbuild.build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Page from './app/admin/documentacion-recaudaciones/page'; createRoot(document.getElementById('root')).render(<Page/>);`, loader: 'tsx', resolveDir: root },
    loader: { '.png': 'dataurl' }, bundle: true, outfile: path.join(out, 'app.js'), jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'isolated-fixtures', setup(build) {
      build.onResolve({ filter: /supabase-helpers|^next\/image$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'next/image'
        ? `import React from 'react'; export default function Image(props){return React.createElement('img', props)}`
        : `export const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: 'fixture-token' } } }) } };`, resolveDir: root }));
    } }],
  });
  const css = await postcss([tailwind()]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') });
  fs.writeFileSync(path.join(out, 'app.css'), css.css);
  const server = http.createServer(async (req, res) => {
    const json = (body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.url === '/api/admin/revenue') return json({ machines: [machine], lastUpdate: null });
    if (req.url === '/api/admin/documentation/revenue') return json({ machines: [{ ...machine, previous_month: { total: 2000, updatedAt: null } }], range: { startDate: '2026-10-01', endDate: '2026-10-31' }, warnings: [] });
    if (req.url === '/api/admin/documentation/prices') {
      if (req.method === 'GET') return json({ catalog });
      let raw = ''; for await (const chunk of req) raw += chunk;
      if (failedSaves) return json({ error: 'Fallo de guardado simulado' }, 503);
      const { productKey, ...prices } = JSON.parse(raw);
      catalog[productKey] = prices;
      return json({ success: true });
    }
    if (req.url === '/logo.png') { res.setHeader('Content-Type', 'image/png'); return res.end(fs.readFileSync(path.join(root, 'public/logo.png'))); }
    if (req.url === '/app.js' || req.url === '/app.css') { res.setHeader('Content-Type', req.url.endsWith('css') ? 'text/css' : 'text/javascript'); return res.end(fs.readFileSync(path.join(out, req.url.slice(1)))); }
    res.setHeader('Content-Type', 'text/html');
    res.end('<html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body class="font-sans" style="font-family:system-ui,sans-serif;margin:0;padding:16px;background:#f4f4f5"><main style="max-width:1440px;margin:auto"><div id="root"></div></main><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(3219, '127.0.0.1', resolve));
  console.log('Preview: http://127.0.0.1:3219 (datos ficticios)');
  if (process.argv.includes('--serve')) return;
  let browser;
  let activePage;
  try {
    browser = await chromium.launch({ headless: true });
    const page = activePage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => { throw error; });
    await page.goto('http://127.0.0.1:3219');
    await page.getByRole('button', { name: 'Seleccionar Máquina de prueba Televend' }).click();
    await page.locator('#hide-fixture-tv').fill('30');
    await page.locator('#pay-fixture-tv').fill('15');
    await page.getByText('105,00', { exact: false }).first().waitFor();
    await page.locator('[data-slot="toggle-group-item"]').filter({ hasText: 'Mes anterior' }).click();
    await page.getByText('210,00', { exact: false }).first().waitFor();
    await page.screenshot({ path: path.join(out, 'simple-desktop.png'), fullPage: true });
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, `Simple sin desbordamiento a ${width}px`);
    }
    await page.locator('[data-slot="toggle-group-item"]').filter({ hasText: 'Personalizar documento' }).click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'Documento personalizado sin desbordamiento');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('tab', { name: 'Recaudación completa' }).click();
    const csv = page.locator('textarea').last();
    await csv.fill('Productos,Ventas\nAGUA,100\nMONSTER,50');
    await page.getByRole('button', { name: 'Importar CSV', exact: true }).click();
    await page.getByRole('switch', { name: 'Comisión fija por botella' }).first().click();
    await page.getByRole('button', { name: 'Editar casillas en el cuadro' }).click();
    await page.getByLabel('Precio de venta AGUA', { exact: true }).fill('3.5');
    await page.getByLabel('Pruebas AGUA', { exact: true }).fill('10');
    await page.getByLabel('Unidades AGUA ·', { exact: false }).fill('120');
    await page.getByText('Precios guardados en la plataforma', { exact: true }).waitFor();
    await page.waitForFunction(() => !document.body.innerText.includes('Cambios pendientes de guardar'));
    assert.equal(catalog.agua.priceWithVat, 3.5);
    assert.equal(catalog.agua.fixedPerBottle, 0.5);
    const waterRow = page.locator('#complete-document tbody tr').filter({ hasText: 'AGUA' });
    assert.match(await waterRow.innerText(), /55,00/);
    await page.screenshot({ path: path.join(out, 'complete-desktop.png'), fullPage: true });
    // Un cambio de pestaña mantiene los CSV y la configuración de la fila.
    await page.getByRole('tab', { name: 'Recaudación simple' }).click();
    await page.getByRole('tab', { name: 'Recaudación completa' }).click();
    assert.equal(await page.locator('#complete-document tbody tr').count(), 2);
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert.equal(overflow, false, `Sin desbordamiento de página a ${width}px`);
      await page.screenshot({ path: path.join(out, `complete-${width}.png`), fullPage: true });
    }
    failedSaves = true;
    await page.getByLabel('Precio de venta AGUA', { exact: true }).fill('4');
    await page.getByText('Fallo de guardado simulado').waitFor();
    failedSaves = false;
    await page.getByRole('button', { name: 'Guardar precios', exact: true }).click();
    await page.getByText('Precios guardados en la plataforma', { exact: true }).waitFor();
    assert.equal(catalog.agua.priceWithVat, 4);
    await page.reload();
    await page.getByRole('tab', { name: 'Recaudación completa' }).click();
    await page.locator('textarea').last().fill('Productos,Ventas\nAGUA,100');
    await page.getByRole('button', { name: 'Importar CSV', exact: true }).click();
    assert.equal(await page.getByRole('switch', { name: 'Comisión fija por botella' }).isChecked(), true);
    await page.getByRole('button', { name: 'Editar casillas en el cuadro' }).click();
    assert.equal(await page.getByLabel('Precio de venta AGUA', { exact: true }).inputValue(), '4');
    await page.emulateMedia({ media: 'print' });
    const printedInputs = await page.locator('#complete-document input:visible').count();
    assert.equal(printedInputs, 0, 'Los controles de edición no se imprimen');
    console.log('PASS: mes anterior, porcentajes por máquina, fijo por botella, edición en tabla, guardado/reintento/recarga, pestañas y maquetación 390/768/1280px.');
  } catch (error) { if (activePage) { await activePage.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }); console.error((await activePage.locator('body').innerText()).slice(-4000)); } throw error; } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
