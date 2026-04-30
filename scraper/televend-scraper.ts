import { chromium, Browser, Page, BrowserContext } from 'playwright';
import path from 'path';
import os from 'os';
import type { MachineStock, StockProduct } from '@/lib/types';
import { launchBrowser } from './browser-helper';

interface TelevendConfig {
  username: string;
  password: string;
  headless: boolean;
}

export class TelevendScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: TelevendConfig;

  constructor(config: TelevendConfig) {
    this.config = config;
  }

  async initialize() {
    console.log('🚀 [TELEVEND] Inicializando navegador...');
    
    this.browser = await launchBrowser({
      headless: this.config.headless,
    });

    // MODO INCÓGNITO: No cargar sesión guardada para forzar login fresco
    console.log('🕵️ [TELEVEND] Modo incógnito: forzando login fresco sin sesión guardada');
    
    this.context = await this.browser.newContext({
      javaScriptEnabled: true,
      // No se carga storageState para simular navegación privada
    });
    
    // Set default timeout
    this.context.setDefaultTimeout(30000);
    
    // Bloquear recursos innecesarios
    await this.context.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2}', route => route.abort());
    
    this.page = await this.context.newPage();
    console.log('✅ [TELEVEND] Navegador inicializado');
  }

  async login() {
    if (!this.page) throw new Error('Page not initialized');

    console.log('🔐 [TELEVEND] Iniciando proceso de login...');
    
    // Borrar cualquier sesión guardada anterior para asegurar login fresco
    try {
      const fs = require('fs').promises;
      const sessionPath = path.join(os.tmpdir(), 'televend-session.json');
      await fs.unlink(sessionPath);
      console.log('🗑️ [TELEVEND] Sesión anterior borrada');
    } catch (error) {
      // Ignorar error si no existe
    }
    
    // Navegar siempre a la página de login (modo incógnito)  
    console.log('📍 [TELEVEND] Navegando a página de login...');
    await this.page.goto(
      'https://auth.televendcloud.com/auth/realms/televend/protocol/openid-connect/auth?tenant_id=5&redirect_uri=https%3A%2F%2Ftelevendcloud.com%2Flogin_complete%3Fnext%3D%2Fen%2F&response_type=code&client_id=televendcloud&scope=openid',
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );
    await this.page.waitForTimeout(2000);

    // Esperar campos de login
    console.log('⏳ [TELEVEND] Esperando campos de login...');
    console.log('📍 [TELEVEND] URL actual:', this.page.url());
    await this.page.waitForSelector('input[name="username"], input#username', { timeout: 15000 });
    await this.page.waitForSelector('input[name="password"], input#password', { timeout: 15000 });
    console.log('✅ [TELEVEND] Campos de login encontrados');

    // Rellenar formulario con método más robusto
    console.log('📝 [TELEVEND] Ingresando username...');
    await this.page.locator('input[name="username"], input#username').first().fill(this.config.username);
    
    console.log('🔑 [TELEVEND] Ingresando password...');
    await this.page.locator('input[name="password"], input#password').first().fill(this.config.password);
    
    await this.page.waitForTimeout(500);
    console.log('✅ [TELEVEND] Credenciales ingresadas');

    // Buscar y hacer click en el botón de submit
    console.log('🔍 [TELEVEND] Buscando botón de submit...');

    // Intentar múltiples estrategias para el botón
    const submitClicked = await this.page.evaluate(() => {
      // Estrategia 1: Buscar por tipo submit
      let submitBtn = document.querySelector('input[type="submit"], button[type="submit"]') as HTMLElement;
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      
      // Estrategia 2: Buscar botón que contenga "Sign in" o "Login"
      const buttons = Array.from(document.querySelectorAll('button, input[type="button"]'));
      const loginBtn = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        const value = (btn as HTMLInputElement).value?.toLowerCase() || '';
        return text.includes('sign in') || text.includes('login') || 
               value.includes('sign in') || value.includes('login');
      }) as HTMLElement;
      
      if (loginBtn) {
        loginBtn.click();
        return true;
      }
      
      return false;
    });
    
    if (!submitClicked) {
      throw new Error('No se encontró el botón de submit');
    }
    
    console.log('✅ [TELEVEND] Click en botón de submit');

    // Esperar navegación y verificar autenticación real
    console.log('⏳ [TELEVEND] Esperando redirección después del login...');
    
    // Estrategia 1: Esperar a que la URL cambie (salir de la página de auth)
    console.log('⏳ [TELEVEND] Esperando cambio de URL (10s máximo)...');
    const initialUrl = this.page.url();
    let urlChanged = false;
    
    for (let i = 0; i < 20; i++) {
      await this.page.waitForTimeout(500);
      const currentUrl = this.page.url();
      
      if (currentUrl !== initialUrl && !currentUrl.includes('/auth/realms/televend')) {
        console.log(`✅ [TELEVEND] URL cambió a: ${currentUrl}`);
        urlChanged = true;
        break;
      }
      
      if (i % 4 === 0) {
        console.log(`⏳ [TELEVEND] Esperando redirección... (${(i * 0.5).toFixed(1)}s)`);
      }
    }
    
    if (!urlChanged) {
      console.warn('⚠️ [TELEVEND] URL no cambió después de 10s, continuando...');
    }
    
    // Esperar estabilidad de red
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      console.log('✅ [TELEVEND] Navegación completada (networkidle)');
    } catch (e) {
      console.log('⚠️ [TELEVEND] Timeout en networkidle, continuando...');
    }
    
    // Verificar si ya estamos en app o en televendcloud.com
    let currentUrl = this.page.url();
    console.log(`📍 [TELEVEND] URL después del login: ${currentUrl}`);
    
    // Si seguimos en auth, forzar navegación directa
    if (currentUrl.includes('/auth/realms/televend') || currentUrl.includes('auth.televendcloud.com')) {
      console.log('🔄 [TELEVEND] Todavía en página de auth, forzando navegación a app...');
      
      try {
        await this.page.goto('https://app.televendcloud.com/companies/4949/machines', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        console.log('✅ [TELEVEND] Navegación forzada completada');
        
        // Esperar más tiempo para que cargue
        console.log('⏳ [TELEVEND] Esperando carga completa (5s)...');
        await this.page.waitForTimeout(5000);
        
      } catch (navError) {
        console.error('❌ [TELEVEND] Error navegando a app después del login:', navError);
      }
    } else {
      // Ya salimos de auth, esperar un poco más para estabilidad
      console.log('✅ [TELEVEND] Ya salimos de auth, esperando estabilidad (3s)...');
      await this.page.waitForTimeout(3000);
    }
    
    // Verificar URL final
    const finalUrl = this.page.url();
    const finalUrlObj = new URL(finalUrl);
    const finalHostname = finalUrlObj.hostname;
    
    console.log(`📍 [TELEVEND] Hostname final: ${finalHostname}`);
    console.log(`📍 [TELEVEND] URL final completa: ${finalUrl}`);
    
    // Verificar que estamos en app.televendcloud.com O en televendcloud.com (sin auth)
    if (finalHostname === 'app.televendcloud.com' || (finalHostname === 'televendcloud.com' && !finalUrl.includes('auth'))) {
      console.log('✅ [TELEVEND] Login exitoso y autenticado');
    } else {
      // Último intento: verificar si hay cookies de sesión
      const cookies = await this.page.context().cookies();
      const hasTelevendCookies = cookies.some(c => 
        c.name.toLowerCase().includes('session') || 
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('token')
      );
      
      if (hasTelevendCookies) {
        console.warn('⚠️ [TELEVEND] URL inesperada pero cookies de sesión presentes, continuando...');
        console.warn(`⚠️ [TELEVEND] Cookies encontradas: ${cookies.map(c => c.name).join(', ')}`);
      } else {
        throw new Error(`Login falló. Hostname: ${finalHostname}, URL: ${finalUrl}`);
      }
    }
  }

  async navigateToMachines() {
    if (!this.page) throw new Error('Page not initialized');

    console.log('📊 [TELEVEND] Navegando a Máquinas...');
    
    const currentUrl = this.page.url();
    if (!currentUrl.includes('/machines') || currentUrl.includes('auth.televendcloud.com')) {
      await this.page.goto('https://app.televendcloud.com/companies/4949/machines', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    // Esperar a que cargue la página
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(2000);
    
    // VERIFICAR que no nos hayan redirigido al login
    const finalUrl = this.page.url();
    
    // Extraer hostname
    const urlObj = new URL(finalUrl);
    const hostname = urlObj.hostname;
    
    if (hostname !== 'app.televendcloud.com') {
      console.log('❌ [TELEVEND] Sesión expirada durante navegación. Reintentando login...');
      
      // Borrar sesión expirada
      try {
        const fs = require('fs').promises;
        const sessionPath = path.join(os.tmpdir(), 'televend-session.json');
        await fs.unlink(sessionPath);
      } catch (error) {
        // Ignorar
      }
      
      throw new Error('Sesión expirada. Por favor ejecuta el scraper de nuevo para hacer login fresco.');
    }
    
    console.log(`✅ [TELEVEND] En página de Máquinas (hostname: ${hostname})`);
  }

  async setShow100Machines() {
    if (!this.page) throw new Error('Page not initialized');

    console.log('[TELEVEND] Intentando configurar vista de 100 máquinas...');
    
    try {
      // Esperar a que se cargue COMPLETAMENTE la paginación (más tiempo)
      console.log('[TELEVEND] ⏳ Esperando carga completa de controles de paginación (10s)...');
      await this.page.waitForTimeout(10000);

      // Debug: Ver qué hay en la página con más detalle
      const debugInfo = await this.page.evaluate(() => {
        return {
          url: window.location.href,
          hasTable: !!document.querySelector('table'),
          paginatorCount: document.querySelectorAll('.p-paginator, .pagination, footer').length,
          dropdowns: Array.from(document.querySelectorAll('select, .p-dropdown, .ant-select')).map(el => ({
            tag: el.tagName,
            classes: (el as HTMLElement).className,
            html: (el as HTMLElement).outerHTML.substring(0, 200)
          })),
          buttonsWithNumbers: Array.from(document.querySelectorAll('button, a, span, li, option')).filter(el => {
            const text = el.textContent?.trim();
            return text && /^(10|20|50|100)$/.test(text);
          }).map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim(),
            classes: (el as HTMLElement).className,
            parent: el.parentElement?.tagName,
            parentClasses: el.parentElement?.className || ''
          }))
        };
      });
      
      console.log('[TELEVEND] 🔍 Debug info:', JSON.stringify(debugInfo, null, 2));

      // Intentar hacer click en "100" con estrategias mejoradas
      const clicked = await this.page.evaluate(() => {
        console.log('[EVAL] 🔍 Buscando selector de 100 máquinas...');
        
        // === ESTRATEGIA 0: Buscar dropdown/select de paginación primero ===
        const selects = Array.from(document.querySelectorAll('select'));
        for (const select of selects) {
          const options = Array.from((select as HTMLSelectElement).options);
          const option100 = options.find(opt => opt.textContent?.trim() === '100' || opt.value === '100');
          
          if (option100) {
            console.log('[EVAL] ✅ Encontrado select con opción 100');
            (select as HTMLSelectElement).value = option100.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        
        // === ESTRATEGIA 1: Buscar en elementos dropdown/select de PrimeNG o Ant Design ===
        const dropdowns = Array.from(document.querySelectorAll('.p-dropdown, .ant-select, [role="combobox"], [role="listbox"]'));
        for (const dropdown of dropdowns) {
          // Intentar abrir el dropdown primero
          const trigger = dropdown.querySelector('.p-dropdown-trigger, .ant-select-selector') as HTMLElement;
          if (trigger) {
            console.log('[EVAL] 🎯 Abriendo dropdown...');
            trigger.click();
            
            // Esperar un momento para que aparezcan las opciones
            setTimeout(() => {
              // Buscar la opción "100" en el panel desplegable
              const panel = document.querySelector('.p-dropdown-panel, .ant-select-dropdown, .p-dropdown-items-wrapper');
              if (panel) {
                const items = Array.from(panel.querySelectorAll('.p-dropdown-item, .ant-select-item, li, option'));
                const item100 = items.find(item => item.textContent?.trim() === '100') as HTMLElement;
                
                if (item100) {
                  console.log('[EVAL] ✅ Encontrado "100" en dropdown panel');
                  item100.click();
                  return true;
                }
              }
            }, 500);
            
            // Dar tiempo para que se abra el dropdown
            return new Promise(resolve => setTimeout(() => resolve(false), 1000)) as any;
          }
        }
        
        // === ESTRATEGIA 2: Buscar el texto "100" en elementos de paginación ===
        const allElements = Array.from(document.querySelectorAll('button, a, span, div, li, option'));
        
        for (const el of allElements) {
          const text = el.textContent?.trim();
          
          if (text === '100') {
            // Verificar si está en un contexto de paginación
            const parent = el.closest('div, nav, footer, .pagination, .paginator, .p-paginator, .ant-pagination');
            
            if (parent) {
              const parentText = parent.textContent || '';
              // Verificar que el contenedor tiene otros números de página
              const hasPagination = /10.*20.*50.*100/.test(parentText) || /Total de elementos/.test(parentText) || /\/ page/.test(parentText);
              
              if (hasPagination) {
                console.log('[EVAL] ✅ Encontrado "100" en contexto de paginación');
                (el as HTMLElement).click();
                return true;
              }
            }
          }
        }
        
        // === ESTRATEGIA 3: Buscar específicamente en la zona del footer/paginación ===
        const footer = document.querySelector('footer, .pagination, .paginator, .p-paginator, .ant-pagination, [class*="pagination"]');
        if (footer) {
          const button100 = Array.from(footer.querySelectorAll('button, a, span, li, option')).find(btn => {
            return btn.textContent?.trim() === '100';
          }) as HTMLElement;
          
          if (button100) {
            console.log('[EVAL] ✅ Encontrado "100" en footer/paginación');
            button100.click();
            return true;
          }
        }
        
        // === ESTRATEGIA 4: Buscar por patrón visual "10 20 50 100" ===
        for (const container of allElements) {
          const text = container.textContent || '';
          if (/10\s+20\s+50\s+100/.test(text) || /10.*20.*50.*100/.test(text)) {
            // Buscar el elemento "100" dentro de este contenedor
            const children = Array.from(container.querySelectorAll('button, a, span, li, option'));
            const button100 = children.find(c => c.textContent?.trim() === '100') as HTMLElement;
            
            if (button100) {
              console.log('[EVAL] ✅ Encontrado "100" en patron visual "10 20 50 100"');
              button100.click();
              return true;
            }
          }
        }
        
        // === ESTRATEGIA 5: Buscar "100 / page" o similar ===
        const pageOptions = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.trim() || '';
          return /100\s*\/\s*p(age|ágina)/i.test(text);
        });
        
        if (pageOptions.length > 0) {
          console.log('[EVAL] ✅ Encontrado "100 / page"');
          (pageOptions[0] as HTMLElement).click();
          return true;
        }
        
        console.warn('[EVAL] ⚠️ No se encontró el botón "100" con ninguna estrategia');
        console.warn('[EVAL] 📋 Elementos con números encontrados:');
        
        allElements.forEach(el => {
          const text = el.textContent?.trim();
          if (text && /^(10|20|50|100)$/.test(text)) {
            console.warn(`[EVAL]   - ${el.tagName}.${(el as HTMLElement).className}: "${text}"`);
          }
        });
        
        return false;
      });

      if (clicked) {
        console.log('✅ [TELEVEND] Click en selector de 100 máquinas');
        console.log('[TELEVEND] ⏳ Esperando recarga de tabla (8s)...');
        await this.page.waitForTimeout(8000); // Esperar más tiempo a que recargue la tabla
      } else {
        console.warn('⚠️ [TELEVEND] No se pudo hacer click en "100", continuando con vista actual');
      }
    } catch (error) {
      console.error('❌ [TELEVEND] Error configurando vista de 100 máquinas:', error);
    }
  }

  async getMachineList(): Promise<Array<{ id: string; name: string; url: string }>> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('📋 [TELEVEND] Obteniendo lista de máquinas...');

    // IMPORTANTE: Esperar a que la tabla de PrimeNG se renderice
    console.log('⏳ [TELEVEND] Esperando a que se cargue la tabla...');
    try {
      // Esperar a que aparezca la tabla de PrimeNG
      await this.page.waitForSelector('table.p-datatable-table, p-table table', { timeout: 10000 });
      console.log('✅ [TELEVEND] Tabla encontrada');
      
      // Esperar a que haya al menos una fila de datos
      await this.page.waitForSelector('tr[data-testid="machine-row"], tbody tr', { timeout: 10000 });
      console.log('✅ [TELEVEND] Filas de máquinas encontradas');
      
      // Esperar un poco más para asegurar que todo se renderizó
      await this.page.waitForTimeout(1500);
    } catch (error) {
      console.log('⚠️ [TELEVEND] Timeout esperando la tabla, intentando extraer de todas formas...');
    }

    // Debug: Guardar HTML completo DESPUÉS de esperar
    try {
      const htmlContent = await this.page.content();
      const htmlPath = path.join(os.tmpdir(), 'televend-machines-page.html');
      await require('fs').promises.writeFile(htmlPath, htmlContent);
      console.log(`📄 [TELEVEND] HTML guardado en: ${htmlPath}`);
    } catch (error) {
      console.log('⚠️ [TELEVEND] No se pudo guardar HTML');
    }

    // Debug: Ver qué hay en la página
    const debugInfo = await this.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        tablesCount: document.querySelectorAll('table').length,
        rowsCount: document.querySelectorAll('table tbody tr').length,
        linksCount: document.querySelectorAll('a[href*="machine"]').length,
        allLinks: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => ({
          text: a.textContent?.trim(),
          href: (a as HTMLAnchorElement).href
        }))
      };
    });

    console.log('🔍 [TELEVEND] Debug info:', JSON.stringify(debugInfo, null, 2));

    // Intentar múltiples estrategias para encontrar las máquinas
    const machines = await this.page.evaluate(() => {
      const results: Array<{ id: string; name: string; url: string }> = [];
      
      // Estrategia 1: Buscar filas de máquinas con data-testid="machine-row"
      const machineRows = document.querySelectorAll('tr[data-testid="machine-row"]');
      console.log(`[EVAL] Encontradas ${machineRows.length} filas con data-testid="machine-row"`);
      
      for (const row of Array.from(machineRows)) {
        // Buscar el link de la máquina en la primera columna
        const link = row.querySelector('a[href*="machine_detail"]') as HTMLAnchorElement;
        
        if (link) {
          const href = link.href;
          const name = link.getAttribute('title') || link.textContent?.trim() || '';
          
          // Extraer ID de la URL: .../machine_detail/overview/303895
          const match = href.match(/machine_detail\/overview\/(\d+)/);
          const id = match ? match[1] : name.replace(/[^a-zA-Z0-9]/g, '_');
          
          if (name && href && id) {
            results.push({ id, name, url: href });
            console.log(`[EVAL] Máquina encontrada: ${name} (ID: ${id})`);
          }
        }
      }

      // Si no encontramos con data-testid, estrategia 2: Buscar todos los links de machine_detail
      if (results.length === 0) {
        console.log('[EVAL] Estrategia 2: buscando links con machine_detail');
        const machineLinks = Array.from(document.querySelectorAll('a[href*="machine_detail/overview"]'));
        
        for (const link of machineLinks) {
          const href = (link as HTMLAnchorElement).href;
          const name = link.getAttribute('title') || link.textContent?.trim() || '';
          const match = href.match(/machine_detail\/overview\/(\d+)/);
          const id = match ? match[1] : name.replace(/[^a-zA-Z0-9]/g, '_');
          
          if (name && href && id && !results.find(m => m.id === id)) {
            results.push({ id, name, url: href });
            console.log(`[EVAL] Máquina encontrada: ${name} (ID: ${id})`);
          }
        }
      }

      // Si aún no encontramos nada, estrategia 3: Buscar en todas las filas de tabla
      if (results.length === 0) {
        console.log('[EVAL] Estrategia 3: buscando en todas las filas de tabla');
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        
        for (const row of rows) {
          const link = row.querySelector('a[href*="machine"]') as HTMLAnchorElement;
          
          if (link) {
            const href = link.href;
            const name = link.getAttribute('title') || link.textContent?.trim() || '';
            const match = href.match(/\/(\d+)/);
            const id = match ? match[1] : name.replace(/[^a-zA-Z0-9]/g, '_');
            
            if (name && href && id && !results.find(m => m.id === id)) {
              results.push({ id, name, url: href });
              console.log(`[EVAL] Máquina encontrada: ${name} (ID: ${id})`);
            }
          }
        }
      }
      
      return results;
    });

    console.log(`✅ [TELEVEND] Encontradas ${machines.length} máquinas`);
    
    if (machines.length > 0) {
      console.log('📋 [TELEVEND] Primera máquina:', machines[0]);
    } else {
      console.log('⚠️ [TELEVEND] No se encontraron máquinas. Revisa los archivos de debug en /tmp');
    }
    
    return machines;
  }

  async extractStockForMachine(machine: { id: string; name: string; url: string }): Promise<MachineStock | null> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`📦 [TELEVEND] Extrayendo stock para ${machine.name}...`);

    try {
      // Navegar a la página de la máquina
      await this.page.goto(machine.url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });

      await this.page.waitForTimeout(2000);

      // Extraer la tabla de productos
      const machineData = await this.page.evaluate((machineName) => {
        // Buscar nombre completo y dirección
        let fullName = machineName;
        let address = '';
        
        // Buscar en la tabla de información (la del medio según captura)
        const infoTables = Array.from(document.querySelectorAll('table'));
        for (const table of infoTables) {
          const rows = Array.from(table.querySelectorAll('tr'));
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td, th'));
            const text = cells.map(c => c.textContent?.trim()).join(' ');
            
            // Buscar dirección
            if (text.toLowerCase().includes('dirección') || 
                text.toLowerCase().includes('direccion') ||
                text.toLowerCase().includes('ubicación')) {
              const addressCell = cells[cells.length - 1];
              address = addressCell?.textContent?.trim() || '';
            }
          }
        }
        
        // Buscar título completo de la máquina (h1, h2, etc.)
        const titleElement = document.querySelector('h1, h2, .title, [class*="machine-name"]');
        if (titleElement) {
          fullName = titleElement.textContent?.trim() || machineName;
        }
        
        // Extraer productos de la tabla "PRODUCTOS"
        const products: Array<{
          name: string;
          capacity: number;
          currentStock: number;
          lane: string;
        }> = [];
        
        // Buscar la sección de productos
        const productSections = Array.from(document.querySelectorAll('div, section, table'));
        let productTable: Element | null = null;
        
        for (const section of productSections) {
          const heading = section.querySelector('h3, h4, h5, .heading, [class*="title"]');
          if (heading?.textContent?.toLowerCase().includes('producto')) {
            productTable = section.querySelector('table') || section;
            break;
          }
        }
        
        // Si no encontramos sección específica, buscar tabla con headers "CAPACIDAD" y "CANT. ACTUAL"
        if (!productTable) {
          const tables = Array.from(document.querySelectorAll('table'));
          for (const table of tables) {
            const headers = Array.from(table.querySelectorAll('th'));
            const headerTexts = headers.map(h => h.textContent?.toLowerCase() || '');
            
            if (headerTexts.some(t => t.includes('capacidad') || t.includes('cant')) &&
                headerTexts.some(t => t.includes('actual') || t.includes('stock'))) {
              productTable = table;
              break;
            }
          }
        }
        
        if (productTable) {
          const rows = Array.from(productTable.querySelectorAll('tbody tr, tr'));
          
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length < 3) continue;
            
            // Intentar extraer: COL, PRODUCTO, CATEGORÍA, CAPACIDAD, REPONER CANT., CANT. ACTUAL
            // Según la captura de la tercera imagen
            let colIndex = 0;
            let productName = '';
            let capacity = 0;
            let currentStock = 0;
            let lane = '';
            
            // Buscar en las celdas
            for (let i = 0; i < cells.length; i++) {
              const text = cells[i].textContent?.trim() || '';
              const num = parseInt(text.replace(/\D/g, ''));
              
              // Primera celda suele ser COL (lane)
              if (i === 0) {
                lane = text;
              }
              
              // Segunda celda suele ser nombre del producto
              if (i === 1) {
                productName = text;
              }
              
              // Buscar "Capacidad" y "Cant. actual" por posición o contenido
              if (text.includes('/') || !isNaN(num)) {
                // Puede ser un formato "8/10" (actual/capacidad)
                if (text.includes('/')) {
                  const parts = text.split('/');
                  currentStock = parseInt(parts[0]) || 0;
                  capacity = parseInt(parts[1]) || 0;
                } else if (!isNaN(num) && num > 0) {
                  // Asignar a capacidad o stock según posición
                  if (capacity === 0) {
                    capacity = num;
                  } else if (currentStock === 0) {
                    currentStock = num;
                  }
                }
              }
            }
            
            // Verificar por headers para mapeo correcto
            const headers = Array.from(productTable.querySelectorAll('th'));
            if (headers.length > 0) {
              headers.forEach((header, idx) => {
                const headerText = header.textContent?.toLowerCase() || '';
                const cellValue = cells[idx]?.textContent?.trim() || '';
                const num = parseInt(cellValue.replace(/\D/g, ''));
                
                if (headerText.includes('capacidad')) {
                  capacity = num || 0;
                } else if (headerText.includes('actual') || 
                          (headerText.includes('cant') && headerText.includes('actual'))) {
                  currentStock = num || 0;
                } else if (headerText.includes('producto') && !productName) {
                  productName = cellValue;
                } else if ((headerText.includes('col') || headerText === 'col') && !lane) {
                  lane = cellValue;
                }
              });
            }
            
            if (productName && capacity > 0) {
              products.push({
                name: productName,
                capacity,
                currentStock,
                lane: lane || `Col ${products.length + 1}`
              });
            }
          }
        }
        
        return {
          fullName,
          address,
          products
        };
      }, machine.name);

      if (machineData.products.length === 0) {
        console.log(`⚠️ [TELEVEND] No se encontraron productos para ${machine.name}`);
        return null;
      }

      // Convertir al formato MachineStock
      const products: StockProduct[] = machineData.products.map(p => ({
        name: p.name,
        category: '',
        line: p.lane,
        totalCapacity: p.capacity,
        availableUnits: p.currentStock,
        unitsToReplenish: p.capacity - p.currentStock
      }));

      const result: MachineStock = {
        machineId: `televend_${machine.id}`,
        machineName: machineData.fullName || machine.name,
        location: machineData.address || 'Sin ubicación',
        products,
        scrapedAt: new Date()
      };

      console.log(`✅ [TELEVEND] ${machine.name}: ${products.length} productos`);
      return result;

    } catch (error) {
      console.error(`❌ [TELEVEND] Error extrayendo ${machine.name}:`, error);
      return null;
    }
  }

  async extractRevenueForMachine(machine: { id: string; name: string; url: string }): Promise<{
    daily: number;
    monthly: number; // NOTA: En Televend "monthly" = "Last Month" según UI español
    machineName: string;
    location: string;
  } | null> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`💰 [TELEVEND] Extrayendo recaudación para ${machine.name}...`);

    try {
      // Navegar DIRECTAMENTE a la página de Ventas (no a Overview)
      const vendsUrl = `https://televendcloud.com/es/c/4949/administration/machine_detail/vends/${machine.id}/`;
      console.log(`🔗 [TELEVEND] Navegando a Ventas: ${vendsUrl}`);
      
      await this.page.goto(vendsUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await this.page.waitForTimeout(3000); // Esperar a que Angular cargue completamente

      // Función para extraer "Total ingresos" directamente de #sales_info_vends
      const extractTotalIngresos = async (): Promise<number> => {
        // Esperar a que los datos se actualicen después de cambiar filtro
        await this.page!.waitForTimeout(2000);
        
        return await this.page!.evaluate(() => {
          const salesSpan = document.querySelector('#sales_info_vends');
          if (salesSpan) {
            const text = salesSpan.textContent?.trim() || '0';
            console.log('[EVAL] 📄 Texto original:', text);
            
            // Detectar formato automáticamente
            let parsed = 0;
            
            // Si contiene coma Y punto, determinar cuál es decimal
            if (text.includes(',') && text.includes('.')) {
              // Formato europeo: 1.234,56 (punto=miles, coma=decimal)
              const value = text.replace(/\./g, '').replace(',', '.');
              parsed = parseFloat(value) || 0;
            } 
            // Si solo contiene punto
            else if (text.includes('.') && !text.includes(',')) {
              // Formato inglés/Televend: 549.90 (punto=decimal)
              // NO eliminar el punto, parsearlo directamente
              parsed = parseFloat(text) || 0;
            }
            // Si solo contiene coma
            else if (text.includes(',') && !text.includes('.')) {
              // Formato europeo sin miles: 549,90
              const value = text.replace(',', '.');
              parsed = parseFloat(value) || 0;
            }
            // Sin separadores
            else {
              parsed = parseFloat(text) || 0;
            }
            
            console.log('[EVAL] 💰 Total ingresos parseado:', parsed, '€');
            return parsed;
          }
          return 0;
        });
      };

      // PASO 0: Hacer clic en el botón "Filtro" para mostrar/expandir el panel de filtros
      console.log('🔍 [TELEVEND] Haciendo clic en botón Filtro para expandir...');
      const filtroExpanded = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a.toggle_filter, a[href="#"]'));
        for (const link of links) {
          const text = link.textContent || '';
          if (text.includes('Filtro')) {
            console.log('[EVAL] ✅ Haciendo clic en botón Filtro');
            (link as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (!filtroExpanded) {
        console.log('ℹ️ [TELEVEND] Filtro ya expandido o no se encontró botón');
      }

      await this.page.waitForTimeout(1000);

      // PASO 1: Extraer ingresos de TODAY
      console.log('📅 [TELEVEND] Seleccionando filtro TODAY...');
      
      // Hacer scroll al input para asegurar que es visible
      await this.page.evaluate(() => {
        const input = document.querySelector('#datetimerange');
        if (input) {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      await this.page.waitForTimeout(500);
      
      // Hacer clic en el input del período para abrir el calendar dropdown
      await this.page.click('#datetimerange', { force: true });
      await this.page.waitForTimeout(1000);

      // Buscar y hacer clic en "Today" en el dropdown
      const todaySelected = await this.page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('button, li, div, span, a'));
        for (const option of options) {
          const text = option.textContent?.trim() || '';
          if (text === 'Today' || text === 'Hoy') {
            console.log('[EVAL] ✅ Seleccionando Today');
            (option as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (!todaySelected) {
        console.warn('⚠️ [TELEVEND] No se encontró opción Today');
      }

      // Hacer clic en el botón "Apply" para aplicar el filtro
      await this.page.waitForTimeout(500);
      const applyClicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, .btn, [role="button"]'));
        for (const btn of buttons) {
          const text = btn.textContent?.trim() || '';
          if (text === 'Apply' || text === 'Aplicar') {
            console.log('[EVAL] ✅ Haciendo clic en Apply');
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (!applyClicked) {
        console.warn('⚠️ [TELEVEND] No se encontró botón Apply');
      }

      // Esperar a que se actualicen los datos
      await this.page.waitForTimeout(3000);

      const dailyRevenue = await extractTotalIngresos();
      console.log(`📊 [TELEVEND] ${machine.name} - Today: €${dailyRevenue}`);

      // PASO 2: Extraer ingresos de LAST MONTH
      console.log('📅 [TELEVEND] Seleccionando filtro LAST MONTH...');
      
      // Abrir el selector de período nuevamente
      await this.page.click('#datetimerange');
      await this.page.waitForTimeout(1000);

      // Buscar y hacer clic en "Last Month"
      const lastMonthSelected = await this.page.evaluate(() => {
        const options = Array.from(document.querySelectorAll('button, li, div, span, a'));
        for (const option of options) {
          const text = option.textContent?.trim() || '';
          if (text === 'Last Month' || text === 'Último mes' || text === 'Last month') {
            console.log('[EVAL] ✅ Seleccionando Last Month');
            (option as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (!lastMonthSelected) {
        console.warn('⚠️ [TELEVEND] No se encontró opción Last Month');
      }

      // Hacer clic en "Apply"
      await this.page.waitForTimeout(500);
      await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, .btn, [role="button"]'));
        for (const btn of buttons) {
          const text = btn.textContent?.trim() || '';
          if (text === 'Apply' || text === 'Aplicar') {
            (btn as HTMLElement).click();
            break;
          }
        }
      });

      // Esperar a que se actualicen los datos
      await this.page.waitForTimeout(3000);

      // Capturar screenshot

      const monthlyRevenue = await extractTotalIngresos();
      console.log(`📊 [TELEVEND] ${machine.name} - Last Month: €${monthlyRevenue}`);

      // Extraer nombre y ubicación
      const machineInfo = await this.page.evaluate(() => {
        let name = '';
        let location = '';
        
        const titleElement = document.querySelector('h1, h2, .title');
        if (titleElement) {
          name = titleElement.textContent?.trim() || '';
        }
        
        const infoTables = Array.from(document.querySelectorAll('table'));
        for (const table of infoTables) {
          const rows = Array.from(table.querySelectorAll('tr'));
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td, th'));
            const text = cells.map(c => c.textContent?.trim()).join(' ');
            
            if (text.toLowerCase().includes('dirección') || 
                text.toLowerCase().includes('ubicación')) {
              location = cells[cells.length - 1]?.textContent?.trim() || '';
            }
          }
        }
        
        return { name, location };
      });

      return {
        daily: dailyRevenue,
        monthly: monthlyRevenue,
        machineName: machineInfo.name || machine.name,
        location: machineInfo.location || 'Sin ubicación'
      };

    } catch (error) {
      console.error(`❌ [TELEVEND] Error extrayendo recaudación de ${machine.name}:`, error);
      return null;
    }
  }

  async scrapeAllMachinesStock(
    progressCallback?: (current: number, total: number, name: string) => void
  ): Promise<MachineStock[]> {
    console.log('🎯 [TELEVEND] Iniciando scraping de stock...');
    const startTime = Date.now();

    await this.initialize();
    await this.login();
    await this.navigateToMachines();
    await this.setShow100Machines();

    const machines = await this.getMachineList();
    const results: MachineStock[] = [];

    for (let i = 0; i < machines.length; i++) {
      const machine = machines[i];
      
      if (progressCallback) {
        progressCallback(i + 1, machines.length, machine.name);
      }

      const stock = await this.extractStockForMachine(machine);
      if (stock) {
        results.push(stock);
      }

      // Volver a la lista de máquinas
      await this.page?.evaluate(() => {
        const backButton = Array.from(document.querySelectorAll('a, button')).find(btn =>
          btn.textContent?.toLowerCase().includes('volver') ||
          btn.textContent?.toLowerCase().includes('back') ||
          btn.textContent?.toLowerCase().includes('máquinas')
        );
        if (backButton && backButton instanceof HTMLElement) {
          backButton.click();
        }
      });

      await this.page?.waitForTimeout(1500);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ [TELEVEND] Scraping de stock completado en ${duration}s`);
    console.log(`📊 [TELEVEND] Total: ${results.length} máquinas`);

    return results;
  }

  async scrapeAllMachinesRevenue(
    progressCallback?: (current: number, total: number, name: string) => void
  ): Promise<Array<{
    machineName: string;
    location: string;
    daily: number; // Today (hoy)
    monthly: number; // Last Month (según UI español de Televend)
  }>> {
    console.log('🎯 [TELEVEND] Iniciando scraping de recaudación...');
    const startTime = Date.now();

    try {
      await this.initialize();
      console.log('✅ [TELEVEND] Navegador inicializado correctamente');
      
      await this.login();
      console.log('✅ [TELEVEND] Login completado correctamente');
      
      await this.navigateToMachines();
      console.log('✅ [TELEVEND] Navegación a máquinas completada');
      
      await this.setShow100Machines();
      console.log('✅ [TELEVEND] Vista de 100 máquinas configurada');

      const machines = await this.getMachineList();
      console.log(`📊 [TELEVEND] Total de máquinas detectadas: ${machines.length}`);
      
      if (machines.length === 0) {
        console.error('❌ [TELEVEND] ERROR: No se detectaron máquinas. Posibles causas:');
        console.error('   1. Los selectores de la UI cambiaron');
        console.error('   2. La sesión expiró durante la navegación');
        console.error('   3. La página no cargó correctamente');
        console.error('   → Revisa el archivo HTML en /tmp/televend-machines-page.html');
        return [];
      }

      const results: Array<{ machineName: string; location: string; daily: number; monthly: number }> = [];

      for (let i = 0; i < machines.length; i++) {
        const machine = machines[i];
        
        console.log(`\n[${i + 1}/${machines.length}] Procesando: ${machine.name}`);
        
        if (progressCallback) {
          progressCallback(i + 1, machines.length, machine.name);
        }

        const revenue = await this.extractRevenueForMachine(machine);
        if (revenue) {
          results.push(revenue);
          console.log(`✅ [TELEVEND] ${machine.name}: Daily=€${revenue.daily}, Monthly=€${revenue.monthly}`);
        } else {
          console.warn(`⚠️ [TELEVEND] ${machine.name}: No se pudo extraer recaudación`);
        }

        // Volver a la lista de máquinas
        await this.page?.evaluate(() => {
          const backButton = Array.from(document.querySelectorAll('a, button')).find(btn =>
            btn.textContent?.toLowerCase().includes('volver') ||
            btn.textContent?.toLowerCase().includes('back') ||
            btn.textContent?.toLowerCase().includes('máquinas')
          );
          if (backButton && backButton instanceof HTMLElement) {
            backButton.click();
          }
        });

        await this.page?.waitForTimeout(1500);
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ [TELEVEND] Scraping de recaudación completado en ${duration}s`);
      console.log(`📊 [TELEVEND] Total: ${results.length}/${machines.length} máquinas con datos`);
      
      if (results.length < machines.length) {
        console.warn(`⚠️ [TELEVEND] ${machines.length - results.length} máquinas fallaron`);
      }

      return results;
      
    } catch (error) {
      console.error('❌ [TELEVEND] Error crítico durante scraping de recaudación:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      // NO guardar sesión (modo incógnito)
      console.log('🕵️ [TELEVEND] Modo incógnito: sesión no persistida');
      
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      console.log('🔒 [TELEVEND] Navegador cerrado');
    }
  }
}
