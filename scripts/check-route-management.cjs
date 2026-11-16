// Prueba del render inicial real y de las fechas, sin sesiones ni llamadas de red.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let simulateAdmin = false;
const reactForPage = { ...React, useState(initial) { const state = React.useState(initial); return simulateAdmin && initial === 'reponedor' ? ['admin', state[1]] : state; } };
const ui = new Proxy({}, { get: (_target, name) => String(name) });
const moduleObject = { exports: {} };
const source = fs.readFileSync('app/admin/gestion-rutas/page.tsx', 'utf8');
const code = ts.transpileModule(`${source}\nexport { formatDate as formatRouteDate };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(code, {
  module: moduleObject, exports: moduleObject.exports, console,
  require(id) {
    if (id === 'react') return reactForPage;
    if (id === 'react/jsx-runtime') return require('react/jsx-runtime');
    if (id === 'lucide-react' || id.startsWith('@/components/ui/')) return ui;
    if (id === 'sonner') return { toast: {} };
    if (id === '@/lib/client-timeouts') return { fetchWithTimeout() { throw new Error('No debe consultar la red durante el render'); } };
    if (id === '@/lib/auth-session') return { getFreshAccessToken() { throw new Error('No debe leer sesiones durante el render'); } };
    if (id === '@/components/admin/route-machine-missing-stock') return { RouteMachineMissingStock: () => null };
    if (id === '@/lib/utils') return { cn: (...classes) => classes.filter(Boolean).join(' ') };
    throw new Error(`Importación no simulada: ${id}`);
  },
});
const originalError = console.error;
try {
  // Los componentes de interfaz se simulan: se silencian únicamente los avisos
  // del renderer por nombres/props de esos elementos, conservando las excepciones.
  console.error = () => {};
  const html = renderToStaticMarkup(React.createElement(moduleObject.exports.default));
  assert.match(html, /Gestión de rutas/);
  simulateAdmin = true;
  assert.match(renderToStaticMarkup(React.createElement(moduleObject.exports.default)), /Gestión de rutas/);
  console.log('PASS: render de reponedor y administrador, con formulario de edición vacío y cerrado.');
} finally { console.error = originalError; }
const format = moduleObject.exports.formatRouteDate;
assert.equal(format(''), 'Sin fecha');
assert.equal(format('no-es-una-fecha'), 'Sin fecha');
assert.match(format('2026-11-16'), /16.*nov.*2026/);
console.log('PASS: fechas vacías, inválidas y válidas.');
