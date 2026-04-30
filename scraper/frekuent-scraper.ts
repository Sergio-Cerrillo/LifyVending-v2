/**
 * FREKUENT STOCK SCRAPER
 * 
 * Scraper adaptado para la nueva plataforma Frekuent (anteriormente Orain)
 * 
 * Cambios principales respecto a Orain:
 * - URL base: https://frekuent.io/app/home
 * - Navegación: "Frekuent spots" → "Puntos de venta"
 * - Flujo de stock: Click en máquina → "..." → "Detalles" → Tab "Planograma"
 * - Navegación de retorno: Botón de flecha atrás
 * 
 * Proceso:
 * 1. Login en Frekuent (mismas credenciales que Orain)
 * 2. Navegar a "Puntos de venta"
 * 3. Configurar paginación a 100/página
 * 4. Para cada máquina:
 *    - Seleccionar checkbox
 *    - Click en menú "..." → "Detalles"
 *    - Click en tab "Planograma"
 *    - Configurar paginación a 100/página
 *    - Extraer productos con stock
 *    - Click en botón de retroceso
 * 5. Retornar datos agregados
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import path from 'path';
import os from 'os';
import type { MachineStock, StockProduct } from '@/lib/types';
import { launchBrowser } from './browser-helper';

interface FrekuentConfig {
  user: string;
  pass: string;
  headless: boolean;
}

export class FrekuentScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: FrekuentConfig;
  private paginationConfigured: boolean = false; // Cache para evitar reconfigurar paginación

  constructor(config: FrekuentConfig) {
    this.config = config;
  }

  async initialize() {
    console.log('🚀 Inicializando navegador Frekuent...');
    
    const userDataDir = path.join(os.tmpdir(), 'frekuent-scraper-session');
    
    this.browser = await launchBrowser({
      headless: this.config.headless,
    });

    const sessionPath = path.join(os.tmpdir(), 'frekuent-session.json');
    let storageState = undefined;
    
    try {
      const fs = require('fs').promises;
      const sessionData = await fs.readFile(sessionPath, 'utf-8');
      storageState = JSON.parse(sessionData);
      console.log('📂 Sesión Frekuent cargada desde', sessionPath);
    } catch (error) {
      console.log('🆕 No hay sesión Frekuent guardada, comenzando nueva sesión');
    }
    
    this.context = await this.browser.newContext({
      javaScriptEnabled: true,
      storageState: storageState,
    });
    
    // Configurar timeout global para el context
    this.context.setDefaultTimeout(30000);
    
    // Bloquear recursos innecesarios
    await this.context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2}', route => route.abort());
    
    this.page = await this.context.newPage();
    console.log('✅ Navegador Frekuent inicializado');
  }

  async login() {
    if (!this.page) throw new Error('Page not initialized');

    console.log('🔐 Verificando autenticación en Frekuent...');
    
    // Intentar ir directamente a la app para verificar sesión
    await this.page.goto('https://frekuent.io/app/home', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    
    await this.page.waitForTimeout(2000);
    
    const currentUrl = this.page.url();
    console.log('📍 URL después de navegar:', currentUrl);
    
    // Si no nos redirige al login, ya estamos autenticados
    if (!currentUrl.includes('/login') && !currentUrl.includes('/signin') && !currentUrl.includes('/auth')) {
      const hasAppElements = await this.page.evaluate(() => {
        return !!document.querySelector('body') && 
               window.location.pathname.includes('/app');
      });
      
      if (hasAppElements) {
        console.log('✅ Ya autenticado en Frekuent - usando sesión existente');
        return;
      }
    }
    
    console.log('🔐 Iniciando login en Frekuent (via Orain)...');
    
    // Usar la URL de login de Orain que redirige automáticamente a Frekuent
    await this.page.goto('https://dashboard.orain.io/auth/signin/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    await this.page.waitForTimeout(2000);

    // Esperar campos de login
    try {
      await this.page.waitForSelector('input[type="email"], input[name="email"], input[id*="email"], input[placeholder*="email" i]', { timeout: 15000 });
      await this.page.waitForSelector('input[type="password"], input[name="password"], input[id*="password"]', { timeout: 15000 });
    } catch (error) {
      console.error('❌ No se encontraron campos de login. URL actual:', this.page.url());
      throw new Error('No se encontraron los campos de login en Orain');
    }

    // Rellenar formulario
    await this.page.fill('input[type="email"], input[name="email"], input[id*="email"], input[placeholder*="email" i]', this.config.user);
    await this.page.fill('input[type="password"], input[name="password"], input[id*="password"]', this.config.pass);
    
    console.log('📝 Credenciales ingresadas en Orain, intentando login...');

    // Click en botón de login
    try {
      const submitButton = await this.page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Login"), button:has-text("Entrar"), button:has-text("Acceder")').first();
      await submitButton.click();
    } catch (error) {
      console.error('❌ No se encontró el botón de login en Orain');
      throw new Error('No se pudo hacer click en el botón de login');
    }

    // Esperar a que nos redirija a Frekuent
    console.log('⏳ Esperando redirección a Frekuent...');
    await this.page.waitForTimeout(5000);
    
    const finalUrl = this.page.url();
    console.log('📍 URL final después del login:', finalUrl);
    
    // Verificar que estamos en Frekuent o que el login fue exitoso
    if (finalUrl.includes('frekuent.io') || finalUrl.includes('/app') || finalUrl.includes('/dashboard')) {
      console.log('✅ Login exitoso - redirigido desde Orain a Frekuent');
    } else {
      console.warn('⚠️ URL inesperada después del login:', finalUrl);
    }

    console.log('✅ Login completado en Frekuent (via Orain)');
  }

  async navigateToPointsOfSale() {
    if (!this.page) throw new Error('Page not initialized');

    console.log('📊 Navegando a Puntos de Venta en Frekuent...');
    
    // La URL directa según las capturas es: https://frekuent.io/app/frekuent-spots/points-of-sale
    await this.page.goto('https://frekuent.io/app/frekuent-spots/points-of-sale', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    
    // OPTIMIZACIÓN: Esperar a que la tabla aparezca en lugar de timeout fijo
    await this.page.waitForSelector('table', { timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500); // Reducido de 2000ms a 500ms
    
    console.log('🔄 Verificando que estamos en Puntos de Venta...');
    
    // Verificar que la página cargó correctamente
    const isCorrectPage = await this.page.evaluate(() => {
      // Buscar texto "Puntos de venta" en el título
      const title = document.querySelector('h1, h2, .title, [class*="title"]');
      return title?.textContent?.includes('Puntos de venta') || 
             window.location.pathname.includes('points-of-sale');
    });
    
    if (!isCorrectPage) {
      console.warn('⚠️ No se detectó la página de Puntos de Venta');
      
      // Intentar navegación manual a través del menú
      console.log('🔄 Intentando navegación manual...');
      
      // Click en "Frekuent spots" en el nav
      try {
        await this.page.click('text=Frekuent spots, [href*="frekuent-spots"]');
        await this.page.waitForTimeout(800); // Reducido de 1000ms a 800ms
        
        // Click en "Puntos de venta" en el dropdown
        await this.page.click('text=Puntos de venta, [href*="points-of-sale"]');
        // OPTIMIZACIÓN: Esperar a que aparezca la tabla
        await this.page.waitForSelector('table', { timeout: 3000 }).catch(() => {});
        await this.page.waitForTimeout(500); // Reducido de 2000ms a 500ms
        
        console.log('✅ Navegación manual exitosa');
      } catch (error) {
        console.error('❌ Error en navegación manual:', error);
        throw new Error('No se pudo navegar a Puntos de Venta');
      }
    }
    
    console.log('✅ En página de Puntos de Venta');
  }

  async setTablePagination() {
    if (!this.page) throw new Error('Page not initialized');

    // OPTIMIZACIÓN: Si ya configuramos la paginación antes, no hacerlo de nuevo
    if (this.paginationConfigured) {
      console.log('📊 Paginación ya configurada previamente, omitiendo...');
      return;
    }

    console.log('📊 Configurando paginación a 100/página...');
    
    try {
      // OPTIMIZACIÓN: Reducir espera inicial de 1500ms a 1000ms
      await this.page.waitForTimeout(1000);
      
      // Intentar con Playwright locator primero (más confiable)
      try {
        // Buscar el select de paginación por clase Ant Design
        const paginationSelect = this.page.locator('.ant-pagination-options-size-changer').first();
        const count = await paginationSelect.count();
        
        if (count > 0) {
          console.log('  🔍 Select de paginación encontrado');
          await paginationSelect.click();
          console.log('  ✅ Dropdown de paginación abierto');
          await this.page.waitForTimeout(500); // Reducido de 800ms a 500ms
          
          // Buscar y hacer click en la opción "100 / page"
          const option100 = this.page.locator('[role="option"]').filter({ hasText: '100 / page' }).first();
          const optionCount = await option100.count();
          
          if (optionCount > 0) {
            await option100.click();
            console.log('  ⚡ Click en opción "100 / page"');
            // OPTIMIZACIÓN: Esperar a que la tabla se recargue de forma inteligente
            await this.page.waitForSelector('table tbody tr', { timeout: 3000 }).catch(() => {});
            await this.page.waitForTimeout(500); // Pequeña espera adicional
            console.log('✅ Paginación configurada a 100/página');
            this.paginationConfigured = true; // Marcar como configurada
            return;
          }
        }
      } catch (playwrightError) {
        console.log('  🔄 Método Playwright falló, intentando con JavaScript...');
      }
      
      // Fallback: usar JavaScript evaluate
      const clicked = await this.page.evaluate(() => {
        // Buscar el select de Ant Design por clase
        const paginationSelect = document.querySelector(
          '.ant-pagination-options-size-changer'
        ) as HTMLElement;
        
        if (paginationSelect) {
          paginationSelect.click();
          return true;
        }
        
        return false;
      });
      
      if (clicked) {
        console.log('  ✅ Selector de paginación abierto (JavaScript)');
        await this.page.waitForTimeout(500); // Reducido de 800ms a 500ms
        
        // Hacer click en la opción "100 / page"
        const optionClicked = await this.page.evaluate(() => {
          const options = Array.from(document.querySelectorAll('[role="option"]'));
          
          const option100 = options.find(el => {
            const text = el.textContent?.trim() || '';
            return text === '100 / page' || text.includes('100');
          }) as HTMLElement;
          
          if (option100) {
            option100.click();
            console.log('  ⚡ Click en opción "100 / page"');
            return true;
          }
          
          return false;
        });
        
        if (optionClicked) {
          // OPTIMIZACIÓN: Esperar a que la tabla se recargue de forma inteligente
          await this.page.waitForSelector('table tbody tr', { timeout: 3000 }).catch(() => {});
          await this.page.waitForTimeout(500); // Reducido significativamente
          console.log('✅ Paginación configurada a 100/página');
          this.paginationConfigured = true; // Marcar como configurada
        } else {
          console.warn('⚠️ No se pudo seleccionar la opción 100/página');
        }
      } else {
        console.warn('⚠️ No se encontró el selector de paginación, continuando...');
      }
    } catch (error) {
      console.warn('⚠️ No se pudo cambiar la paginación:', error);
    }
  }

  async getMachineList(): Promise<Array<{ id: string; name: string; rowIndex: number }>> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('📋 Obteniendo lista de máquinas de todas las páginas...');

    // OPTIMIZACIÓN: Esperar a que la tabla cargue de forma inteligente
    await this.page.waitForSelector('table tbody tr', { timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);

    const allMachines: Array<{ id: string; name: string; rowIndex: number }> = [];
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      console.log(`📄 Procesando página ${currentPage}...`);

      // Obtener máquinas de la página actual
      const machines = await this.page.$$eval('table tbody tr', (rows) => {
        return rows
          .filter(row => !row.hasAttribute('aria-hidden')) // Excluir filas ocultas de medida
          .map((row, index) => {
            const cells = row.querySelectorAll('td');
            
            if (cells.length < 2) return null;
            
            const checkbox = row.querySelector('input[type="checkbox"]');
            const deviceCell = cells[1]?.textContent?.trim() || '';
            const nameCell = cells[2]?.textContent?.trim() || '';
            
            const name = nameCell || deviceCell || `Máquina ${index + 1}`;
            const id = checkbox?.getAttribute('id') || checkbox?.getAttribute('value') || `machine-${index}`;
            
            return {
              id,
              name,
              rowIndex: index,
            };
          })
          .filter(Boolean) as Array<{ id: string; name: string; rowIndex: number }>;
      });

      console.log(`  ✅ Encontradas ${machines.length} máquinas en página ${currentPage}`);
      allMachines.push(...machines);

      // Verificar si hay siguiente página
      hasNextPage = await this.page.evaluate(() => {
        // Buscar botón "Siguiente" en la paginación de Ant Design
        const nextButton = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)');
        return nextButton !== null;
      });

      if (hasNextPage) {
        console.log(`  ➡️ Navegando a página ${currentPage + 1}...`);
        
        // Click en botón "Siguiente"
        const clicked = await this.page.evaluate(() => {
          const nextButton = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)') as HTMLElement;
          if (nextButton) {
            nextButton.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          // Esperar a que se cargue la nueva página
          await this.page.waitForTimeout(1000);
          await this.page.waitForSelector('table tbody tr', { timeout: 3000 }).catch(() => {});
          await this.page.waitForTimeout(500);
          currentPage++;
        } else {
          hasNextPage = false;
        }
      }
    }

    console.log(`✅ TOTAL: ${allMachines.length} máquinas encontradas en ${currentPage} página(s)`);
    
    // Reindexar para que tengan índices consecutivos globales
    return allMachines.map((machine, globalIndex) => ({
      ...machine,
      rowIndex: globalIndex,
      originalPage: Math.floor(globalIndex / 100) + 1 // Calcular página original
    }));
  }

  async extractProductsForMachine(machine: { id: string; name: string; rowIndex: number }): Promise<MachineStock> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`📦 Extrayendo productos para ${machine.name}...`);

    try {
      // OPTIMIZACIÓN: Reducir espera inicial de 500ms a 200ms
      await this.page.waitForTimeout(200);
      
      // Paso 1: Click en el menú "..." (tres puntos) - DIRECTO, sin checkbox
      console.log(`  🔘 Buscando menú de opciones...`);
      
      const menuClicked = await this.page.evaluate((rowIndex) => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        // Filtrar filas de medida (aria-hidden="true")
        const actualRows = rows.filter(row => !row.hasAttribute('aria-hidden'));
        const row = actualRows[rowIndex];
        
        if (!row) {
          console.warn('  ⚠️ Fila no encontrada:', rowIndex);
          return false;
        }
        
        // Buscar el botón de menú en la última columna (fix-right)
        const menuButton = row.querySelector('.ant-table-cell-fix-right button, td:last-child button, button:has(svg)');
        
        if (menuButton && menuButton instanceof HTMLElement) {
          console.log('  ⚡ Click en botón de menú');
          menuButton.click();
          return true;
        }
        
        console.warn('  ⚠️ Botón de menú no encontrado');
        return false;
      }, machine.rowIndex);
      
      if (!menuClicked) {
        console.warn(`⚠️ No se encontró el menú de opciones para ${machine.name}`);
        return { machineId: machine.id, machineName: machine.name, products: [], scrapedAt: new Date() };
      }
      
      await this.page.waitForTimeout(1000);
      
      // Paso 2: Click en "Detalles" usando Playwright locator
      console.log(`  📄 Haciendo click en "Detalles"...`);
      
      try {
        // Intentar con Playwright locator
        const detailsButton = this.page.locator('[role="menuitem"], button, a').filter({ hasText: 'Detalles' }).first();
        const count = await detailsButton.count();
        
        if (count > 0) {
          await detailsButton.click();
        } else {
          // Fallback con evaluate
          await this.page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('[role="menuitem"], button, a'));
            const detailsEl = elements.find(el => el.textContent?.includes('Detalles')) as HTMLElement;
            if (detailsEl) detailsEl.click();
          });
        }
        
        // OPTIMIZACIÓN: Esperar a que cargue la página de detalles de forma inteligente
        // En lugar de 2500ms fijo, esperar a que aparezcan los tabs (máximo 3s)
        await this.page.waitForSelector('[role="tab"], .ant-tabs-tab', { timeout: 3000 }).catch(() => {});
        await this.page.waitForTimeout(500); // Pequeña espera adicional para renderizado
        console.log(`  ✅ Navegado a detalles de ${machine.name}`);
      } catch (error) {
        console.error(`  ❌ Error haciendo click en Detalles:`, error);
        return { machineId: machine.id, machineName: machine.name, products: [], scrapedAt: new Date() };
      }
      
      
      // Paso 3: Esperar a que cargue la página de detalles y hacer click en tab "Planograma"
      console.log(`  📋 Buscando tab "Planograma"...`);
      
      try {
        // OPTIMIZACIÓN: Reducir espera de 2000ms a 800ms
        await this.page.waitForTimeout(800);
        
        // Intentar con Playwright locator primero
        const planogramTab = this.page.locator('[role="tab"], button, a').filter({ hasText: 'Planograma' }).first();
        const tabCount = await planogramTab.count();
        
        if (tabCount > 0) {
          await planogramTab.click();
          console.log(`  ✅ Tab "Planograma" seleccionado (Playwright)`);
        } else {
          // Fallback con JavaScript
          const clicked = await this.page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('[role="tab"], button, a'));
            const planogramTab = tabs.find(el => el.textContent?.includes('Planograma')) as HTMLElement;
            if (planogramTab) {
              planogramTab.click();
              return true;
            }
            return false;
          });
          
          if (clicked) {
            console.log(`  ✅ Tab "Planograma" seleccionado (JavaScript)`);
          } else {
            throw new Error('No se encontró tab Planograma');
          }
        }
        
        // OPTIMIZACIÓN: Esperar a que aparezca la tabla de productos en lugar de timeout fijo
        await this.page.waitForSelector('table tbody tr', { timeout: 3000 }).catch(() => {});
        await this.page.waitForTimeout(300); // Pequeña espera para renderizado completo
      } catch (error) {
        console.error(`  ❌ Error seleccionando tab Planograma:`, error);
        await this.navigateBackToList();
        return { machineId: machine.id, machineName: machine.name, products: [], scrapedAt: new Date() };
      }
      
      // Paso 5: Configurar paginación de la tabla de productos a 100/página
      console.log(`  ⚙️ Configurando paginación a 100 items/página...`);
      try {
        // Esperar a que la paginación esté visible
        await this.page.waitForSelector('.ant-pagination-options-size-changer', { timeout: 5000 }).catch(() => null);
        await this.page.waitForTimeout(500);
        
        // Usar Playwright para hacer click en el selector de paginación
        try {
          await this.page.click('.ant-pagination-options-size-changer .ant-select-selector');
          console.log(`  🔽 Click en selector de paginación`);
          
          // Esperar a que aparezcan las opciones del dropdown
          await this.page.waitForSelector('[role="option"]', { timeout: 3000 });
          await this.page.waitForTimeout(500);
          
          // Buscar y hacer click en la opción "100 / page"
          const option100Clicked = await this.page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('[role="option"]'));
            const option100 = options.find(opt => {
              const text = opt.textContent || '';
              return text.includes('100') && text.includes('page');
            });
            
            if (option100 instanceof HTMLElement) {
              option100.click();
              console.log('  ✅ Click en opción "100 / page"');
              return true;
            }
            return false;
          });
          
          if (option100Clicked) {
            console.log(`  ✅ Paginación configurada a 100 items/página`);
            // Esperar a que se recargue la tabla con todos los productos
            await this.page.waitForTimeout(2000);
            
            // Verificar que se haya recargado esperando cambios en la tabla
            await this.page.waitForSelector('table tbody tr', { timeout: 3000 }).catch(() => null);
          } else {
            console.log(`  ⚠️ No se encontró opción "100 / page", usando paginación actual (10 items)`);
          }
        } catch (clickError) {
          console.log(`  ⚠️ Error haciendo click en selector de paginación:`, clickError);
          console.log(`  ⚠️ Usando paginación predeterminada (10 items)`);
        }
      } catch (error) {
        console.log(`  ⚠️ Selector de paginación no encontrado, usando paginación actual`);
        // Si falla, continuar normalmente - no es crítico
      }
      
      // Paso 6: Extraer productos de la tabla de planograma
      console.log(`  📊 Extrayendo productos...`);
      
      const products = await this.page.$$eval('table tbody tr', (rows) => {
        return rows.map((row) => {
          const cells = row.querySelectorAll('td');
          
          // Según las capturas del planograma:
          // Columna 0: Checkbox
          // Columna 1: Número Rail (2, 4, 6, 8, etc.)
          // Columna 2: Número Rail MDB (-)
          // Columna 3: Nombre producto (DORITOS, CHUCHES, etc.)
          // Columna 4: Categoría (Snacks, Otros, etc.)
          // Columna 5: Precio (2,40 €, 2,00 €, etc.)
          // Columna 6: Porcentaje de stock (6/6, 5/6, 4/6 - visual con barra)
          // Columna 7: Estado (Activo)
          
          if (cells.length < 6) return null;
          
          const line = cells[1]?.textContent?.trim() || '';
          const name = cells[3]?.textContent?.trim() || '';
          const category = cells[4]?.textContent?.trim() || '';
          const stockText = cells[6]?.textContent?.trim() || '0/0';
          
          if (!name) return null;
          
          // Parsear stock "6/6" o "4/6"
          const stockMatch = stockText.match(/(\d+)\/(\d+)/);
          const availableUnits = stockMatch ? parseInt(stockMatch[1], 10) : 0;
          const totalCapacity = stockMatch ? parseInt(stockMatch[2], 10) : 0;
          const unitsToReplenish = Math.max(0, totalCapacity - availableUnits);
          
          return {
            name,
            category: category || undefined,
            totalCapacity,
            availableUnits,
            unitsToReplenish,
            line: line || undefined,
          };
        }).filter(Boolean) as StockProduct[];
      });
      
      console.log(`  ✅ Extraídos ${products.length} productos de ${machine.name}`);
      
      // Paso 7: Navegar de vuelta al listado
      await this.navigateBackToList();
      
      return {
        machineId: machine.id,
        machineName: machine.name,
        products,
        scrapedAt: new Date(),
      };
      
    } catch (error) {
      console.error(`❌ Error extrayendo productos para ${machine.name}:`, error);
      
      // Intentar volver al listado
      await this.navigateBackToList().catch(() => {});
      
      return {
        machineId: machine.id,
        machineName: machine.name,
        products: [],
        scrapedAt: new Date(),
      };
    }
  }

  async navigateBackToList() {
    if (!this.page) return;
    
    console.log(`  ⬅️ Navegando de vuelta al listado...`);
    
    try {
      // Buscar el botón de flecha atrás (según las capturas, está a la izquierda del nombre)
      const backClicked = await this.page.evaluate(() => {
        // Buscar botón con icono de flecha atrás
        const backButton = Array.from(document.querySelectorAll('button, a, [role="button"]'))
          .find(el => {
            const hasBackIcon = el.querySelector('svg[class*="arrow"], [class*="back"], [class*="left"]');
            const hasBackText = el.textContent?.toLowerCase().includes('volver') || 
                                el.textContent?.toLowerCase().includes('atrás');
            return hasBackIcon || hasBackText;
          });
        
        if (backButton && backButton instanceof HTMLElement) {
          backButton.click();
          return true;
        }
        
        return false;
      });
      
      if (backClicked) {
        // OPTIMIZACIÓN: Esperar a que aparezca la tabla del listado en lugar de timeout fijo
        await this.page.waitForSelector('table tbody tr', { timeout: 2500 }).catch(() => {});
        await this.page.waitForTimeout(300); // Pequeña espera adicional
        console.log(`  ✅ Vuelta al listado exitosa`);
      } else {
        // Fallback: navegar directamente a la URL
        await this.page.goto('https://frekuent.io/app/frekuent-spots/points-of-sale', {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await this.page.waitForTimeout(800); // Reducido de 2000ms a 800ms
        console.log(`  ✅ Vuelta al listado por URL`);
      }
    } catch (error) {
      console.error(`  ❌ Error navegando de vuelta:`, error);
      
      // Último intento: reload de la página principal
      try {
        await this.page.goto('https://frekuent.io/app/frekuent-spots/points-of-sale', {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await this.page.waitForTimeout(800); // Reducido de 2000ms a 800ms
      } catch (e) {
        console.error(`  ❌ No se pudo volver al listado`);
      }
    }
  }

  async scrapeAllMachines(onProgress?: (current: number, total: number, machineName: string) => void): Promise<MachineStock[]> {
    const startTime = Date.now();
    
    await this.initialize();
    await this.login();
    await this.navigateToPointsOfSale();
    await this.setTablePagination();

    const results: MachineStock[] = [];
    let currentPage = 1;
    let hasNextPage = true;
    let totalProcessed = 0;

    // Primero, contar el total de máquinas en todas las páginas
    console.log('📊 Contando total de máquinas...');
    const totalMachines = await this.countTotalMachines();
    console.log(`📊 Total de máquinas a procesar: ${totalMachines}`);

    // Procesar página por página
    while (hasNextPage) {
      console.log(`\n📄 Procesando página ${currentPage}...`);

      // Obtener máquinas de la página actual
      const machines = await this.page!.$$eval('table tbody tr', (rows) => {
        return rows
          .filter(row => !row.hasAttribute('aria-hidden'))
          .map((row, index) => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return null;
            
            const checkbox = row.querySelector('input[type="checkbox"]');
            const deviceCell = cells[1]?.textContent?.trim() || '';
            const nameCell = cells[2]?.textContent?.trim() || '';
            
            const name = nameCell || deviceCell || `Máquina ${index + 1}`;
            const id = checkbox?.getAttribute('id') || checkbox?.getAttribute('value') || `machine-${index}`;
            
            return { id, name, rowIndex: index };
          })
          .filter(Boolean) as Array<{ id: string; name: string; rowIndex: number }>;
      });

      console.log(`  ✅ ${machines.length} máquinas en página ${currentPage}`);

      // Procesar cada máquina de esta página
      for (let i = 0; i < machines.length; i++) {
        const machine = machines[i];
        totalProcessed++;
        
        if (onProgress) {
          onProgress(totalProcessed, totalMachines, machine.name);
        }

        try {
          const stock = await this.extractProductsForMachine(machine);
          results.push(stock);
        } catch (error) {
          console.error(`❌ Error extrayendo ${machine.name}:`, error);
          results.push({
            machineId: machine.id,
            machineName: machine.name,
            products: [],
            scrapedAt: new Date(),
          });
        }

        // Después de procesar cada máquina, nos aseguramos de volver al listado
        // (esto ya lo hace extractProductsForMachine)
      }

      // Verificar si hay siguiente página
      hasNextPage = await this.page!.evaluate(() => {
        const nextButton = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)');
        return nextButton !== null;
      });

      if (hasNextPage) {
        console.log(`  ➡️ Navegando a página ${currentPage + 1}...`);
        
        const clicked = await this.page!.evaluate(() => {
          const nextButton = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)') as HTMLElement;
          if (nextButton) {
            nextButton.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          await this.page!.waitForTimeout(1000);
          await this.page!.waitForSelector('table tbody tr', { timeout: 3000 }).catch(() => {});
          await this.page!.waitForTimeout(500);
          currentPage++;
        } else {
          hasNextPage = false;
        }
      }
    }

    await this.close();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Scraping de Frekuent completado en ${duration}s`);
    console.log(`📊 Total: ${results.length} máquinas en ${currentPage} página(s), ${results.reduce((sum, m) => sum + m.products.length, 0)} productos`);

    return results;
  }

  async countTotalMachines(): Promise<number> {
    if (!this.page) throw new Error('Page not initialized');

    let total = 0;
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const countInPage = await this.page.$$eval('table tbody tr', (rows) => {
        return rows.filter(row => !row.hasAttribute('aria-hidden')).length;
      });
      
      total += countInPage;

      hasNextPage = await this.page.evaluate(() => {
        const nextButton = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)');
        return nextButton !== null;
      });

      if (hasNextPage) {
        const clicked = await this.page.evaluate(() => {
          const nextButton = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)') as HTMLElement;
          if (nextButton) {
            nextButton.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          await this.page.waitForTimeout(1000);
          await this.page.waitForSelector('table tbody tr', { timeout: 3000 }).catch(() => {});
          await this.page.waitForTimeout(500);
          currentPage++;
        } else {
          hasNextPage = false;
        }
      }
    }

    // Volver a la primera página
    await this.page.goto('https://frekuent.io/app/frekuent-spots/points-of-sale', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await this.page.waitForTimeout(1000);
    await this.setTablePagination();

    return total;
  }

  async close() {
    if (this.browser) {
      try {
        const sessionPath = path.join(os.tmpdir(), 'frekuent-session.json');
        if (this.context) {
          const storageState = await this.context.storageState();
          await require('fs').promises.writeFile(sessionPath, JSON.stringify(storageState));
          console.log('💾 Sesión Frekuent guardada');
        }
      } catch (error) {
        console.log('⚠️ No se pudo guardar la sesión Frekuent:', error);
      }
      
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      console.log('🔒 Navegador Frekuent cerrado');
    }
  }
}
