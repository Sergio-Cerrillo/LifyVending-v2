import { chromium, Browser, Page, BrowserContext } from 'playwright';
import path from 'path';
import os from 'os';
import type { MachineStock, StockProduct } from '@/lib/types';

interface OrainConfig {
  user: string;
  pass: string;
  headless: boolean;
}

export class OrainScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: OrainConfig;

  constructor(config: OrainConfig) {
    this.config = config;
  }

  async initialize() {
    console.log('🚀 Inicializando navegador...');
    
    // Usar un directorio persistente para guardar la sesión
    const userDataDir = path.join(os.tmpdir(), 'orain-scraper-session');
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-images',
        '--disable-fonts',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    // Usar contexto persistente para mantener sesión entre ejecuciones
    const sessionPath = path.join(os.tmpdir(), 'orain-session.json');
    let storageState = undefined;
    
    try {
      const fs = require('fs').promises;
      const sessionData = await fs.readFile(sessionPath, 'utf-8');
      storageState = JSON.parse(sessionData);
      console.log('📂 Sesión anterior cargada desde', sessionPath);
    } catch (error) {
      console.log('🆕 No hay sesión guardada, comenzando nueva sesión');
    }
    
    this.context = await this.browser.newContext({
      // Deshabilitar JavaScript innecesario
      javaScriptEnabled: true,
      // Timeout global reducido
      timeout: 30000,
      // Cargar cookies y estado de sesión si existe
      storageState: storageState,
    });
    
    // Bloquear recursos innecesarios para mayor velocidad
    await this.context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,css}', route => route.abort());
    
    this.page = await this.context.newPage();
    console.log('✅ Navegador inicializado');
  }

  async login() {
    if (!this.page) throw new Error('Page not initialized');

    console.log('🔐 Verificando autenticación...');
    
    // Primero intentar ir directamente al stock para ver si ya está logueado
    // (más directo que dashboard home)
    await this.page.goto('https://dashboard.orain.io/dashboard/data/stock/', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    
    // Esperar un poco para que la página procese la redirección si no está logueado
    await this.page.waitForTimeout(2000);
    
    const currentUrl = this.page.url();
    console.log('📍 URL después de navegar:', currentUrl);
    
    // Si no nos redirige al login, ya estamos autenticados
    if (!currentUrl.includes('/signin') && !currentUrl.includes('/login') && !currentUrl.includes('/auth/')) {
      // Verificar que realmente estamos en la página correcta
      const hasStockElements = await this.page.evaluate(() => {
        return !!document.querySelector('#table-stock') || 
               !!document.querySelector('body');
      });
      
      if (hasStockElements || currentUrl.includes('/stock')) {
        console.log('✅ Ya autenticado - usando sesión existente');
        return;
      }
    }
    
    console.log('🔐 Iniciando login...');
    
    // Verificar que estamos en la página de login
    if (!currentUrl.includes('/signin') && !currentUrl.includes('/login')) {
      await this.page.goto('https://dashboard.orain.io/auth/signin/', {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
    }

    // Esperar a que aparezcan los campos de login
    try {
      await this.page.waitForSelector('input[type="email"], input[name="email"], input[id*="email"]', { timeout: 15000 });
      await this.page.waitForSelector('input[type="password"], input[name="password"], input[id*="password"]', { timeout: 15000 });
    } catch (error) {
      console.error('❌ No se encontraron campos de login. URL actual:', this.page.url());
      throw new Error('No se encontraron los campos de login. La página puede haber cambiado.');
    }

    // Rellenar el formulario de login
    await this.page.fill('input[type="email"], input[name="email"], input[id*="email"]', this.config.user);
    await this.page.fill('input[type="password"], input[name="password"], input[id*="password"]', this.config.pass);
    
    console.log('📝 Credenciales ingresadas, intentando login...');

    // Click en botón de login
    try {
      const submitButton = await this.page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Login"), button:has-text("Entrar")').first();
      await submitButton.click();
    } catch (error) {
      console.error('❌ No se encontró el botón de login');
      throw new Error('No se pudo hacer click en el botón de login');
    }

    // Esperar a que la URL cambie o que aparezca contenido del dashboard
    try {
      await this.page.waitForURL('**/dashboard/**', { timeout: 30000 });
      console.log('✅ Login exitoso - URL cambiada');
    } catch (e) {
      // Si no cambia la URL, esperar por algún texto o elemento que indique que estamos en el dashboard
      try {
        await this.page.waitForSelector('text=Stock, text=Datos, a[href*="/dashboard/data"]', { timeout: 30000 });
        console.log('✅ Login exitoso - Dashboard cargado');
      } catch (e2) {
        // Último intento: esperar un poco y verificar si ya no estamos en la página de login
        await this.page.waitForTimeout(3000);
        const url = this.page.url();
        if (!url.includes('/signin') && !url.includes('/login')) {
          console.log('✅ Login exitoso - Salimos de la página de login');
        } else {
          throw new Error('No se pudo completar el login. Verifica las credenciales.');
        }
      }
    }

    console.log('✅ Login completado');
  }

  async navigateToStock() {
    if (!this.page) throw new Error('Page not initialized');

    console.log('📊 Navegando a Stock...');
    
    // Sistema de reintentos para errores temporales del servidor
    const maxRetries = 3;
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const waitTime = attempt * 2000; // 2s, 4s
          console.log(`⏳ Reintento ${attempt + 1}/${maxRetries} en ${waitTime}ms...`);
          await this.page.waitForTimeout(waitTime);
        }
        
        // Navegar a la página de stock con espera de red estable
        await this.page.goto('https://dashboard.orain.io/dashboard/data/stock/', {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
        
        const currentUrl = this.page.url();
        console.log('🔄 Página cargada. URL actual:', currentUrl);
        
        // Verificar si es una página de error de Cloudflare
        const pageTitle = await this.page.title();
        if (pageTitle.includes('502') || pageTitle.includes('503') || pageTitle.includes('Bad gateway')) {
          throw new Error(`Error del servidor: ${pageTitle}. El servidor de Orain puede estar temporalmente caído.`);
        }
        
        // Si llegamos aquí sin error, salimos del loop
        break;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries - 1) {
          // Último intento falló
          console.error(`❌ Todos los ${maxRetries} intentos fallaron`);
          throw new Error(`Error persistente accediendo a Stock después de ${maxRetries} intentos: ${lastError.message}`);
        }
        
        console.warn(`⚠️ Intento ${attempt + 1} falló:`, (error as Error).message);
      }
    }
    
    const currentUrl = this.page.url();
    console.log('🔄 URL verificada:', currentUrl);
    
    // Verificar si fuimos redirigidos al login
    if (currentUrl.includes('/signin') || currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      console.error('❌ Redirigido al login! La sesión expiró o no era válida');
      console.log('🔐 Intentando login completo...');
      
      // Hacer login completo
      await this.page.fill('input[type="email"], input[name="email"], input[id*="email"]', this.config.user);
      await this.page.fill('input[type="password"], input[name="password"], input[id*="password"]', this.config.pass);
      
      const submitButton = await this.page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Login"), button:has-text("Entrar")').first();
      await submitButton.click();
      
      // Esperar a que termine el login
      await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await this.page.waitForTimeout(2000);
      
      // Volver a intentar ir a stock
      await this.page.goto('https://dashboard.orain.io/dashboard/data/stock/', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      
      console.log('✅ Login completado, reintentando acceso a Stock');
    }
    
    console.log('🔄 Verificando tabla...');
    
    // Una sola limpieza rápida de modales si existen
    await this.closeSweetAlertModalFast();
    
    // Verificar si la tabla existe en el DOM con diagnóstico extensivo
    const debugInfo = await this.page.evaluate(() => {
      const table = document.querySelector('#table-stock');
      const body = document.querySelector('body');
      const tables = Array.from(document.querySelectorAll('table'));
      
      return {
        tableExists: !!table,
        bodyClass: body?.className || '',
        modalsCount: document.querySelectorAll('.swal2-container').length,
        title: document.title,
        bodyText: body?.innerText?.substring(0, 200) || '',
        tables: tables.map(t => ({
          id: t.id,
          classes: t.className,
          rows: t.querySelectorAll('tbody tr').length
        }))
      };
    });
    
    console.log('🔍 Debug Info:', JSON.stringify(debugInfo, null, 2));
    
    if (!debugInfo.tableExists) {
      console.error('❌ La tabla #table-stock NO existe en el DOM');
      console.log('📄 Título de página:', debugInfo.title);
      console.log('📝 Contenido inicial:', debugInfo.bodyText);
      
      throw new Error('La tabla #table-stock no está presente en el DOM. Puede que la página haya cambiado.');
    }
    
    // Esperar a que la tabla esté visible y tenga contenido
    await this.page.waitForFunction(() => {
      const table = document.querySelector('#table-stock');
      const rows = document.querySelectorAll('#table-stock tbody tr');
      return table && 
             window.getComputedStyle(table).display !== 'none' &&
             rows.length > 0;
    }, { timeout: 20000 });

    console.log('✅ En página de Stock con tabla cargada');
  }

  async getMachineList(): Promise<Array<{ id: string; name: string; selector: string }>> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('📋 Obteniendo lista de máquinas...');

    // Cambiar a mostrar 100 máquinas usando el selector específico de la tabla de stock
    try {
      await this.page.selectOption('select[name="table-stock_length"]', '100');
      // Esperar a que la tabla se actualice observando cambios en el DOM
      await this.page.waitForFunction(() => {
        const rows = document.querySelectorAll('#table-stock tbody tr');
        return rows.length > 10; // Asumimos que hay más de 10 máquinas
      }, { timeout: 5000 }).catch(() => {});
    } catch (error) {
      console.warn('⚠️  No se pudo cambiar el selector de cantidad de máquinas');
    }

    // Obtener todas las filas de máquinas de la tabla de stock
    const machines = await this.page.$$eval('#table-stock tbody tr', (rows) => {
      return rows.map((row, index) => {
        const cells = row.querySelectorAll('td');
        const checkbox = row.querySelector('input[type="checkbox"]');
        
        if (!checkbox) return null;
        
        const checkboxId = checkbox.getAttribute('id') || '';
        const name = cells[1]?.textContent?.trim() || `Máquina ${index + 1}`;
        
        // Solo incluir máquinas con ID válido
        if (!checkboxId) return null;
        
        return {
          id: checkboxId,
          name,
          selector: `#${checkboxId}`,
        };
      }).filter(Boolean) as Array<{ id: string; name: string; selector: string }>;
    });

    console.log(`✅ Encontradas ${machines.length} máquinas`);
    
    if (machines.length === 0) {
      console.warn('⚠️  ADVERTENCIA: No se encontraron máquinas en la tabla');
      // Log DOM info para debugging
      const debugInfo = await this.page.evaluate(() => {
        const table = document.querySelector('#table-stock');
        const rows = document.querySelectorAll('#table-stock tbody tr');
        return {
          tableExists: !!table,
          rowCount: rows.length,
          bodyHTML: table?.querySelector('tbody')?.innerHTML.substring(0, 500),
        };
      });
      console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
    }
    
    return machines;
  }

  /**
   * Cierra cualquier modal de SweetAlert2 de forma ultrarrápida
   */
  async closeSweetAlertModalFast(): Promise<void> {
    if (!this.page) return;
    
    try {
      // Un solo intento rápido - remover directamente del DOM
      await this.page.evaluate(() => {
        const modal = document.querySelector('.swal2-container');
        if (modal) {
          modal.remove();
          const backdrop = document.querySelector('.swal2-backdrop-show');
          if (backdrop) backdrop.remove();
          // Limpiar estilos del body que SweetAlert pueda haber añadido
          document.body.classList.remove('swal2-shown', 'swal2-height-auto');
          document.body.style.removeProperty('overflow');
          document.body.style.removeProperty('padding-right');
        }
      });
    } catch (error) {
      // Ignorar errores
    }
  }

  async extractProductsForMachine(machine: { id: string; name: string; selector: string }): Promise<MachineStock> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`📦 Extrayendo productos para ${machine.name}...`);

    // Esperar un poco antes de hacer click para asegurar que la página esté estable
    await this.page.waitForTimeout(150);

    // Estrategia optimizada: click directo por JavaScript (más rápido y confiable)
    try {
      // Cerrar modal solo si existe (operación ultra-rápida)
      await this.closeSweetAlertModalFast();
      
      // Click directo por JavaScript - bypass completo de Playwright
      const clicked = await this.page.evaluate((selector) => {
        const checkbox = document.querySelector(selector) as HTMLInputElement;
        if (checkbox) {
          checkbox.click();
          return true;
        }
        return false;
      }, machine.selector);
      
      if (!clicked) {
        throw new Error(`No se encontró el checkbox ${machine.selector}`);
      }
      
      // Esperar un poco después del click para que la tabla empiece a cargar
      await this.page.waitForTimeout(300);
    } catch (error) {
      console.error(`❌ Error haciendo click en ${machine.name}:`, error);
      throw error;
    }
    
    // Esperar tabla de productos con timeout y verificación de contenido real
    try {
      await this.page.waitForFunction(() => {
        const rows = document.querySelectorAll('#table-product tbody tr');
        // Debe tener al menos 1 fila Y no debe ser el mensaje de "no hay datos"
        if (rows.length === 0) return false;
        
        // Verificar que no sea la fila de "no hay datos"
        const firstRow = rows[0] as HTMLTableRowElement;
        const cells = firstRow.querySelectorAll('td');
        
        // Si solo hay 1 celda con colspan, es el mensaje de "no hay datos"
        if (cells.length === 1) {
          const cellText = cells[0].textContent?.toLowerCase() || '';
          if (cellText.includes('no hay datos') || 
              cellText.includes('no data') ||
              cellText.includes('no results') ||
              cellText.includes('sin datos')) {
            return false; // No hay productos reales
          }
        }
        
        // Verificar que tenga al menos 5 celdas (producto válido)
        return cells.length >= 5;
      }, { timeout: 4000 }); // Aumentado a 4 segundos
    } catch (error) {
      console.warn(`⚠️  Timeout o sin productos válidos para ${machine.name}`);
      
      // Verificar qué hay realmente en la tabla
      const tableInfo = await this.page.evaluate(() => {
        const table = document.querySelector('#table-product');
        const rows = document.querySelectorAll('#table-product tbody tr');
        
        if (rows.length === 0) {
          return { hasRows: false, rowCount: 0 };
        }
        
        const firstRow = rows[0];
        const cells = firstRow.querySelectorAll('td');
        const cellTexts = Array.from(cells).map(c => c.textContent?.trim());
        
        return {
          hasRows: true,
          rowCount: rows.length,
          cellCount: cells.length,
          cellTexts: cellTexts,
          tableVisible: table ? getComputedStyle(table).display !== 'none' : false,
        };
      });
      
      console.log(`  📋 Contenido tabla ${machine.name}:`, JSON.stringify(tableInfo, null, 2));
      
      // Deseleccionar por JavaScript
      await this.page.evaluate((selector) => {
        const checkbox = document.querySelector(selector) as HTMLInputElement;
        if (checkbox) checkbox.click();
      }, machine.selector);
      
      return { machineId: machine.id, machineName: machine.name, products: [], scrapedAt: new Date() };
    }

    // Cambiar a 100 productos de forma optimizada
    try {
      await this.page.evaluate(() => {
        const select = document.querySelector('select[name="table-product_length"]') as HTMLSelectElement;
        if (select && select.value !== '100') {
          select.value = '100';
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      });
      // Esperar a que la tabla se actualice si se cambió el selector
      await this.page.waitForTimeout(400);
    } catch (e) {
      // Continuar sin cambiar el selector
    }

    // Extraer productos de la tabla específica de productos
    const extractionResult = await this.page.$$eval('#table-product tbody tr', (rows) => {
      let skippedRows = 0;
      const products = rows.map((row) => {
        const cells = row.querySelectorAll('td');
        
        // Si solo hay 1 celda, es el mensaje de "no hay datos"
        if (cells.length === 1) {
          const cellText = cells[0].textContent?.toLowerCase() || '';
          if (cellText.includes('no hay datos') || 
              cellText.includes('no data') ||
              cellText.includes('no results') ||
              cellText.includes('sin datos')) {
            skippedRows++;
            return null;
          }
        }
        
        // Necesitamos al menos 5 celdas: line, name, category, totalCapacity, availableUnits
        if (cells.length < 5) {
          skippedRows++;
          return null;
        }

        const line = cells[0]?.textContent?.trim() || '';
        const name = cells[1]?.textContent?.trim() || '';
        const category = cells[2]?.textContent?.trim() || '';
        
        // Si no hay nombre de producto, no es válido
        if (!name) {
          skippedRows++;
          return null;
        }
        
        // Parsear capacidad total y unidades disponibles con manejo robusto
        const totalCapacityStr = cells[3]?.textContent?.trim() || '0';
        const availableUnitsStr = cells[4]?.textContent?.trim() || '0';
        
        const totalCapacity = parseInt(totalCapacityStr, 10) || 0;
        const availableUnits = parseInt(availableUnitsStr, 10) || 0;
        
        // Calcular unidades a reponer
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
      
      return { products, skippedRows, totalRows: rows.length };
    });
    
    const products = extractionResult.products;
    
    if (extractionResult.skippedRows > 0 && extractionResult.totalRows === extractionResult.skippedRows) {
      console.log(`  ℹ️  Máquina sin productos: ${machine.name}`);
    } else if (extractionResult.skippedRows > 0) {
      console.log(`  ⚠️  ${extractionResult.skippedRows} filas omitidas de ${extractionResult.totalRows} totales para ${machine.name}`);
    }

    // Deseleccionar la máquina por JavaScript (más rápido)
    await this.page.evaluate((selector) => {
      const checkbox = document.querySelector(selector) as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        checkbox.click();
      }
    }, machine.selector);
    
    // Esperar activamente a que la tabla se limpie o muestre "no hay datos"
    try {
      await this.page.waitForFunction(() => {
        const rows = document.querySelectorAll('#table-product tbody tr');
        if (rows.length === 0) return true;
        
        // Verificar si es el mensaje de "no hay datos"
        if (rows.length === 1) {
          const cells = rows[0].querySelectorAll('td');
          if (cells.length === 1) {
            const cellText = cells[0].textContent?.toLowerCase() || '';
            return cellText.includes('no hay datos') || 
                   cellText.includes('no data') ||
                   cellText.includes('sin datos');
          }
        }
        
        return false;
      }, { timeout: 1500 }); // Aumentado a 1.5 segundos
    } catch (e) {
      // Si no se limpia en 1.5 segundos, esperar un poco más por seguridad
      await this.page.waitForTimeout(300);
      console.warn(`  ⚠️  La tabla no se limpió completamente para ${machine.name}, forzando espera adicional`);
    }

    console.log(`✅ Extraídos ${products.length} productos de ${machine.name}`);

    return {
      machineId: machine.id,
      machineName: machine.name,
      products,
      scrapedAt: new Date(),
    };
  }

  async scrapeAllMachines(onProgress?: (current: number, total: number, machineName: string) => void): Promise<MachineStock[]> {
    const startTime = Date.now();
    
    await this.initialize();
    await this.login();
    await this.navigateToStock();

    const machines = await this.getMachineList();
    
    // Cerrar cualquier modal que pueda haber aparecido
    await this.closeSweetAlertModalFast();
    
    const results: MachineStock[] = [];

    for (let i = 0; i < machines.length; i++) {
      const machine = machines[i];
      
      if (onProgress) {
        onProgress(i + 1, machines.length, machine.name);
      }

      try {
        const stock = await this.extractProductsForMachine(machine);
        results.push(stock);
        
        // Ya no necesitamos pausa adicional porque esperamos la limpieza de tabla
      } catch (error) {
        console.error(`❌ Error extrayendo ${machine.name}:`, error);
        
        // Agregar la máquina a los resultados aunque haya fallado, con array vacío
        results.push({
          machineId: machine.id,
          machineName: machine.name,
          products: [],
          scrapedAt: new Date(),
        });
        
        // Intentar cerrar cualquier modal y continuar
        await this.closeSweetAlertModalFast();
        
        // Intentar deseleccionar la máquina si quedó seleccionada
        try {
          await this.page?.evaluate((selector) => {
            const checkbox = document.querySelector(selector) as HTMLInputElement;
            if (checkbox && checkbox.checked) checkbox.click();
          }, machine.selector);
        } catch (e) {
          // Ignorar error al deseleccionar
        }
      }
    }

    await this.close();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Scraping completado en ${duration}s`);
    console.log(`📊 Total: ${results.length} máquinas, ${results.reduce((sum, m) => sum + m.products.length, 0)} productos`);

    return results;
  }

  async close() {
    if (this.browser) {
      // Guardar el estado de la sesión antes de cerrar
      try {
        const sessionPath = path.join(os.tmpdir(), 'orain-session.json');
        if (this.context) {
          const storageState = await this.context.storageState();
          await require('fs').promises.writeFile(sessionPath, JSON.stringify(storageState));
          console.log('💾 Sesión guardada para futuras ejecuciones');
        }
      } catch (error) {
        console.log('⚠️ No se pudo guardar la sesión:', error);
      }
      
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      console.log('🔒 Navegador cerrado');
    }
  }
}

// Función para intentar scraping mediante API (más rápido)
export async function tryApiScraping(user: string, pass: string): Promise<MachineStock[] | null> {
  console.log('🔍 Intentando scraping mediante API...');
  
  // Aquí se implementaría la lógica para interceptar y usar las APIs de Orain
  // Por ahora, retornamos null para indicar que hay que usar UI scraping
  
  console.log('⚠️  API scraping no disponible, usando UI scraping');
  return null;
}

// Función helper para obtener una página autenticada
export async function getAuthenticatedPage() {
  const scraper = new OrainScraper({
    user: process.env.ORAIN_USER || '',
    pass: process.env.ORAIN_PASS || '',
    headless: true,
  });

  await scraper.initialize();
  await scraper.login();

  // Devolver browser y page pero no el scraper completo
  // porque el caller será responsable del cleanup
  return {
    browser: scraper['browser'],
    page: scraper['page'],
  };
}
