/**
 * SCRIPT DE DIAGNÓSTICO: Test Televend Scraper
 * 
 * Este script prueba el scraper de Televend de forma aislada
 * para detectar dónde está fallando.
 */

// Cargar variables de entorno
import { config } from 'dotenv';
import { resolve } from 'path';

// Cargar .env.local
config({ path: resolve(__dirname, '.env.local') });

import { TelevendScraper } from './scraper/televend-scraper';

async function testTelevendScraper() {
  console.log('🔍 INICIANDO TEST DE TELEVEND SCRAPER\n');
  
  const username = process.env.TELEVEND_USERNAME || '';
  const password = process.env.TELEVEND_PASSWORD || '';
  
  console.log('🔑 Credenciales:');
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${'*'.repeat(password.length)} (${password.length} caracteres)\n`);
  
  if (!username || !password) {
    console.error('❌ ERROR: TELEVEND_USERNAME o TELEVEND_PASSWORD no configuradas');
    return;
  }
  
  const scraper = new TelevendScraper({
    username,
    password,
    headless: false // NO headless para ver qué pasa
  });

  try {
    console.log('1️⃣ Inicializando navegador...');
    await scraper.initialize();
    console.log('✅ Navegador inicializado\n');

    console.log('2️⃣ Intentando login...');
    await scraper.login();
    console.log('✅ Login completado\n');

    console.log('3️⃣ Navegando a página de máquinas...');
    await scraper['navigateToMachines']();
    console.log('✅ En página de máquinas\n');

    console.log('4️⃣ Configurando vista de 100 máquinas...');
    await scraper['setShow100Machines']();
    console.log('✅ Vista configurada\n');

    console.log('5️⃣ Obteniendo lista de máquinas...');
    const machines = await scraper['getMachineList']();
    console.log(`✅ Máquinas encontradas: ${machines.length}\n`);

    if (machines.length === 0) {
      console.log('❌ ERROR: No se encontraron máquinas');
      console.log('Revisar los archivos debug en /tmp:');
      console.log('  - televend-machines-page.html');
      console.log('  - televend-machines-page.png');
    } else {
      console.log('📋 Primeras 5 máquinas:');
      machines.slice(0, 5).forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.name} (ID: ${m.id})`);
        console.log(`     URL: ${m.url}`);
      });

      console.log('\n6️⃣ Probando extracción de recaudación de la primera máquina...');
      const firstMachine = machines[0];
      const revenue = await scraper['extractRevenueForMachine'](firstMachine);
      
      if (revenue) {
        console.log('✅ Recaudación extraída:');
        console.log(`   - Daily: €${revenue.daily}`);
        console.log(`   - Monthly (Last 30 Days): €${revenue.monthly}`);
        console.log(`   - Nombre: ${revenue.machineName}`);
        console.log(`   - Ubicación: ${revenue.location}`);
      } else {
        console.log('❌ No se pudo extraer recaudación');
      }
    }

    await scraper.close();
    console.log('\n✅ TEST COMPLETADO');

  } catch (error: any) {
    console.error('\n❌ ERROR EN TEST:', error.message);
    console.error('Stack:', error.stack);
    await scraper.close();
  }
}

// Ejecutar test
testTelevendScraper().catch(console.error);
