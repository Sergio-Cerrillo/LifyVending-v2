/**
 * FREKUENT REVENUE SCRAPER
 * 
 * Scraper de recaudación adaptado para Frekuent (anteriormente Orain)
 * 
 * Simplificación importante respecto a Orain:
 * - Ya NO es necesario navegar máquina por máquina
 * - La recaudación está directamente visible en la tabla principal
 * - Columna "Ventas" muestra la facturación total de cada máquina
 * - Filtro de fecha en la parte superior permite seleccionar:
 *   * "Hoy" (daily)
 *   * "Este mes" (monthly)
 * 
 * Proceso:
 * 1. Login en Frekuent
 * 2. Navegar a "Puntos de venta"
 * 3. Configurar paginación a 100/página
 * 4. Seleccionar filtro de fecha (Hoy / Este mes)
 * 5. Extraer datos de la tabla:
 *    - Dispositivo / Nombre
 *    - Ubicación
 *    - Ventas (columna directamente visible)
 * 6. Retornar datos agregados
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface FrekuentMachineRevenueData {
  machineName: string;
  deviceId: string;
  location: string;
  totalRevenue: number;
  period: 'daily' | 'monthly';
  scrapedAt: Date;
}

export interface FrekuentRevenueResult {
  success: boolean;
  data: FrekuentMachineRevenueData[];
  error?: string;
  scrapedAt: Date;
  totalMachines: number;
}

/**
 * Convierte texto de precio a número
 * Soporta formatos: "31.40 €" (inglés), "3.140,00 €" (español), "3140 €"
 */
function parseEuroAmount(text: string): number {
  if (!text || text === '--' || text === '—' || text === '-') return 0;
  
  const cleaned = text.replace(/\s+/g, '').replace('€', '');
  
  // Detectar formato: si tiene coma, es formato español (punto=miles, coma=decimal)
  // Si NO tiene coma y tiene punto, es formato inglés (punto=decimal)
  if (cleaned.includes(',')) {
    // Formato español: "3.140,00" → quitar puntos, cambiar coma por punto
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const amount = parseFloat(normalized);
    return isNaN(amount) ? 0 : amount;
  } else {
    // Formato inglés o sin decimales: "31.40" o "3140"
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }
}

/**
 * Configura el filtro de fecha según el periodo (SIMPLIFICADO + VERIFICACIÓN)
 * Solo click en el botón → seleccionar opción → esperar recarga → verificar cambio
 */
async function setDateFilter(
  page: Page,
  period: 'daily' | 'monthly'
): Promise<void> {
  const targetText = period === 'daily' ? 'Hoy' : 'Este mes';
  const targetLower = targetText.toLowerCase();
  
  console.log(`[FREKUENT] ⏰ Configurando filtro: ${period} ("${targetText}")`);

  try {
    // 1. Verificar filtro actual
    const currentFilter = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        const text = btn.textContent?.trim().toLowerCase() || '';
        if (text.includes('hoy') || text.includes('este mes')) {
          return text;
        }
      }
      return null;
    });
    
    // Si ya está en el período correcto, salir
    if (currentFilter && currentFilter.includes(targetLower)) {
      console.log(`[FREKUENT] ✅ Ya está en "${targetText}"`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }
    
    console.log(`[FREKUENT] 📍 Cambiando de "${currentFilter}" → "${targetText}"`);

    // 2. Capturar datos ANTES del cambio (para verificar después)
    const dataBefore = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return null;
      
      const rows = Array.from(table.querySelectorAll('tbody tr'))
        .filter(row => !row.hasAttribute('aria-hidden'));
      
      if (rows.length === 0) return null;
      
      // Obtener primeras 3 filas de ventas para comparar (columna 4 = Ventas total)
      const samples = rows.slice(0, 3).map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
          return cells[4]?.textContent?.trim() || '';
        }
        return '';
      });
      
      return { samples, rowCount: rows.length };
    });
    
    console.log(`[FREKUENT] 📊 Datos ANTES: ${dataBefore?.samples.join(', ')}`);

    // 3. Click en el botón de filtro (el que tiene icono de calendario y texto "hoy"/"este mes")
    console.log('[FREKUENT] 🔍 Buscando y clickeando botón de fecha...');
    
    // ESTRATEGIA 1: Encontrar el botón y hacer click con Puppeteer nativo
    let buttonClicked: { clicked: boolean; text: string | null } = { clicked: false, text: null };
    
    try {
      const buttonSelector = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        
        for (const btn of buttons) {
          const text = btn.textContent?.trim().toLowerCase() || '';
          const hasCalendarIcon = btn.querySelector('svg') !== null;
          const hasDateText = text.includes('hoy') || text.includes('este mes') || text.includes('ayer') || text.includes('semana');
          
          if (hasCalendarIcon && hasDateText) {
            console.log(`[EVAL] ✅ Encontrado botón de fecha: "${text}"`);
            return btn as Element;
          }
        }
        
        return null;
      });
      
      const button = buttonSelector.asElement() as any; // Type assertion necesaria para Puppeteer
      if (button) {
        // Click con Puppeteer (más confiable)
        await button.click();
        buttonClicked.clicked = true;
        
        // Obtener el texto del botón
        buttonClicked.text = await page.evaluate(el => el.textContent?.trim() || '', button);
        console.log(`[FREKUENT] ✅ Click en botón (estrategia Puppeteer): "${buttonClicked.text}"`);
      } else {
        console.log('[FREKUENT] ⚠️ Estrategia Puppeteer no encontró botón, probando estrategia evaluate...');
      }
    } catch (error) {
      console.log('[FREKUENT] ⚠️ Error con estrategia Puppeteer, probando estrategia evaluate...');
    }
    
    // ESTRATEGIA 2: Fallback con evaluate (si la primera falló)
    if (!buttonClicked.clicked) {
      buttonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        
        for (const btn of buttons) {
          const text = btn.textContent?.trim().toLowerCase() || '';
          const hasCalendarIcon = btn.querySelector('svg') !== null;
          const hasDateText = text.includes('hoy') || text.includes('este mes') || text.includes('ayer') || text.includes('semana');
          
          if (hasCalendarIcon && hasDateText) {
            console.log(`[EVAL] ✅ Encontrado botón de fecha: "${text}"`);
            (btn as HTMLElement).click();
            return { clicked: true, text };
          }
        }
        
        return { clicked: false, text: null };
      });
      
      if (buttonClicked.clicked) {
        console.log(`[FREKUENT] ✅ Click en botón (estrategia evaluate): "${buttonClicked.text}"`);
      }
    }
    
    if (!buttonClicked.clicked) {
      console.error('[FREKUENT] ❌ No se encontró el botón de fecha');
      return;
    }
    
    console.log(`[FREKUENT] ✅ Click en botón: "${buttonClicked.text}"`);
    console.log('[FREKUENT] ⏳ Esperando menú desplegable...');
    
    // 4. Esperar a que aparezca el menú/dropdown en el DOM
    // Aumentamos el tiempo y usamos waitForSelector para mayor confiabilidad
    try {
      await page.waitForSelector('.ant-dropdown:not(.ant-dropdown-hidden), [role="menu"]:not([style*="display: none"])', {
        visible: true,
        timeout: 5000
      });
      console.log('[FREKUENT] ✅ Menú desplegable detectado');
    } catch (error) {
      console.warn('[FREKUENT] ⚠️ No se detectó menú con waitForSelector, esperando 3s...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Verificar que el menú está visible y listar opciones
    const menuInfo = await page.evaluate(() => {
      // Buscar elementos típicos de menú de Ant Design o dropdowns
      const menus = document.querySelectorAll(
        '.ant-dropdown:not(.ant-dropdown-hidden)' +
        ', .ant-select-dropdown:not(.ant-select-dropdown-hidden)' +
        ', [role="menu"]:not([style*="display: none"])' +
        ', [role="listbox"]:not([style*="display: none"])'
      );
      
      console.log(`[EVAL] Menús visibles encontrados: ${menus.length}`);
      
      if (menus.length > 0) {
        const menu = menus[0];
        const rect = menu.getBoundingClientRect();
        console.log(`[EVAL] Menú dimensiones: ${rect.width}x${rect.height}`);
        console.log(`[EVAL] Menú posición: top=${rect.top}, left=${rect.left}`);
        
        // Obtener lista de opciones visibles
        const options = Array.from(menu.querySelectorAll('div, li, span, button'))
          .filter(el => {
            const elRect = (el as HTMLElement).getBoundingClientRect();
            const style = window.getComputedStyle(el as HTMLElement);
            return elRect.width > 0 && elRect.height > 0 && 
                   style.display !== 'none' && style.visibility !== 'hidden';
          })
          .map(el => el.textContent?.trim())
          .filter(text => text && text.length < 30 && !text.includes('€'));
        
        console.log(`[EVAL] Opciones encontradas: ${options.join(', ')}`);
        return { visible: true, options };
      }
      
      return { visible: false, options: [] };
    });
    
    if (!menuInfo.visible) {
      console.warn('[FREKUENT] ⚠️ No se detectó menú visible, puede que no se haya abierto');
      console.warn('[FREKUENT] ⚠️ Intentando buscar opciones de todas formas...');
    } else {
      console.log(`[FREKUENT] ✅ Menú desplegable visible con opciones: ${menuInfo.options.join(', ')}`);
    }
    
    // 5. Buscar y hacer click en la opción
    console.log(`[FREKUENT] 🎯 Buscando "${targetText}"...`);
    
    // Configurar listener para la respuesta de la API ANTES de hacer click
    const apiResponsePromise = page.waitForResponse(
      response => {
        const url = response.url();
        return url.includes('points-of-sale') || url.includes('/api/') || url.includes('frekuent');
      },
      { timeout: 15000 }
    ).catch(() => null); // No fallar si no hay respuesta API
    
    let clicked: string | null = null;
    
    // ESTRATEGIA 1: Click con Puppeteer nativo (más confiable)
    try {
      const optionHandle = await page.evaluateHandle((target) => {
        const targetLower = target.toLowerCase();
        
        // Buscar DENTRO del menú desplegable visible
        const menus = document.querySelectorAll(
          '.ant-dropdown:not(.ant-dropdown-hidden)' +
          ', .ant-select-dropdown:not(.ant-select-dropdown-hidden)' +
          ', [role="menu"]:not([style*="display: none"])' +
          ', [role="listbox"]:not([style*="display: none"])'
        );
        
        if (menus.length > 0) {
          const menu = menus[0];
          const menuElements = Array.from(menu.querySelectorAll('div, span, button, li, a'));
          
          for (const el of menuElements) {
            const rect = (el as HTMLElement).getBoundingClientRect();
            const style = window.getComputedStyle(el as HTMLElement);
            const text = el.textContent?.trim() || '';
            const textLower = text.toLowerCase();
            
            if (rect.width > 0 && rect.height > 0 && 
                style.display !== 'none' && style.visibility !== 'hidden' &&
                text.length > 0 && text.length < 30 &&
                !text.includes('€') && !/^\d+$/.test(text) &&
                textLower === targetLower) {
              
              console.log(`[EVAL] ✅ Encontrado en menú: "${text}"`);
              return el;
            }
          }
        }
        
        // Fallback: buscar en toda la página
        const allElements = Array.from(document.querySelectorAll('div, span, button, li, a'));
        for (const el of allElements) {
          const rect = (el as HTMLElement).getBoundingClientRect();
          const style = window.getComputedStyle(el as HTMLElement);
          const text = el.textContent?.trim() || '';
          const textLower = text.toLowerCase();
          
          if (rect.width > 0 && rect.height > 0 && 
              style.display !== 'none' && style.visibility !== 'hidden' &&
              text.length > 0 && text.length < 30 &&
              !text.includes('€') && !/^\d+$/.test(text) &&
              textLower === targetLower) {
            
            console.log(`[EVAL] ✅ Encontrado en página: "${text}"`);
            return el;
          }
        }
        
        return null;
      }, targetText);
      
      const option = optionHandle.asElement() as any; // Type assertion necesaria para Puppeteer
      if (option) {
        // Click con Puppeteer (más confiable para elementos dinámicos)
        await option.click();
        clicked = await page.evaluate(el => el.textContent?.trim() || '', option);
        console.log(`[FREKUENT] ✅ Seleccionado (Puppeteer): "${clicked}"`);
      }
    } catch (error) {
      console.log('[FREKUENT] ⚠️ Error con estrategia Puppeteer para opción, probando evaluate...');
    }
    
    // ESTRATEGIA 2: Fallback con evaluate() si Puppeteer falló
    if (!clicked) {
      clicked = await page.evaluate((target) => {
        const targetLower = target.toLowerCase();
        
        // Buscar DENTRO del menú desplegable visible
        const menus = document.querySelectorAll(
          '.ant-dropdown:not(.ant-dropdown-hidden)' +
          ', .ant-select-dropdown:not(.ant-select-dropdown-hidden)' +
          ', [role="menu"]:not([style*="display: none"])' +
          ', [role="listbox"]:not([style*="display: none"])'
        );
        
        if (menus.length > 0) {
          const menu = menus[0];
          console.log(`[EVAL] Buscando dentro del menú (${menu.className})`);
          
          const menuElements = Array.from(menu.querySelectorAll('div, span, button, li, a'));
          
          for (const el of menuElements) {
            const rect = (el as HTMLElement).getBoundingClientRect();
            const style = window.getComputedStyle(el as HTMLElement);
            const text = el.textContent?.trim() || '';
            const textLower = text.toLowerCase();
            
            if (rect.width > 0 && rect.height > 0 && 
                style.display !== 'none' && style.visibility !== 'hidden' &&
                text.length > 0 && text.length < 30 &&
                !text.includes('€') && !/^\d+$/.test(text) &&
                textLower === targetLower) {
              
              console.log(`[EVAL] ✅ Encontrado en menú: "${text}"`);
              (el as HTMLElement).click();
              return text;
            }
          }
          
          console.log(`[EVAL] ⚠️ No encontrado en menú, buscando en toda la página...`);
        }
        
        // Fallback: buscar en toda la página
        const allElements = Array.from(document.querySelectorAll('div, span, button, li, a'));
        
        for (const el of allElements) {
          const rect = (el as HTMLElement).getBoundingClientRect();
          const style = window.getComputedStyle(el as HTMLElement);
          const text = el.textContent?.trim() || '';
          const textLower = text.toLowerCase();
          
          if (rect.width > 0 && rect.height > 0 && 
              style.display !== 'none' && style.visibility !== 'hidden' &&
              text.length > 0 && text.length < 30 &&
              !text.includes('€') && !/^\d+$/.test(text) &&
              textLower === targetLower) {
            
            console.log(`[EVAL] ✅ Encontrado en página: "${text}"`);
            (el as HTMLElement).click();
            return text;
          }
        }
        
        return null;
      }, targetText);
      
      if (clicked) {
        console.log(`[FREKUENT] ✅ Seleccionado (evaluate): "${clicked}"`);
      }
    }
    
    if (!clicked) {
      console.warn(`[FREKUENT] ⚠️  No se encontró "${targetText}" en el menú ni en la página`);
      return;
    }
    
    // 6. IMPORTANTE: Verificar que el botón cambió su texto después del click
    console.log('[FREKUENT] ⏳ Verificando que el filtro se aplicó correctamente...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const filterChanged = await page.evaluate((expectedText) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      
      for (const btn of buttons) {
        const text = btn.textContent?.trim().toLowerCase() || '';
        const hasCalendarIcon = btn.querySelector('svg') !== null;
        
        if (hasCalendarIcon && text.includes(expectedText.toLowerCase())) {
          console.log(`[EVAL] ✅ Botón actualizado a: "${text}"`);
          return true;
        }
      }
      
      console.warn(`[EVAL] ⚠️ El botón NO muestra "${expectedText}"`);
      return false;
    }, targetText);
    
    if (!filterChanged) {
      console.warn(`[FREKUENT] ⚠️ El botón de fecha NO cambió a "${targetText}"`);
      console.warn(`[FREKUENT] ⚠️ Es posible que el click no se haya aplicado correctamente`);
      // No retornamos, continuamos para ver qué pasa con los datos
    } else {
      console.log(`[FREKUENT] ✅ Botón de fecha actualizado a "${targetText}"`);
    }
    
    // 7. Esperar respuesta de la API o cambio en la tabla
    console.log('[FREKUENT] ⏳ Esperando respuesta de API...');
    
    try {
      // Esperar respuesta API si está disponible
      const apiResponse = await apiResponsePromise;
      if (apiResponse) {
        console.log('[FREKUENT] ✅ Respuesta API recibida');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Espera para renderizado
      } else {
        console.log('[FREKUENT] ⚠️  No se detectó respuesta API, usando timeout');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Mayor tiempo sin API
      }
    } catch (error) {
      console.log('[FREKUENT] ⚠️  Error esperando API, usando timeout');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // 8. Esperar hasta que la tabla realmente cambie (máximo 12s)
    console.log('[FREKUENT] ⏳ Esperando cambio en datos de tabla...');
    
    const beforeSamples = dataBefore?.samples || [];
    const dataChanged = await page.waitForFunction(
      (beforeSamples: string[]) => {
        const table = document.querySelector('table');
        if (!table) {
          console.log('[EVAL] ⚠️ No se encuentra tabla');
          return false;
        }
        
        const rows = Array.from(table.querySelectorAll('tbody tr'))
          .filter((row: Element) => !row.hasAttribute('aria-hidden'));
        
        if (rows.length === 0) {
          console.log('[EVAL] ⚠️ No hay filas en la tabla');
          return false;
        }
        
        const currentSamples = rows.slice(0, 3).map(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 5) {
            return cells[4]?.textContent?.trim() || '';
          }
          return '';
        });
        
        console.log(`[EVAL] Comparando: [${currentSamples.join(', ')}] vs [${beforeSamples.join(', ')}]`);
        
        // Verificar si al menos uno de los valores cambió
        const hasChanged = currentSamples.some((val: string, idx: number) => val !== beforeSamples[idx]);
        
        if (hasChanged) {
          console.log('[EVAL] ✅ Los datos han cambiado!');
        }
        
        return hasChanged;
      },
      { timeout: 12000 },
      beforeSamples
    ).then(() => true).catch(() => false);
    
    if (dataChanged) {
      console.log('[FREKUENT] ✅ Datos de la tabla actualizados correctamente');
    } else {
      console.warn('[FREKUENT] ⚠️ Timeout esperando cambio en datos (12s)');
      console.warn('[FREKUENT] ⚠️ Los datos pueden ser idénticos o el filtro no se aplicó');
    }
    
    // 9. Verificar que los datos cambiaron
    const dataAfter = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return null;
      
      const rows = Array.from(table.querySelectorAll('tbody tr'))
        .filter(row => !row.hasAttribute('aria-hidden'));
      
      if (rows.length === 0) return null;
      
      // Obtener primeras 3 filas de ventas para comparar
      const samples = rows.slice(0, 3).map(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
          return cells[4]?.textContent?.trim() || '';
        }
        return '';
      });
      
      return { samples, rowCount: rows.length };
    });
    
    console.log(`[FREKUENT] 📊 Datos DESPUÉS: ${dataAfter?.samples.join(', ')}`);
    
    // Comparar datos
    if (dataBefore && dataAfter) {
      const sameData = dataBefore.samples.every((val, idx) => val === dataAfter.samples[idx]);
      
      if (!dataChanged || sameData) {
        console.warn(`[FREKUENT] ⚠️  ADVERTENCIA: Los datos NO cambiaron después del filtro!`);
        console.warn(`[FREKUENT] ⚠️  Posibles causas:`);
        console.warn(`[FREKUENT]     1. Los valores son iguales en ambos períodos (${targetText})`);
        console.warn(`[FREKUENT]     2. El filtro no se aplicó correctamente`);
        console.warn(`[FREKUENT]     3. La tabla necesita más tiempo para recargar`);
      } else {
        console.log(`[FREKUENT] ✅ Datos cambiaron correctamente`);
      }
    }
    
    console.log('[FREKUENT] ✅ Filtro aplicado');
    
  } catch (error) {
    console.error(`[FREKUENT] ❌ Error en filtro ${period}:`, error);
    throw error;
  }
}

/**

/**
 * Configura la tabla para mostrar 100 entradas
 */
async function setTableEntries(page: Page): Promise<void> {
  console.log('[FREKUENT] 📊 Configurando tabla para 100 entradas...');

  try {
    // Esperar a que la tabla esté cargada - intentar varios selectores
    console.log('[FREKUENT] ⏳ Esperando a que cargue la tabla...');
    
    try {
      await page.waitForSelector('table, .ant-table, [role="table"]', { timeout: 10000 });
      console.log('[FREKUENT] ✅ Tabla encontrada');
    } catch (tableError) {
      console.log('[FREKUENT] ⚠️ No se encontró tabla con selectores estándar, intentando con tiempo de espera...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Debug: Ver qué hay en la página
    const pageInfo = await page.evaluate(() => {
      return {
        tables: document.querySelectorAll('table').length,
        antTables: document.querySelectorAll('.ant-table').length,
        selects: document.querySelectorAll('.ant-select').length,
        pagination: document.querySelectorAll('.ant-pagination').length,
        url: window.location.href,
        title: document.title
      };
    });
    console.log('[FREKUENT] 🔍 Estado de la página:', pageInfo);
    
    if (pageInfo.tables === 0 && pageInfo.antTables === 0) {
      console.warn('[FREKUENT] ⚠️ No se encontró ninguna tabla en la página. Saltando configuración de paginación.');
      console.warn(`[FREKUENT]    URL actual: ${pageInfo.url}`);
      console.warn(`[FREKUENT]    Título: ${pageInfo.title}`);
      
      return;
    }
    
    console.log('[FREKUENT] ✅ Tabla encontrada en la página');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Paso 1: Buscar y hacer click en el selector de paginación usando Puppeteer
    // Buscar .ant-select que contenga texto con "page"
    const paginationSelector = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('.ant-select'));
      for (const select of selects) {
        const text = select.textContent || '';
        if (text.includes('/ page')) {
          // Retornar clase única o data attribute
          const classes = Array.from(select.classList).join('.');
          return `.${classes}`;
        }
      }
      
      // Fallback: buscar en zona de paginación
      const pagination = document.querySelector('.ant-pagination');
      if (pagination) {
        const select = pagination.querySelector('.ant-select');
        if (select) {
          const classes = Array.from(select.classList).join('.');
          return `.${classes}`;
        }
      }
      
      return null;
    });
    
    if (paginationSelector) {
      console.log(`  ⚡ Encontrado selector de paginación: ${paginationSelector}`);
      await page.click(paginationSelector);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Paso 2: Hacer click en la opción "100 / page"
      const optionClicked = await page.evaluate(() => {
        const options = Array.from(document.querySelectorAll(
          '[role="option"]' +
          ', .ant-select-item-option' +
          ', .ant-select-item' +
          ', .rc-virtual-list-holder-inner > div'
        ));
        
        for (const option of options) {
          const text = option.textContent?.trim() || '';
          if (text === '100 / page' || text === '100 / página' || text.includes('100')) {
            console.log(`[FREKUENT]   ⚡ Encontrada opción: "${text}"`);
            (option as HTMLElement).click();
            return true;
          }
        }
        
        console.warn('[FREKUENT]   ⚠️ No se encontró opción "100 / page"');
        console.warn(`[FREKUENT]   📋 Opciones disponibles: ${options.map(o => o.textContent?.trim()).join(', ')}`);
        return false;
      });
      
      if (optionClicked) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('[FREKUENT] ✅ Tabla configurada para 100 entradas');
      } else {
        console.warn('[FREKUENT] ⚠️ No se pudo seleccionar la opción 100/página');
      }
    } else {
      console.warn('[FREKUENT] ⚠️ No se encontró el selector de paginación');
    }
  } catch (error) {
    console.warn('[FREKUENT] ⚠️ Error configurando paginación:', error);
  }
}

/**
 * Extrae datos de recaudación de la tabla principal
 */
async function extractRevenueData(
  page: Page,
  period: 'daily' | 'monthly'
): Promise<FrekuentMachineRevenueData[]> {
  console.log(`[FREKUENT] 📥 Extrayendo datos de recaudación para periodo: ${period}`);

  // Debug: Verificar estado de la página antes de extraer
  const pageState = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      hasTable: !!document.querySelector('table'),
      hasAntTable: !!document.querySelector('.ant-table'),
      tableCount: document.querySelectorAll('table').length,
      rowCount: document.querySelectorAll('table tbody tr').length,
      bodyText: document.body.textContent?.substring(0, 500)
    };
  });
  
  console.log('[FREKUENT] 🔍 Estado antes de extraer:', {
    url: pageState.url,
    title: pageState.title,
    hasTable: pageState.hasTable,
    tableCount: pageState.tableCount,
    rowCount: pageState.rowCount
  });

  if (!pageState.hasTable && !pageState.hasAntTable) {
    console.error('[FREKUENT] ❌ No hay tabla en la página. Posibles causas:');
    console.error('[FREKUENT]    1. La página no cargó correctamente');
    console.error('[FREKUENT]    2. La navegación falló');
    console.error('[FREKUENT]    3. La sesión expiró');
    console.error(`[FREKUENT]    URL actual: ${pageState.url}`);
    console.error(`[FREKUENT]    Título: ${pageState.title}`);
    console.error(`[FREKUENT]    Texto visible: ${pageState.bodyText?.substring(0, 200)}...`);
    
    return [];
  }

  const data = await page.evaluate((periodParam) => {
    const results: any[] = [];
    
    const table = document.querySelector('table');
    if (!table) {
      console.error('[FREKUENT] ❌ No se encontró la tabla');
      return results;
    }

    const allRows = table.querySelectorAll('tbody tr');
    // Filtrar filas de medida de Ant Design (tienen aria-hidden="true")
    const rows = Array.from(allRows).filter(row => !row.hasAttribute('aria-hidden'));
    
    console.log(`[FREKUENT] 🔍 Encontradas ${rows.length} filas válidas en la tabla (${allRows.length} total)`);
    
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td');
      
      // Estructura actual de Frekuent (abril 2026):
      // Columna 0: Checkbox
      // Columna 1: Dispositivo (POS-5)
      // Columna 2: Nombre (STP 5180 ID: 67909)
      // Columna 3: Ubicación (STP GDRINK)
      // Columna 4: Ventas (134,40 € / 86 transacciones)  ← DATO QUE NECESITAMOS
      // Columna 5: Ventas con tarjeta (67.80 €)
      // Columna 6: Ventas en efectivo (61.80 €)
      // Columna 7: Ventas con app y tag (4.80 €)
      // Columna 8: Última transacción (hoy)
      // Columna 9: Estado (operativo)
      // Columna 10: Botón menú (3 puntos)
      
      if (cells.length < 5) {
        console.warn(`[FREKUENT] ⚠️ Fila ${index} tiene solo ${cells.length} columnas`);
        return;
      }

      const deviceId = cells[1]?.textContent?.trim() || '';
      const machineName = cells[2]?.textContent?.trim() || '';
      const location = cells[3]?.textContent?.trim() || '';
      
      // Extraer valor de ventas: buscar el primer <span> dentro de la celda 4
      // Estructura: <td><div><div><span>134,40</span><span>€</span></div></div></td>
      let ventasText = '0 €';
      const ventasCell = cells[4];
      if (ventasCell) {
        const spans = ventasCell.querySelectorAll('span');
        if (spans.length >= 2) {
          // El primer span tiene el número, el segundo tiene el símbolo €
          const numberText = spans[0].textContent?.trim() || '0';
          const currencyText = spans[1].textContent?.trim() || '€';
          ventasText = `${numberText} ${currencyText}`;
        } else {
          // Fallback: usar todo el texto de la celda
          ventasText = ventasCell.textContent?.trim() || '0 €';
        }
      }
      
      // Debug: loguear primeras 3 filas
      if (index < 3) {
        console.log(`[FREKUENT] 📋 Fila ${index + 1} (${periodParam}):`);
        console.log(`[FREKUENT]    Dispositivo: ${deviceId}`);
        console.log(`[FREKUENT]    Nombre: ${machineName}`);
        console.log(`[FREKUENT]    Ubicación: ${location}`);
        console.log(`[FREKUENT]    Ventas (raw): ${ventasText}`);
      }

      if (machineName) {
        results.push({
          deviceId,
          machineName,
          location,
          ventasText,
          period: periodParam
        });
      }
    });

    console.log(`[FREKUENT] ✅ Procesadas ${results.length} máquinas`);
    return results;
  }, period);

  // Parsear los montos
  const parsedData: FrekuentMachineRevenueData[] = data.map(item => ({
    deviceId: item.deviceId,
    machineName: item.machineName,
    location: item.location,
    totalRevenue: parseEuroAmount(item.ventasText),
    period: period,
    scrapedAt: new Date()
  }));

  console.log(`✅ Extraídos ${parsedData.length} registros de recaudación`);
  
  // Log de samples
  if (parsedData.length > 0) {
    console.log(`\n📊 Samples (primeras 3 máquinas):`);
    parsedData.slice(0, 3).forEach((machine, idx) => {
      console.log(`  ${idx + 1}. ${machine.machineName}`);
      console.log(`     Recaudación: ${machine.totalRevenue} €`);
      console.log(`     Ubicación: ${machine.location}`);
    });
    
    // Calcular total
    const totalRevenue = parsedData.reduce((sum, m) => sum + m.totalRevenue, 0);
    console.log(`\n💰 Recaudación total (${period}): ${totalRevenue.toFixed(2)} €`);
  }
  
  return parsedData;
}

/**
 * Scraper principal de recaudación Frekuent
 */
export async function scrapeFrekuentRevenue(
  credentials: { username: string; password: string },
  period: 'daily' | 'monthly' = 'daily'
): Promise<FrekuentRevenueResult> {
  const startTime = new Date();
  let browser: Browser | null = null;

  try {
    console.log(`🚀 Iniciando scraping de recaudación Frekuent (${period})...`);

    // Lanzar navegador
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // ============================================
    // 1. LOGIN
    // ============================================
    console.log('🔐 Iniciando sesión en Frekuent (via Orain)...');
    
    // Usar la URL de login de Orain que redirige automáticamente a Frekuent
    await page.goto('https://dashboard.orain.io/auth/signin/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Buscar campos de login
    const usernameInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
    const passwordInput = await page.$('input[type="password"], input[name="password"]');

    if (!usernameInput || !passwordInput) {
      throw new Error('No se encontraron los campos de login en Orain');
    }

    await usernameInput.type(credentials.username);
    await passwordInput.type(credentials.password);

    // Click en botón de login
    const loginButton = await page.$('button[type="submit"]');
    if (loginButton) {
      await loginButton.click();
    } else {
      throw new Error('No se encontró el botón de login');
    }

    // Esperar a que se complete el login y redirección a Frekuent
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Login exitoso (redirigido desde Orain a Frekuent)');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ============================================
    // 2. NAVEGAR A PUNTOS DE VENTA
    // ============================================
    console.log('📍 Navegando a Puntos de Venta...');
    
    await page.goto('https://frekuent.io/app/frekuent-spots/points-of-sale', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ En Puntos de Venta');

    // ============================================
    // 3. CONFIGURAR PAGINACIÓN
    // ============================================
    await setTableEntries(page);

    // ============================================
    // 4. CONFIGURAR FILTRO DE FECHA
    // ============================================
    await setDateFilter(page, period);

    // ============================================
    // 5. EXTRAER DATOS
    // ============================================
    const data = await extractRevenueData(page, period);

    await browser.close();

    const duration = ((new Date().getTime() - startTime.getTime()) / 1000).toFixed(2);
    console.log(`\n✅ Scraping de recaudación Frekuent completado en ${duration}s`);
    console.log(`📊 Total: ${data.length} máquinas`);
    console.log(`💰 Recaudación total: ${data.reduce((sum, m) => sum + m.totalRevenue, 0).toFixed(2)} €`);

    return {
      success: true,
      data,
      scrapedAt: new Date(),
      totalMachines: data.length
    };

  } catch (error) {
    console.error('❌ Error en scraping de recaudación Frekuent:', error);

    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      scrapedAt: new Date(),
      totalMachines: 0
    };
  }
}

/**
 * Scraper de recaudación para múltiples periodos
 * OPTIMIZADO: Abre el navegador UNA SOLA VEZ
 */
export async function scrapeFrekuentRevenueMultiple(
  credentials: { username: string; password: string }
): Promise<{
  daily: FrekuentRevenueResult;
  monthly: FrekuentRevenueResult;
}> {
  const startTime = new Date();
  let browser: Browser | null = null;

  try {
    console.log('[FREKUENT] 🚀 Iniciando scraping multi-periodo Frekuent (optimizado)...');

    // ============================================
    // 1. LANZAR NAVEGADOR (UNA SOLA VEZ)
    // ============================================
    console.log('[FREKUENT] 🚀 Lanzando navegador Puppeteer...');
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions'
        ],
        timeout: 60000, // 60 segundos para lanzar el navegador
        protocolTimeout: 60000
      });
      
      console.log('[FREKUENT] ✅ Navegador lanzado correctamente');
    } catch (launchError) {
      console.error('[FREKUENT] ❌ Error lanzando Puppeteer:', launchError);
      console.error('[FREKUENT] 💡 Posibles causas:');
      console.error('[FREKUENT]    1. Chromium no está instalado. Ejecuta: npx puppeteer browsers install chrome');
      console.error('[FREKUENT]    2. Problemas de permisos en el sistema');
      console.error('[FREKUENT]    3. Memoria insuficiente');
      throw launchError;
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // ============================================
    // 2. LOGIN (UNA SOLA VEZ) - DIRECTAMENTE EN FREKUENT
    // ============================================
    console.log('[FREKUENT] 🔐 Iniciando sesión en Frekuent...');
    
    await page.goto('https://frekuent.io/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Debug: Verificar que estamos en la página de login
    const loginPageUrl = page.url();
    const loginPageTitle = await page.title();
    console.log(`[FREKUENT] 📍 Página de login - URL: ${loginPageUrl}`);
    console.log(`[FREKUENT] 📋 Página de login - Título: ${loginPageTitle}`);

    // Buscar campos de login
    // Según el HTML: input#username (name="username", type="text")
    //                input#password (name="password", type="password")
    const usernameInput = await page.$('input[name="username"], input#username, input[type="email"], input[name="email"]');
    const passwordInput = await page.$('input[name="password"], input#password, input[type="password"]');

    if (!usernameInput || !passwordInput) {
      console.error('[FREKUENT] ❌ No se encontraron los campos de login en Frekuent');
      
      // Debug: mostrar todos los inputs
      const allInputs = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          id: input.id,
          name: input.name,
          type: input.type,
          placeholder: input.placeholder
        }));
      });
      console.error('[FREKUENT] 📋 Inputs encontrados:', JSON.stringify(allInputs, null, 2));
      
      throw new Error('No se encontraron los campos de login en Frekuent');
    }

    console.log('[FREKUENT] ✅ Campos de login encontrados');
    console.log(`[FREKUENT] 📝 Ingresando credenciales - username: ${credentials.username}`);
    
    await usernameInput.type(credentials.username);
    await passwordInput.type(credentials.password);

    const loginButton = await page.$('button[type="submit"]');
    if (loginButton) {
      console.log('[FREKUENT] 🔘 Haciendo click en botón de login...');
      await loginButton.click();
    } else {
      throw new Error('No se encontró el botón de login');
    }

    // Esperar redirección después del login en Frekuent
    console.log('[FREKUENT] ⏳ Esperando redirección después del login (8s)...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    const currentUrl = page.url();
    const currentTitle = await page.title();
    console.log(`[FREKUENT] ✅ Login completado`);
    console.log(`[FREKUENT] 📍 URL después del login: ${currentUrl}`);
    console.log(`[FREKUENT] 📋 Título después del login: ${currentTitle}`);

    // ============================================
    // 3. NAVEGAR A PUNTOS DE VENTA (USANDO MENÚ)
    // ============================================
    console.log('[FREKUENT] 📍 Navegando a Puntos de Venta usando menú...');
    
    // Esperar a que cargue la interfaz de Frekuent
    console.log('[FREKUENT] ⏳ Esperando carga de interfaz (5s)...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Debug: Ver qué hay en la página después del login
    const pageDebugInitial = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, div[role="button"], li, nav a'));
      const menuTexts = links
        .map(link => link.textContent?.trim())
        .filter(text => text && text.length > 0 && text.length < 100)
        .slice(0, 30);
      
      return {
        url: window.location.href,
        title: document.title,
        menuItems: menuTexts,
        hasNav: !!document.querySelector('nav'),
        hasSidebar: !!document.querySelector('aside, [class*="sidebar"]')
      };
    });
    
    console.log('[FREKUENT] 🔍 Elementos de menú encontrados:', JSON.stringify(pageDebugInitial.menuItems, null, 2));
    console.log(`[FREKUENT] 📍 URL actual: ${pageDebugInitial.url}`);
    
    // Paso 1: Click en "Frekuent Spots" en el menú lateral
    console.log('[FREKUENT] 🖱️ Paso 1: Buscando menú "Frekuent Spots"...');
    
    const frekuentSpotsResult = await page.evaluate(() => {
      // Buscar elementos que puedan ser el menú "Frekuent Spots"
      const allElements = Array.from(document.querySelectorAll('a, button, div[role="button"], li, nav a, [class*="menu"] a, [class*="nav"] a'));
      
      console.log(`[FREKUENT] [EVAL] Buscando entre ${allElements.length} elementos`);
      
      // Buscar "frekuent" y "spot" en el texto
      for (const elem of allElements) {
        const text = elem.textContent?.trim().toLowerCase() || '';
        
        if ((text.includes('frekuent') && text.includes('spot')) || text === 'frekuent spots') {
          console.log(`[FREKUENT] [EVAL] 🎯 Encontrado: "${elem.textContent?.trim()}"`);
          (elem as HTMLElement).click();
          return { success: true, clickedText: elem.textContent?.trim() };
        }
      }
      
      console.warn('[FREKUENT] [EVAL] ⚠️ No se encontró "Frekuent Spots"');
      return { success: false };
    });
    
    if (!frekuentSpotsResult.success) {
      console.warn('[FREKUENT] ⚠️ No se pudo hacer click en "Frekuent Spots"');
    } else {
      console.log(`[FREKUENT] ✅ Click en "${frekuentSpotsResult.clickedText}"`);
      
      // Esperar a que se expanda el menú (puede ser un acordeón)
      console.log('[FREKUENT] ⏳ Esperando expansión del submenú (4s)...');
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
    
    // Paso 2: Click en "Puntos de venta" en el submenú
    console.log('[FREKUENT] 🖱️ Paso 2: Buscando "Puntos de venta"...');
    
    // Debug: Ver qué elementos hay ahora (debe incluir el submenú expandido)
    const subMenuItems = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, div[role="button"], li'));
      return links
        .map(link => link.textContent?.trim())
        .filter(text => text && text.length > 0 && text.length < 100);
    });
    
    console.log('[FREKUENT] 🔍 Total de elementos clickeables:', subMenuItems.length);
    console.log('[FREKUENT] 🔍 Primeros 50 elementos:', JSON.stringify(subMenuItems.slice(0, 50), null, 2));
    
    const puntosDeVentaResult = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, div[role="button"], li, nav a'));
      
      console.log(`[FREKUENT] [EVAL] Buscando "Puntos de venta" entre ${allElements.length} elementos`);
      
      for (const elem of allElements) {
        const text = elem.textContent?.trim().toLowerCase() || '';
   const href = (elem as HTMLAnchorElement).href || '';
        
        // Buscar coincidencia exacta o parcial con "puntos de venta"
        if (text === 'puntos de venta' || 
            (text.includes('puntos') && text.includes('venta')) ||
            text.includes('points-of-sale') ||
            href.includes('points-of-sale')) {
          console.log(`[FREKUENT] [EVAL] ✅ Click en "${elem.textContent?.trim()}" (href: ${href})`);
          (elem as HTMLElement).click();
          return { success: true, clickedText: elem.textContent?.trim(), href };
        }
      }
      
      console.warn('[FREKUENT] [EVAL] ⚠️ No se encontró "Puntos de venta"');
      
      // Debug: mostrar elementos que contienen "punto" o "venta"
      const related = allElements
        .filter(el => {
          const t = el.textContent?.trim().toLowerCase() || '';
          return t.includes('punto') || t.includes('venta') || t.includes('sale');
        })
        .map(el => ({
          text: el.textContent?.trim(),
          href: (el as HTMLAnchorElement).href || null
        }));
      
      console.log('[FREKUENT] [EVAL] Elementos relacionados con punto/venta:', related);
      
      return { success: false };
    });
    
    if (!puntosDeVentaResult.success) {
      console.warn('[FREKUENT] ⚠️ No se pudo hacer click en "Puntos de venta"');
      console.warn('[FREKUENT] ⚠️ El submenú puede NO haberse expandido correctamente');
      
      // FALLBACK: Intentar navegar directamente por URL
      console.log('[FREKUENT] 🔄 Intentando navegación directa a Puntos de venta...');
      try {
        await page.goto('https://frekuent.io/app/frekuent-spots/points-of-sale', {
          waitUntil: 'domcontentloaded',
          timeout: 20000
        });
        console.log('[FREKUENT] ✅ Navegación directa realizada');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (navError) {
        console.error('[FREKUENT] ❌ Error en navegación directa:', navError);
      }
    } else {
      console.log(`[FREKUENT] ✅ Click en "${puntosDeVentaResult.clickedText}"`);
      if (puntosDeVentaResult.href) {
        console.log(`[FREKUENT] 🔗 URL destino: ${puntosDeVentaResult.href}`);
      }
      
      // Esperar a que cargue la tabla
      console.log('[FREKUENT] ⏳ Esperando carga de tabla (6s)...');
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
    
    // Verificar que llegamos a la página correcta
    const finalUrl = page.url();
    const pageTitle = await page.title();
    console.log(`[FREKUENT] 📍 URL final: ${finalUrl}`);
    console.log(`[FREKUENT] 📋 Título: ${pageTitle}`);
    
    // Debug: Ver qué elementos hay en la página
    const pageDebug = await page.evaluate(() => {
      return {
        hasTable: !!document.querySelector('table'),
        tableCount: document.querySelectorAll('table').length,
        hasLoginForm: !!document.querySelector('input[type="password"]'),
        bodyText: document.body.textContent?.substring(0, 300),
        h1Text: document.querySelector('h1')?.textContent
      };
    });
    
    console.log('[FREKUENT] 🔍 Estado de la página:', JSON.stringify(pageDebug, null, 2));
    
    if (!pageDebug.hasTable) {
      console.error('[FREKUENT] ⚠️ WARNING: No se encontró tabla en la página');
    }
    
    console.log('[FREKUENT] ✅ En Puntos de Venta');

    // ============================================
    // 4. CONFIGURAR PAGINACIÓN 100/PÁGINA (UNA SOLA VEZ)
    // ============================================
    console.log('[FREKUENT] 📊 Configurando paginación a 100/página...');
    await setTableEntries(page);

    // ============================================
    // 5. EXTRAER DATOS "HOY"
    // ============================================
    console.log('[FREKUENT] \n📅 === EXTRAYENDO DATOS: HOY ===');
    await setDateFilter(page, 'daily');
    const dailyData = await extractRevenueData(page, 'daily');

    // ============================================
    // 6. EXTRAER DATOS "ESTE MES"
    // ============================================
    console.log('[FREKUENT] \n📅 === EXTRAYENDO DATOS: ESTE MES ===');
    await setDateFilter(page, 'monthly');
    const monthlyData = await extractRevenueData(page, 'monthly');

    // ============================================
    // 7. CERRAR NAVEGADOR
    // ============================================
    await browser.close();

    const duration = ((new Date().getTime() - startTime.getTime()) / 1000).toFixed(2);
    console.log(`[FREKUENT] \n✅ Scraping multi-periodo completado en ${duration}s`);
    console.log(`[FREKUENT] 📊 Máquinas diarias: ${dailyData.length}`);
    console.log(`[FREKUENT] 💰 Recaudación HOY: ${dailyData.reduce((sum, m) => sum + m.totalRevenue, 0).toFixed(2)} €`);
    console.log(`[FREKUENT] 📊 Máquinas mensuales: ${monthlyData.length}`);
    console.log(`[FREKUENT] 💰 Recaudación MES: ${monthlyData.reduce((sum, m) => sum + m.totalRevenue, 0).toFixed(2)} €`);

    return {
      daily: {
        success: true,
        data: dailyData,
        scrapedAt: new Date(),
        totalMachines: dailyData.length
      },
      monthly: {
        success: true,
        data: monthlyData,
        scrapedAt: new Date(),
        totalMachines: monthlyData.length
      }
    };

  } catch (error) {
    console.error('[FREKUENT] ❌ Error en scraping multi-periodo Frekuent:', error);

    if (browser) {
      await browser.close();
    }

    const errorResult = {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      scrapedAt: new Date(),
      totalMachines: 0
    };

    return {
      daily: errorResult,
      monthly: errorResult
    };
  }
}

/**
 * Función mock para testing sin hacer scraping real
 */
export async function scrapeFrekuentRevenueMock(
  period: 'daily' | 'monthly' = 'daily'
): Promise<FrekuentRevenueResult> {
  console.log(`📦 Usando datos MOCK de recaudación Frekuent (${period})...`);

  await new Promise(resolve => setTimeout(resolve, 1000));

  const mockData: FrekuentMachineRevenueData[] = [
    {
      deviceId: 'POS-5',
      machineName: 'HOTEL SAMOS 5156',
      location: 'HOTEL SAMOS',
      totalRevenue: period === 'daily' ? 3140 : 7120,
      period,
      scrapedAt: new Date()
    },
    {
      deviceId: 'POS-5',
      machineName: 'HEALTHY BODY 5190',
      location: 'TIENDA',
      totalRevenue: period === 'daily' ? 16.90 : 180.50,
      period,
      scrapedAt: new Date()
    },
    {
      deviceId: 'POS-5',
      machineName: 'FIT FACTORY 5151',
      location: 'GIMNASIO FIT FACTORY',
      totalRevenue: period === 'daily' ? 15.00 : 420.00,
      period,
      scrapedAt: new Date()
    }
  ];

  return {
    success: true,
    data: mockData,
    scrapedAt: new Date(),
    totalMachines: mockData.length
  };
}
