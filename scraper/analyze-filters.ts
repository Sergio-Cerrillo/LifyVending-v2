/**
 * Script para analizar TODOS los filtros y selectores en el dashboard de Orain
 * Esto nos ayudará a entender por qué los datos no coinciden
 */

import { chromium } from 'playwright';
import { OrainScraper } from './orain-scraper';

async function analyzeFilters() {
  const scraper = new OrainScraper({
    user: process.env.ORAIN_USERNAME || '',
    pass: process.env.ORAIN_PASSWORD || '',
    headless: false,
  });

  try {
    await scraper.initialize();
    await scraper.login();
    
    const page = (scraper as any).page;
    
    // Navegar al dashboard
    console.log('\n📊 Navegando al dashboard...');
    await page.goto('https://dashboard.orain.io/dashboard/home/', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    
    await page.waitForTimeout(3000);
    
    console.log('\n=== ANÁLISIS COMPLETO DEL DASHBOARD ===\n');
    
    // Extraer TODO: URL, selectores, filtros, etc.
    const analysis = await page.evaluate(() => {
      const results: any = {
        url: window.location.href,
        queryParams: {},
        allSelects: [],
        allButtons: [],
        allInputs: [],
        activeElements: [],
        possibleFilters: [],
      };
      
      // Query params
      const params = new URLSearchParams(window.location.search);
      params.forEach((value, key) => {
        results.queryParams[key] = value;
      });
      
      // Todos los selects/dropdowns
      const selects = document.querySelectorAll('select');
      results.allSelects = Array.from(selects).map(select => ({
        id: select.id || 'sin-id',
        name: select.name || 'sin-name',
        value: select.value,
        options: Array.from(select.options).map(opt => ({
          value: opt.value,
          text: opt.text,
          selected: opt.selected,
        })),
      }));
      
      // Todos los botones (primeros 30)
      const buttons = document.querySelectorAll('button, .btn, a.button');
      results.allButtons = Array.from(buttons).slice(0, 30).map(btn => ({
        id: btn.id || 'sin-id',
        text: (btn as HTMLElement).innerText?.trim().substring(0, 50),
        classes: btn.className,
        isActive: btn.classList.contains('active') || btn.classList.contains('selected'),
      }));
      
      // Inputs que puedan ser filtros (fechas, búsquedas, etc)
      const inputs = document.querySelectorAll('input[type="date"], input[type="search"], input[type="text"]');
      results.allInputs = Array.from(inputs).map(input => ({
        id: input.id || 'sin-id',
        name: (input as HTMLInputElement).name || 'sin-name',
        type: (input as HTMLInputElement).type,
        value: (input as HTMLInputElement).value,
        placeholder: (input as HTMLInputElement).placeholder,
      }));
      
      // Elementos con clase "active" o "selected"
      const actives = document.querySelectorAll('.active, .selected, [aria-selected="true"]');
      results.activeElements = Array.from(actives).slice(0, 20).map(el => ({
        tag: el.tagName,
        id: el.id || 'sin-id',
        classes: el.className,
        text: (el as HTMLElement).innerText?.trim().substring(0, 100),
      }));
      
      // Buscar elementos que parezcan filtros (divs con "filter", "selector", "dropdown" en clase/id)
      const possibleFilters = document.querySelectorAll('[class*="filter"], [class*="selector"], [class*="dropdown"], [id*="filter"], [id*="selector"]');
      results.possibleFilters = Array.from(possibleFilters).slice(0, 15).map(el => ({
        tag: el.tagName,
        id: el.id || 'sin-id',
        classes: el.className,
        text: (el as HTMLElement).innerText?.trim().substring(0, 100),
      }));
      
      return results;
    });
    
    console.log('🔍 URL actual:', analysis.url);
    console.log('\n📝 Query Parameters:');
    console.log(JSON.stringify(analysis.queryParams, null, 2));
    
    console.log('\n🔽 Selectores/Dropdowns encontrados:', analysis.allSelects.length);
    analysis.allSelects.forEach((select: any, idx: number) => {
      console.log(`\n  [${idx + 1}] ID: ${select.id}, Name: ${select.name}`);
      console.log(`      Valor actual: ${select.value}`);
      if (select.options.length > 0) {
        console.log(`      Opciones disponibles:`);
        select.options.forEach((opt: any) => {
          const marker = opt.selected ? '✓' : ' ';
          console.log(`        [${marker}] ${opt.text} (value: ${opt.value})`);
        });
      }
    });
    
    console.log('\n🔘 Botones con "active" o sospechosos:');
    analysis.allButtons.filter((btn: any) => btn.isActive || btn.text.includes('Día') || btn.text.includes('Semana') || btn.text.includes('Mes')).forEach((btn: any) => {
      console.log(`  - ID: ${btn.id}, Text: "${btn.text}", Active: ${btn.isActive}`);
    });
    
    console.log('\n📅 Inputs de fecha/filtro:', analysis.allInputs.length);
    analysis.allInputs.forEach((input: any) => {
      console.log(`  - ID: ${input.id}, Type: ${input.type}, Value: "${input.value}", Placeholder: "${input.placeholder}"`);
    });
    
    console.log('\n✨ Elementos activos/seleccionados:');
    analysis.activeElements.forEach((el: any) => {
      console.log(`  - ${el.tag}#${el.id}: "${el.text.substring(0, 60)}"`);
    });
    
    console.log('\n🎯 Posibles filtros encontrados:');
    analysis.possibleFilters.forEach((filter: any) => {
      console.log(`  - ${filter.tag}#${filter.id} [${filter.classes}]`);
      if (filter.text) console.log(`    Contenido: "${filter.text.substring(0, 80)}"`);
    });
    
    // Extraer datos actuales para comparar
    console.log('\n💰 DATOS ACTUALES EN EL DASHBOARD:');
    const currentData = await page.evaluate(() => {
      const ticketBox = document.querySelector('#ticket-avg-box h1');
      const moneyBox = document.querySelector('#money-avg-box h1');
      
      // Chart.js
      const canvas = document.querySelector('canvas#total_sales_money_chart') as any;
      let total = 0;
      let breakdown: any[] = [];
      
      if (canvas && (window as any).Chart) {
        const chartInstances = (window as any).Chart.instances;
        if (chartInstances) {
          for (const instance of Object.values(chartInstances)) {
            const chart = instance as any;
            if (chart.canvas === canvas) {
              const labels = chart.data?.labels || [];
              const values = chart.data?.datasets?.[0]?.data || [];
              total = values.reduce((a: number, b: number) => a + b, 0);
              breakdown = labels.map((label: string, idx: number) => ({
                label,
                value: values[idx],
              }));
              break;
            }
          }
        }
      }
      
      return {
        ticketMedio: ticketBox?.textContent?.trim(),
        mediaVentasEuros: moneyBox?.textContent?.trim(),
        totalVentas: total,
        breakdown,
      };
    });
    
    console.log('  Ticket Medio:', currentData.ticketMedio);
    console.log('  Media Ventas €:', currentData.mediaVentasEuros);
    console.log('  TOTAL VENTAS:', currentData.totalVentas.toFixed(2), '€');
    console.log('  Desglose:', currentData.breakdown.map((item: any) => 
      `${item.label}: ${item.value}€`
    ).join(', '));
    
    console.log('\n⏸️  Navegador abierto. Revisa manualmente y presiona Ctrl+C para cerrar...');
    await page.waitForTimeout(300000); // 5 minutos
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await scraper.close();
  }
}

analyzeFilters();
