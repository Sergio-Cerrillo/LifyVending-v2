/**
 * NUEVO SCRAPER DE RECAUDACIÓN POR MÁQUINAS
 * 
 * Este scraper recolecta recaudación específica de cada máquina
 * en 3 periodos diferentes: daily (1 día), weekly (7 días), monthly (este mes)
 * 
 * Proceso:
 * 1. Navega a Datos > Máquinas en dashboard.orain.io
 * 2. Configura filtros de fecha según periodo
 * 3. Establece mostrar 100 entradas para evitar paginación
 * 4. Extrae datos de la tabla "Información Máquinas":
 *    - Nombre de la máquina
 *    - Ubicación
 *    - Compras anónimas (total)
 *    - Anónimas tarjeta
 *    - Anónimas efectivo
 */

import puppeteer, { Browser, Page } from 'puppeteer';

export interface MachineRevenueData {
  machineName: string;
  location: string;
  anonymousTotal: number;
  anonymousCard: number;
  anonymousCash: number;
  period: 'daily' | 'weekly' | 'monthly';
  scrapedAt: Date;
}

export interface MachineRevenueScrapeResult {
  success: boolean;
  data: MachineRevenueData[];
  error?: string;
  scrapedAt: Date;
  totalMachines: number;
}

/**
 * Convierte texto de precio "1.234,56 €" a número 1234.56
 */
function parseEuroAmount(text: string): number {
  if (!text || text === '--' || text === '—') return 0;
  
  const cleaned = text
    .replace(/\s+/g, '')
    .replace('€', '')
    .replace(/\./g, '') // Quitar separador de miles
    .replace(',', '.'); // Convertir decimal

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : amount;
}

/**
 * Espera a que un selector esté disponible con timeout
 */
async function waitForSelectorSafe(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch (error) {
    console.error(`Timeout esperando selector: ${selector}`);
    return false;
  }
}

/**
 * Configura el filtro de fecha según el periodo deseado
 */
async function setDateFilter(
  page: Page,
  period: 'daily' | 'monthly'
): Promise<void> {
  console.log(`⏰ Configurando filtro de fecha para periodo: ${period}`);

  // Mapeo de periodo a texto del menú (según las capturas de Orain)
  const periodMap = {
    daily: 'Hoy',
    monthly: 'Este mes'
  };

  const optionText = periodMap[period];
  console.log(`🔍 Buscando opción: "${optionText}"...`);

  try {
    // 1. Hacer click en el selector de rango de fechas (#reportrange)
    console.log('🖱️  Haciendo click en #reportrange...');
    await page.waitForSelector('#reportrange', { timeout: 5000 });
    await page.click('#reportrange');
    
    // Esperar a que aparezca el dropdown
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Dropdown de fechas abierto');

    // 2. Buscar y hacer click en la opción del menú
    const clicked = await page.evaluate((text) => {
      // Buscar en todos los elementos visibles
      const allElements = Array.from(document.querySelectorAll('div, li, button, a, span'));
      
      // Log de elementos que contienen el texto buscado
      const candidates = allElements.filter(el => 
        el.textContent?.includes(text) && 
        el.textContent.trim().length < 50
      );
      
      console.log(`Candidatos que contienen "${text}": ${candidates.length}`);
      candidates.forEach((el, i) => {
        console.log(`  [${i}] ${el.tagName}.${el.className}: "${el.textContent?.trim()}"`);
      });
      
      // Buscar match exacto
      const exactMatch = allElements.find(el => el.textContent?.trim() === text);
      
      if (exactMatch && exactMatch instanceof HTMLElement) {
        console.log(`✅ Match exacto encontrado: "${text}"`);
        exactMatch.click();
        return true;
      }
      
      // Si no hay match exacto, buscar el que mejor coincida
      const bestMatch = candidates.find(el => el.textContent?.trim() === text);
      if (bestMatch && bestMatch instanceof HTMLElement) {
        console.log(`✅ Mejor match encontrado: "${text}"`);
        bestMatch.click();
        return true;
      }
      
      console.error(`❌ No se encontró "${text}"`);
      return false;
    }, optionText);

    if (clicked) {
      console.log(`✅ Click exitoso en opción: "${optionText}"`);
      
      // Esperar MUCHO a que la tabla se actualice
      console.log(`⏳ Esperando 6 segundos para que se actualicen los datos...`);
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Verificar que el filtro se aplicó
      const currentRange = await page.evaluate(() => {
        const span = document.querySelector('#reportrange span');
        return span?.textContent || 'No encontrado';
      });
      
      console.log(`✅ Filtro aplicado exitosamente`);
      console.log(`   Rango actual en UI: "${currentRange}"`);
      
      return;
    } else {
      throw new Error(`No se pudo hacer click en "${optionText}"`);
    }

  } catch (error) {
    console.error(`❌ Error configurando filtro ${period}:`, error);
    
    // Debug: Mostrar HTML actual del dropdown
    const dropdownHTML = await page.evaluate(() => {
      const dropdown = document.querySelector('.daterangepicker, .ranges, [class*="date"]');
      return dropdown?.outerHTML || 'No se encontró dropdown';
    });
    
    console.log('📋 HTML del dropdown:', dropdownHTML.substring(0, 500));
  }
}

/**
 * Configura la tabla para mostrar 100 entradas (evitar paginación)
 */
async function setTableEntries(page: Page): Promise<void> {
  console.log('📊 Configurando tabla para mostrar 100 entradas...');

  // Múltiples selectores posibles para el dropdown de entradas
  const possibleSelectors = [
    'select[name="example_length"]',
    'select[name*="length"]',
    'select.form-control',
    'select[aria-label*="entradas"]',
    'select[aria-label*="entries"]',
    '.dataTables_length select',
    'label select'
  ];

  let entriesSelect = null;
  let workingSelector = '';
  
  for (const selector of possibleSelectors) {
    try {
      entriesSelect = await page.$(selector);
      if (entriesSelect) {
        workingSelector = selector;
        console.log(`✅ Selector de entradas encontrado: ${selector}`);
        break;
      }
    } catch (e) {
      // Continuar con el siguiente selector
    }
  }

  if (!entriesSelect || !workingSelector) {
    console.warn('⚠️ No se encontró el selector de entradas.');
    return;
  }

  // Verificar qué opciones tiene el select
  const options = await page.evaluate((sel) => {
    const select = document.querySelector(sel) as HTMLSelectElement;
    if (!select) return [];
    return Array.from(select.options).map(opt => opt.value);
  }, workingSelector);
  
  console.log(`📋 Opciones disponibles: ${options.join(', ')}`);

  if (!options || options.length === 0) {
    console.warn('⚠️ No se pudieron obtener las opciones del select. Continuando sin cambios...');
    return;
  }

  if (options.includes('100')) {
    await page.select(workingSelector, '100');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar recarga
    console.log('✅ Tabla configurada para 100 entradas');
  } else if (options.includes('-1')) {
    // Algunas tablas usan -1 para "Todo"
    await page.select(workingSelector, '-1');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Tabla configurada para mostrar todas las entradas');
  } else {
    // Usar la opción más alta disponible
    const maxOption = options[options.length - 1];
    console.warn(`⚠️ Opción 100 no disponible. Usando la mayor disponible: ${maxOption}`);
    await page.select(workingSelector, maxOption);
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`✅ Tabla configurada para ${maxOption} entradas`);
  }
}

/**
 * Extrae datos de la tabla "Información Máquinas"
 */
async function extractMachineData(
  page: Page,
  period: 'daily' | 'weekly' | 'monthly'
): Promise<MachineRevenueData[]> {
  console.log(`📥 Extrayendo datos de máquinas para periodo: ${period}`);

  const data = await page.evaluate((periodParam) => {
    const results: any[] = [];
    
    // Buscar la tabla (puede tener diferentes selectores)
    const table = document.querySelector('table.dataTable, table[role="grid"], .table-responsive table');
    if (!table) {
      console.error('No se encontró la tabla de máquinas');
      return results;
    }

    const rows = table.querySelectorAll('tbody tr');
    console.log(`🔍 Encontradas ${rows.length} filas en la tabla`);
    
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 7) {
        console.log(`⚠️ Fila ${index} tiene solo ${cells.length} columnas, saltando...`);
        return;
      }

      // Estructura de columnas según las capturas de Orain:
      // 0: Nombre de la máquina
      // 1: Estado (active-war, etc.)
      // 2: Compras con Orain (precio)
      // 3: Ubicación
      // 4: Histórico de compras (icono)
      // 5: Última conexión (fecha)
      // 6: Compras anónimas (TOTAL)
      // 7: Anónimas efectivo (CASH)
      // 8: Anónimas cashless (TARJETA)

      const machineName = cells[0]?.textContent?.trim() || '';
      const location = cells[3]?.textContent?.trim() || '';
      const anonymousTotal = cells[6]?.textContent?.trim() || '0,00 €';
      const anonymousCash = cells[7]?.textContent?.trim() || '0,00 €'; // CORREGIDO
      const anonymousCard = cells[8]?.textContent?.trim() || '0,00 €'; // CORREGIDO

      // Debug: loguear primera fila
      if (index === 0) {
        console.log(`📋 Primera fila (${periodParam}):`);
        console.log(`   Nombre: ${machineName}`);
        console.log(`   Ubicación: ${location}`);
        console.log(`   Total: ${anonymousTotal}`);
        console.log(`   Efectivo: ${anonymousCash}`);
        console.log(`   Tarjeta: ${anonymousCard}`);
      }

      if (machineName) {
        results.push({
          machineName,
          location,
          anonymousTotal,
          anonymousCash,
          anonymousCard,
          period: periodParam
        });
      }
    });

    console.log(`✅ Procesadas ${results.length} máquinas con datos válidos`);
    return results;
  }, period);

  // Parsear los montos
  const parsedData: MachineRevenueData[] = data.map(item => ({
    machineName: item.machineName,
    location: item.location,
    anonymousTotal: parseEuroAmount(item.anonymousTotal),
    anonymousCard: parseEuroAmount(item.anonymousCard),
    anonymousCash: parseEuroAmount(item.anonymousCash),
    period: period,
    scrapedAt: new Date()
  }));

  console.log(`✅ Extraídos ${parsedData.length} registros de máquinas`);
  return parsedData;
}

/**
 * Scraper principal de recaudación por máquinas
 */
export async function scrapeMachineRevenue(
  credentials: { username: string; password: string }
): Promise<MachineRevenueScrapeResult> {
  const startTime = new Date();
  let browser: Browser | null = null;

  try {
    console.log('🚀 Iniciando scraping de recaudación por máquinas...');

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

    // Login
    console.log('🔐 Iniciando sesión en Orain...');
    await page.goto('https://dashboard.orain.io/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Esperar un momento adicional para que los elementos se rendericen
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('🔍 Buscando campos de login...');

    // Intentar encontrar el campo de usuario con varios selectores
    const possibleUsernameSelectors = [
      'input[name="username"]',
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="usuario" i]',
      'input[id*="email" i]',
      'input[id*="username" i]',
      'form input[type="text"]',
      'form input:not([type="password"])'
    ];

    let usernameInput = null;
    for (const selector of possibleUsernameSelectors) {
      try {
        usernameInput = await page.$(selector);
        if (usernameInput) {
          console.log(`✅ Campo de usuario encontrado con selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }

    if (!usernameInput) {
      throw new Error('No se encontró el campo de usuario/email después de probar todos los selectores');
    }

    await usernameInput.type(credentials.username, { delay: 100 });
    console.log('✅ Usuario escrito');

    // Intentar encontrar el campo de contraseña
    const possiblePasswordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[id*="password" i]',
      'input[placeholder*="contraseña" i]',
      'input[placeholder*="password" i]'
    ];

    let passwordInput = null;
    for (const selector of possiblePasswordSelectors) {
      try {
        passwordInput = await page.$(selector);
        if (passwordInput) {
          console.log(`✅ Campo de contraseña encontrado con selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continuar con el siguiente selector
      }
    }

    if (!passwordInput) {
      throw new Error('No se encontró el campo de contraseña después de probar todos los selectores');
    }

    await passwordInput.type(credentials.password, { delay: 100 });
    console.log('✅ Contraseña escrita');

    // Buscar y hacer click en el botón de login
    const submitButton = await page.$('button[type="submit"]');
    if (!submitButton) {
      throw new Error('No se encontró el botón de submit');
    }

    await submitButton.click();
    console.log('🔄 Click en botón de login...');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Sesión iniciada correctamente');

    // Navegar a Datos > Máquinas
    console.log('🗺️  Navegando a Datos > Máquinas...');
    await page.goto('https://dashboard.orain.io/dashboard/data/machines/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Configurar tabla para mostrar 100 entradas
    await setTableEntries(page);

    // Array para acumular todos los datos
    const allData: MachineRevenueData[] = [];

    // Scrappear cada periodo (solo daily y monthly, weekly eliminado)
    const periods: Array<'daily' | 'monthly'> = ['daily', 'monthly'];

    for (const period of periods) {
      console.log(`\n📊 ========== PROCESANDO PERIODO: ${period} ==========`);
      
      // IMPORTANTE: Recargar la página para resetear el estado del filtro
      if (period !== 'daily') {
        console.log('🔄 Recargando página para nuevo periodo...');
        await page.goto('https://dashboard.orain.io/dashboard/data/machines/', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Reconfigurar tabla a 100 entradas
        await setTableEntries(page);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Configurar filtro de fecha
      await setDateFilter(page, period);
      
      // Esperar MÁS TIEMPO a que la tabla se actualice con el nuevo filtro
      console.log('⏳ Esperando 5 segundos para que se actualice la tabla...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      

      // Extraer datos
      const periodData = await extractMachineData(page, period);
      allData.push(...periodData);
      
      console.log(`✅ Periodo ${period}: ${periodData.length} máquinas procesadas`);
      
      // Log de las primeras 3 máquinas para verificar datos
      if (periodData.length > 0) {
        console.log(`📋 Primeras 3 máquinas de ${period}:`);
        periodData.slice(0, 3).forEach(m => {
          console.log(`   - ${m.machineName}: Total €${m.anonymousTotal}`);
        });
      }
    }

    await browser.close();
    browser = null;

    // Obtener número de máquinas únicas
    const uniqueMachines = new Set(allData.map(d => d.machineName));

    console.log(`\n✅ Scraping completado exitosamente`);
    console.log(`   Total registros: ${allData.length}`);
    console.log(`   Máquinas únicas: ${uniqueMachines.size}`);
    console.log(`   Duración: ${((new Date().getTime() - startTime.getTime()) / 1000).toFixed(1)}s`);

    return {
      success: true,
      data: allData,
      scrapedAt: new Date(),
      totalMachines: uniqueMachines.size
    };

  } catch (error: any) {
    console.error('❌ Error en scraping de recaudación:', error);

    if (browser) {
      await browser.close();
    }

    return {
      success: false,
      data: [],
      error: error.message || 'Error desconocido durante el scraping',
      scrapedAt: new Date(),
      totalMachines: 0
    };
  }
}

/**
 * MOCK del scraper para desarrollo/testing sin credenciales
 * Simula datos realistas de máquinas
 */
export async function scrapeMachineRevenueMock(): Promise<MachineRevenueScrapeResult> {
  console.log('🎭 Ejecutando scraper MOCK de recaudación por máquinas...');

  await new Promise(resolve => setTimeout(resolve, 2000)); // Simular delay

  const mockMachines = [
    { name: 'ADELTE 5110', location: 'ADELTE' },
    { name: 'ADELTE CARROS 5152', location: 'ADELTE' },
    { name: 'ADELTE OFICINA 5157', location: 'NAVE' },
    { name: 'ANYTIME 5187', location: 'GIMNASIO' },
    { name: 'ATOM SPORT 5165', location: 'GIMNASIO ATOM' },
    { name: 'CLUB DE MAR 5172', location: 'CLUB' },
    { name: 'CLUB DE MAR 5173', location: 'CLUB' },
    { name: 'HOTEL LIS 5159', location: 'HOTEL LIS' },
    { name: 'HOTEL SAMOS 5156', location: 'HOTEL SAMOS' },
    { name: 'H.SAMOS 5164', location: 'HOTEL SAMOS' }
  ];

  const allData: MachineRevenueData[] = [];
  const periods: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly'];

  const now = new Date();

  periods.forEach(period => {
    mockMachines.forEach(machine => {
      // Generar valores realistas según periodo
      let baseAmount = Math.random() * 150;
      
      if (period === 'weekly') {
        baseAmount *= 3.5; // ~7 días
      } else if (period === 'monthly') {
        baseAmount *= 15; // ~30 días
      }

      const total = Math.round(baseAmount * 100) / 100;
      const cardPercent = 0.6 + Math.random() * 0.2; // 60-80%
      const card = Math.round(total * cardPercent * 100) / 100;
      const cash = Math.round((total - card) * 100) / 100;

      allData.push({
        machineName: machine.name,
        location: machine.location,
        anonymousTotal: total,
        anonymousCard: card,
        anonymousCash: cash,
        period: period,
        scrapedAt: now
      });
    });
  });

  console.log(`✅ Mock completado: ${allData.length} registros generados`);

  return {
    success: true,
    data: allData,
    scrapedAt: now,
    totalMachines: mockMachines.length
  };
}

/**
 * Función wrapper que decide si usar mock o real según variable de entorno
 */
export async function runOrainMachineScrape(
  useMock: boolean = process.env.USE_MOCK_SCRAPER === 'true'
): Promise<MachineRevenueScrapeResult> {
  if (useMock) {
    return scrapeMachineRevenueMock();
  }

  const credentials = {
    username: process.env.ORAIN_USERNAME || '',
    password: process.env.ORAIN_PASSWORD || ''
  };

  if (!credentials.username || !credentials.password) {
    console.warn('⚠️  Credenciales no configuradas, usando mock...');
    return scrapeMachineRevenueMock();
  }

  return scrapeMachineRevenue(credentials);
}
