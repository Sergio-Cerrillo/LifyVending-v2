#!/usr/bin/env node
/**
 * Test básico para verificar que Puppeteer funciona correctamente
 * Simplemente lanza el navegador, navega a una página y cierra
 */

import puppeteer from 'puppeteer';

async function testPuppeteer() {
  console.log('🧪 Probando Puppeteer...\n');
  
  let browser;
  
  try {
    console.log('1️⃣ Lanzando navegador Chromium...');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      timeout: 60000
    });
    
    console.log('✅ Navegador lanzado correctamente\n');
    
    console.log('2️⃣ Creando nueva página...');
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    console.log('✅ Página creada\n');
    
    console.log('3️⃣ Navegando a una página de prueba...');
    await page.goto('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    console.log('✅ Navegación exitosa\n');
    
    const title = await page.title();
    const url = page.url();
    
    console.log(`📄 Título: ${title}`);
    console.log(`🔗 URL: ${url}\n`);
    
    console.log('4️⃣ Cerrando navegador...');
    await browser.close();
    console.log('✅ Navegador cerrado\n');
    
    console.log('🎉 ¡Puppeteer funciona correctamente!');
    console.log('✅ Chromium está instalado y puede lanzarse');
    console.log('✅ La navegación funciona');
    console.log('✅ El scraping de Frekuent debería funcionar ahora\n');
    
  } catch (error) {
    console.error('❌ Error al probar Puppeteer:', error);
    console.error('\n💡 Posibles soluciones:');
    console.error('   1. Ejecuta: npx puppeteer browsers install chrome');
    console.error('   2. Verifica que tienes suficiente memoria');
    console.error('   3. Revisa los permisos del sistema\n');
    
    if (browser) {
      await browser.close();
    }
    
    process.exit(1);
  }
}

testPuppeteer();
