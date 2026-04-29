#!/usr/bin/env node

import dotenv from 'dotenv';
import { OrainScraper, tryApiScraping } from './orain-scraper';
import { aggregateStock, getStockStats, aggregateByCategory } from './aggregate';
import { exportToJSON, exportMachineStockToCSV, exportSummaryToCSV, generateLoadList } from './export';
import * as path from 'path';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  const startTime = Date.now();

  // Leer variables de entorno
  const user = process.env.ORAIN_USER;
  const pass = process.env.ORAIN_PASS;
  const headless = process.env.HEADLESS !== 'false';

  if (!user || !pass) {
    console.error('❌ Error: Debes configurar ORAIN_USER y ORAIN_PASS en las variables de entorno');
    process.exit(1);
  }

  console.log('🚀 Iniciando scraping de stock de Frekuent/Orain\n');
  console.log(`👤 Usuario: ${user}`);
  console.log(`🖥️  Modo: ${headless ? 'Headless' : 'Con interfaz'}\n`);

  try {
    // Intentar scraping mediante API primero
    let machineStocks = await tryApiScraping(user, pass);

    // Si API scraping no está disponible, usar UI scraping
    if (!machineStocks) {
      const scraper = new OrainScraper({ user, pass, headless });
      
      machineStocks = await scraper.scrapeAllMachines((current, total, machineName) => {
        console.log(`📦 [${current}/${total}] Procesando: ${machineName}`);
      });
    }

    if (machineStocks.length === 0) {
      console.log('⚠️  No se encontraron máquinas con stock');
      return;
    }

    // Calcular estadísticas
    const stats = getStockStats(machineStocks);
    console.log('\n📊 Estadísticas:');
    console.log(`   • Máquinas: ${stats.machineCount}`);
    console.log(`   • Productos únicos: ${stats.totalProducts}`);
    console.log(`   • Capacidad total: ${stats.totalCapacity} unidades`);
    console.log(`   • Disponibles: ${stats.totalAvailable} unidades`);
    console.log(`   • A reponer: ${stats.totalUnitsToReplenish} unidades`);
    console.log(`   • Tasa de llenado: ${stats.fillRate}%`);

    // Generar agregados
    const summary = aggregateStock(machineStocks);
    const byCategory = aggregateByCategory(summary);

    // Exportar datos
    const outputDir = path.join(process.cwd(), 'scraper', 'output');
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];

    exportToJSON(machineStocks, path.join(outputDir, `stock-machines-${timestamp}.json`));
    exportToJSON(summary, path.join(outputDir, `stock-summary-${timestamp}.json`));
    exportMachineStockToCSV(machineStocks, path.join(outputDir, `stock-machines-${timestamp}.csv`));
    exportSummaryToCSV(summary, path.join(outputDir, `stock-summary-${timestamp}.csv`));
    generateLoadList(summary, path.join(outputDir, `lista-carga-${timestamp}.txt`));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Proceso completado en ${duration}s`);
    console.log(`📁 Archivos exportados en: ${outputDir}`);

  } catch (error) {
    console.error('\n❌ Error durante el scraping:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

export { main as runScraper };
