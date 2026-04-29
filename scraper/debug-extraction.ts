import { chromium } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

async function debugExtraction() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('🔐 Haciendo login...');
    await page.goto('https://dashboard.orain.io/accounts/login/');
    await page.fill('input[name="username"]', process.env.ORAIN_USERNAME || '');
    await page.fill('input[name="password"]', process.env.ORAIN_PASSWORD || '');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/home/', { timeout: 30000 });
    
    console.log('✅ Login exitoso');
    
    // Navegar al dashboard
    console.log('\n📊 Navegando al dashboard...');
    await page.goto('https://dashboard.orain.io/dashboard/home/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    
    // Esperar a que cargue
    await page.waitForSelector('canvas#total_sales_money_chart', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Hacer clic en "Día"
    console.log('\n🎯 Haciendo clic en botón "Día"...');
    const clicked = await page.evaluate(() => {
      const button = document.getElementById('btn-summary-home-daily');
      if (button) {
        console.log('Botón encontrado:', button);
        (button as HTMLElement).click();
        return true;
      }
      console.log('❌ Botón NO encontrado');
      return false;
    });
    
    console.log('¿Clic exitoso?', clicked);
    
    // Esperar actualización
    console.log('⏳ Esperando 4 segundos...');
    await page.waitForTimeout(4000);
    
    // Extraer todo el HTML relevante
    console.log('\n📄 HTML de las cajas de métricas:');
    const html = await page.evaluate(() => {
      const ticketBox = document.querySelector('#ticket-avg-box');
      const moneyBox = document.querySelector('#money-avg-box');
      const quantityBox = document.querySelector('#quantity-avg-box');
      
      return {
        ticketBox: ticketBox?.outerHTML || 'NO ENCONTRADO',
        moneyBox: moneyBox?.outerHTML || 'NO ENCONTRADO',
        quantityBox: quantityBox?.outerHTML || 'NO ENCONTRADO',
      };
    });
    
    console.log('\n=== TICKET BOX ===');
    console.log(html.ticketBox);
    console.log('\n=== MONEY BOX ===');
    console.log(html.moneyBox);
    console.log('\n=== QUANTITY BOX ===');
    console.log(html.quantityBox);
    
    // Extraer datos de Chart.js
    console.log('\n\n📈 Datos de Chart.js:');
    const chartData = await page.evaluate(() => {
      const canvas = document.querySelector('canvas#total_sales_money_chart') as any;
      if (!canvas) return { error: 'Canvas no encontrado' };
      
      try {
        if (typeof (window as any).Chart !== 'undefined') {
          const chartInstances = (window as any).Chart.instances;
          
          if (chartInstances) {
            for (const instance of Object.values(chartInstances)) {
              const chart = instance as any;
              
              if (chart.canvas === canvas) {
                const datasets = chart.data?.datasets || [];
                const labels = chart.data?.labels || [];
                
                return {
                  labels,
                  datasets: datasets.map((ds: any) => ({
                    label: ds.label,
                    data: ds.data,
                    backgroundColor: ds.backgroundColor,
                  })),
                };
              }
            }
          }
        }
        
        return { error: 'Instancia de Chart no encontrada' };
      } catch (error: any) {
        return { error: error.message };
      }
    });
    
    console.log(JSON.stringify(chartData, null, 2));
    
    // Calcular totales
    if (!chartData.error && chartData.datasets && chartData.datasets[0]) {
      const total = chartData.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
      console.log('\n💰 Total de la gráfica:', total.toFixed(2), '€');
      console.log('Labels:', chartData.labels);
      console.log('Valores:', chartData.datasets[0].data);
    }
    
    // Mantener el navegador abierto para inspeccionar manualmente
    console.log('\n⏸️  Navegador abierto. Presiona Ctrl+C para cerrar.');
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugExtraction();
