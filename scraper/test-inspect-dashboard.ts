import { config } from 'dotenv';
import { getAuthenticatedPage } from './orain-scraper';
import * as fs from 'fs';

// Cargar variables de entorno
config({ path: '.env.local' });

async function inspectDashboard() {
  let browser = null;
  let page = null;

  try {
    console.log('🔹 Iniciando inspección del dashboard...');
    
    const result = await getAuthenticatedPage();
    browser = result.browser;
    page = result.page;

    if (!page || !browser) {
      throw new Error('Failed to initialize browser or page');
    }

    console.log('🔹 Navegando a dashboard...');
    await page.goto('https://dashboard.orain.io/dashboard/home/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    // Extraer HTML de las cajas de métricas
    const html = await page.evaluate(() => {
      const ticketBox = document.querySelector('#ticket-avg-box');
      const moneyBox = document.querySelector('#money-avg-box');
      const quantityBox = document.querySelector('#quantity-avg-box');
      
      return {
        ticketBoxHTML: ticketBox?.outerHTML || 'NO ENCONTRADO',
        moneyBoxHTML: moneyBox?.outerHTML || 'NO ENCONTRADO',
        quantityBoxHTML: quantityBox?.outerHTML || 'NO ENCONTRADO',
        ticketBoxText: ticketBox?.textContent || 'NO ENCONTRADO',
        moneyBoxText: moneyBox?.textContent || 'NO ENCONTRADO',
        quantityBoxText: quantityBox?.textContent || 'NO ENCONTRADO',
      };
    });

    console.log('\n=== TICKET MEDIO ===');
    console.log('HTML:', html.ticketBoxHTML.substring(0, 500));
    console.log('Text:', html.ticketBoxText);

    console.log('\n=== MEDIA VENTAS € ===');
    console.log('HTML:', html.moneyBoxHTML.substring(0, 500));
    console.log('Text:', html.moneyBoxText);

    console.log('\n=== MEDIA VENTAS # ===');
    console.log('HTML:', html.quantityBoxHTML.substring(0, 500));
    console.log('Text:', html.quantityBoxText);

    // Extraer información de Chart.js
    const chartInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas#total_sales_money_chart') as any;
      
      if (!canvas) return { error: 'Canvas no encontrado' };

      try {
        if (canvas.chart) {
          const chart = canvas.chart;
          return {
            type: chart.config.type,
            labels: chart.config.data.labels,
            datasets: chart.config.data.datasets.map((ds: any) => ({
              label: ds.label,
              data: ds.data,
              backgroundColor: ds.backgroundColor,
            })),
          };
        }
      } catch (e: any) {
        return { error: e.message };
      }

      return { error: 'No se pudo acceder a chart' };
    });

    console.log('\n=== CHART.JS INFO (Total Ventas €) ===');
    console.log(JSON.stringify(chartInfo, null, 2));

    // Guardar HTML completo
    const fullHTML = await page.content();
    fs.writeFileSync('scraper/output/dashboard-full.html', fullHTML, 'utf-8');
    console.log('\n📄 HTML completo guardado en scraper/output/dashboard-full.html');

    await browser.close();
    console.log('✅ Inspección completada');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (browser) {
      await browser.close().catch(console.error);
    }
    
    process.exit(1);
  }
}

inspectDashboard();
