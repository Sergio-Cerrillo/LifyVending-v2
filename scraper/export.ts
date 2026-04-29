import type { MachineStock, StockSummary } from '@/lib/types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Exporta datos de stock a JSON
 */
export function exportToJSON(data: MachineStock[] | StockSummary[], outputPath: string) {
  const jsonData = JSON.stringify(data, null, 2);
  fs.writeFileSync(outputPath, jsonData, 'utf-8');
  console.log(`✅ JSON exportado a: ${outputPath}`);
}

/**
 * Exporta datos de stock a CSV
 */
export function exportMachineStockToCSV(machineStocks: MachineStock[], outputPath: string) {
  const headers = [
    'Máquina',
    'ID Máquina',
    'Línea',
    'Producto',
    'Categoría',
    'Capacidad Total',
    'Unidades Disponibles',
    'Unidades a Reponer',
  ];

  const rows = machineStocks.flatMap((stock) =>
    stock.products.map((product) => [
      stock.machineName,
      stock.machineId,
      product.line || '',
      product.name,
      product.category || '',
      product.totalCapacity,
      product.availableUnits,
      product.unitsToReplenish,
    ])
  );

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  fs.writeFileSync(outputPath, csv, 'utf-8');
  console.log(`✅ CSV exportado a: ${outputPath}`);
}

/**
 * Exporta resumen agregado a CSV
 */
export function exportSummaryToCSV(summaries: StockSummary[], outputPath: string) {
  const headers = [
    'Producto',
    'Categoría',
    'Total Unidades a Reponer',
    'Número de Máquinas',
  ];

  const rows = summaries.map((summary) => [
    summary.productName,
    summary.category || '',
    summary.totalUnitsToReplenish,
    summary.machineCount,
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  fs.writeFileSync(outputPath, csv, 'utf-8');
  console.log(`✅ CSV de resumen exportado a: ${outputPath}`);
}

/**
 * Genera una lista de carga imprimible en texto plano
 */
export function generateLoadList(summaries: StockSummary[], outputPath: string) {
  const lines = [
    '╔═══════════════════════════════════════════════════════╗',
    '║         LISTA DE CARGA - FURGONETA REPARTO          ║',
    '╚═══════════════════════════════════════════════════════╝',
    '',
    `Fecha: ${new Date().toLocaleDateString('es-ES')}`,
    `Hora: ${new Date().toLocaleTimeString('es-ES')}`,
    '',
    '─────────────────────────────────────────────────────────',
    '',
  ];

  let currentCategory = '';
  
  summaries.forEach((item) => {
    const category = item.category || 'Sin categoría';
    
    if (category !== currentCategory) {
      currentCategory = category;
      lines.push('');
      lines.push(`▶ ${category.toUpperCase()}`);
      lines.push('─────────────────────────────────────────────────────────');
    }
    
    const units = item.totalUnitsToReplenish.toString().padStart(4);
    const product = item.productName.padEnd(40);
    
    lines.push(`  [ ] ${units}x  ${product}`);
  });

  lines.push('');
  lines.push('─────────────────────────────────────────────────────────');
  lines.push('');
  lines.push(`TOTAL PRODUCTOS: ${summaries.length}`);
  lines.push(`TOTAL UNIDADES: ${summaries.reduce((sum, s) => sum + s.totalUnitsToReplenish, 0)}`);
  lines.push('');

  const content = lines.join('\n');
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`✅ Lista de carga generada: ${outputPath}`);
}

/**
 * Genera CSV descargable desde el navegador (retorna string)
 */
export function generateBrowserCSV(summaries: StockSummary[]): string {
  const headers = ['Producto', 'Categoría', 'Total a Reponer', 'Nº Máquinas'];
  
  const rows = summaries.map((summary) => [
    summary.productName,
    summary.category || '',
    summary.totalUnitsToReplenish,
    summary.machineCount,
  ]);

  return [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');
}
