import { chromium } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

async function debugButtons() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login (usando tu OC scraper que ya funciona)
    console.log('🔐 Haciendo login...');
    await page.goto('https://dashboard.orain.io/accounts/login/', { waitUntil: 'networkidle' });
    
    const usernameField = await page.locator('input[name="username"], input[id="id_username"], input[type="text"]').first();
    await usernameField.fill(process.env.ORAIN_USERNAME || '');
    
    const passwordField = await page.locator('input[name="password"], input[id="id_password"], input[type="password"]').first();
    await passwordField.fill(process.env.ORAIN_PASSWORD || '');
    
    const submitButton = await page.locator('button[type="submit"], input[type="submit"]').first();
    await submitButton.click();
    
    await page.waitForTimeout(5000);
    console.log('✅ Login completado');
    
    // Ir al dashboard
    await page.goto('https://dashboard.orain.io/dashboard/home/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    console.log('\n=== VERIFICANDO BOTONES ===\n');
    
    // Buscar TODOS los botones posibles
    const buttonInfo = await page.evaluate(() => {
      const results: any = {};
      
      // Buscar por IDs específicos
      const ids = ['btn-summary-home-daily', 'btn-summary-home-weekly', 'btn-summary-home-monthly'];
      ids.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
          results[id] = {
            exists: true,
            text: btn.textContent?.trim(),
            classes: btn.className,
            isActive: btn.classList.contains('active'),
          };
        } else {
          results[id] = { exists: false };
        }
      });
      
      // Buscar botones con clase "active"
      const activeButtons = document.querySelectorAll('button.active, .btn.active, .active');
      results.activeButtons = Array.from(activeButtons).map(btn => ({
        id: btn.id,
        classes: btn.className,
        text: (btn as HTMLElement).innerText?.trim(),
      }));
      
      // Buscar todos los botones en el área de filtros
      const allButtons = document.querySelectorAll('button, .btn, input[type="button"]');
      results.allVisibleButtons = Array.from(allButtons).slice(0, 20).map(btn => ({
        id: btn.id || 'sin-id',
        classes: btn.className,
        text: (btn as HTMLElement).innerText?.trim().substring(0, 50),
      }));
      
      return results;
    });
    
    console.log('Resultados de búsqueda de botones:');
    console.log(JSON.stringify(buttonInfo, null, 2));
    
    // Intentar hacer click en el botón de "Día"
    console.log('\n=== INTENTANDO CLICK EN "DÍA" ===\n');
    
    const clickResult = await page.evaluate(() => {
      const btn = document.getElementById('btn-summary-home-daily');
      if (btn) {
        // Probar diferentes formas de hacer click
        (btn as HTMLElement).click();
        
        // Disparar evento manualmente
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        
        return { success: true, isActive: btn.classList.contains('active') };
      }
      return { success: false, error: 'Botón no encontrado' };
    });
    
    console.log('Resultado del click:', clickResult);
    
    // Esperar y extraer datos
    await page.waitForTimeout(5000);
    
    console.log('\n=== DATOS EXTRAÍDOS DESPUÉS DEL CLICK ===\n');
    
    const data = await page.evaluate(() => {
      const ticketBox = document.querySelector('#ticket-avg-box h1');
      const moneyBox = document.querySelector('#money-avg-box h1');
      
      // Extraer datos de Chart.js
      const canvas = document.querySelector('canvas#total_sales_money_chart') as any;
      let chartData: any = null;
      
      if (canvas && (window as any).Chart) {
        const chartInstances = (window as any).Chart.instances;
        if (chartInstances) {
          for (const instance of Object.values(chartInstances)) {
            const chart = instance as any;
            if (chart.canvas === canvas) {
              chartData = {
                labels: chart.data?.labels || [],
                values: chart.data?.datasets?.[0]?.data || [],
              };
              break;
            }
          }
        }
      }
      
      return {
        ticketMedio: ticketBox?.textContent?.trim(),
        mediaVentasEuros: moneyBox?.textContent?.trim(),
        chartData,
      };
    });
    
    console.log('Ticket Medio:', data.ticketMedio);
    console.log('Media Ventas €:', data.mediaVentasEuros);
    if (data.chartData) {
      const total = data.chartData.values.reduce((a: number, b: number) => a + b, 0);
      console.log('Total de ventas:', total.toFixed(2), '€');
      console.log('Desglose:', data.chartData.labels.map((label: string, idx: number) => 
        `${label}: ${data.chartData.values[idx]}€`
      ).join(', '));
    }
    
    // Esperar para inspección manual
    console.log('\n⏸️  Presiona Ctrl+C para cerrar...');
    await page.waitForTimeout(120000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugButtons();
