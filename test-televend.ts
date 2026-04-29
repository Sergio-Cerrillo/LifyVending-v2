/**
 * Script de prueba para el scraper de Televend
 * 
 * Ejecutar con: npx ts-node test-televend.ts
 */

import { TelevendScraper } from './scraper/televend-scraper';

async function testTelevendScraper() {
  console.log('🧪 Iniciando prueba del scraper de Televend...\n');

  const scraper = new TelevendScraper({
    username: process.env.TELEVEND_USERNAME || 'info@lifyvending.com',
    password: process.env.TELEVEND_PASSWORD || 'KennUma23!',
    headless: false // Mostrará el navegador
  });

  try {
    console.log('1️⃣ Inicializando navegador...');
    await scraper.initialize();

    console.log('\n2️⃣ Iniciando login...');
    await scraper.login();

    console.log('\n3️⃣ Navegando a página de máquinas...');
    await scraper.navigateToMachines();

    console.log('\n4️⃣ Configurando vista de 100 máquinas...');
    await scraper.setShow100Machines();

    console.log('\n5️⃣ Obteniendo lista de máquinas...');
    const machines = await scraper.getMachineList();

    console.log('\n✅ RESULTADO:');
    console.log(`   Total de máquinas: ${machines.length}`);
    
    if (machines.length > 0) {
      console.log('\n📋 Primeras 5 máquinas:');
      machines.slice(0, 5).forEach((machine, index) => {
        console.log(`   ${index + 1}. ${machine.name}`);
        console.log(`      ID: ${machine.id}`);
        console.log(`      URL: ${machine.url}`);
      });
    } else {
      console.log('\n⚠️  NO se encontraron máquinas.');
      console.log('   Revisa los archivos de debug:');
      console.log('   - Screenshot: /tmp/televend-machines-page.png');
      console.log('   - HTML: /tmp/televend-machines-page.html');
    }

    console.log('\n6️⃣ Cerrando navegador...');
    await scraper.close();

    console.log('\n✅ Prueba completada');

  } catch (error) {
    console.error('\n❌ ERROR durante la prueba:');
    console.error(error);
    
    try {
      await scraper.close();
    } catch (closeError) {
      // Ignorar errores al cerrar
    }
  }
}

// Ejecutar
testTelevendScraper();
