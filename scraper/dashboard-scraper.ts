import { Page } from 'playwright';
import type { DashboardData, DashboardMetrics, ChartDataPoint, DashboardPeriod, DashboardPeriodData } from '@/lib/types';

/**
 * Dashboard Scraper - Extrae datos del dashboard principal de Orain
 * Captura datos de los 3 períodos: Día, Semana y Mes
 * Hace clic en cada filtro para obtener los datos correctos
 */

export class DashboardScraper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navega al dashboard y espera a que los datos estén cargados
   */
  async navigateToDashboard(): Promise<void> {
    console.log('[Dashboard Scraper] Navegando a dashboard...');
    await this.page.goto('https://dashboard.orain.io/dashboard/home/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('[Dashboard Scraper] Página cargada, esperando canvas...');

    // Esperar a que las gráficas de Chart.js estén renderizadas (en paralelo)
    try {
      await Promise.all([
        this.page.waitForSelector('canvas#total_sales_money_chart', { timeout: 10000 }),
        this.page.waitForSelector('canvas#total_sales_chart', { timeout: 10000 }),
      ]);
      console.log('[Dashboard Scraper] ✓ Canvas cargados');
    } catch (error) {
      console.error('[Dashboard Scraper] ✗ Canvas NO encontrados');
      throw error;
    }
    
    // Esperar a que Chart.js esté listo usando waitForFunction
    console.log('[Dashboard Scraper] Esperando inicialización de Chart.js...');
    await this.page.waitForFunction(() => {
      return typeof (window as any).Chart !== 'undefined' && 
             (window as any).Chart.instances && 
             Object.keys((window as any).Chart.instances).length > 0;
    }, { timeout: 5000 }).catch(() => {
      console.warn('[Dashboard Scraper] Chart.js no se detectó, continuando...');
    });
    
    console.log('[Dashboard Scraper] Listo para cambiar entre períodos');
  }

  /**
   * Extrae las métricas principales (ticket medio, medias de ventas)
   * Usa los IDs específicos del HTML de Orain
   */
  async extractMetrics(): Promise<DashboardMetrics> {
    console.log('[Dashboard Scraper] Extrayendo métricas...');
    
    const metrics = await this.page.evaluate(() => {
      // Ticket medio
      const ticketMedioBox = document.querySelector('#ticket-avg-box');
      const ticketMedioValue = ticketMedioBox?.querySelector('h1')?.textContent?.trim() || '0 €';
      const ticketMedioPercentEl = ticketMedioBox?.querySelector('.stat-percent');
      const ticketMedioPercent = ticketMedioPercentEl?.textContent?.trim() || '0 %';
      const ticketMedioHtml = ticketMedioPercentEl?.innerHTML || '';
      
      // Media de ventas en euros
      const moneyAvgBox = document.querySelector('#money-avg-box');
      const moneyAvgValue = moneyAvgBox?.querySelector('h1')?.textContent?.trim() || '0 €';
      const moneyAvgPercentEl = moneyAvgBox?.querySelector('.stat-percent');
      const moneyAvgPercent = moneyAvgPercentEl?.textContent?.trim() || '0 %';
      const moneyAvgHtml = moneyAvgPercentEl?.innerHTML || '';
      
      // Media de ventas en unidades
      const quantityAvgBox = document.querySelector('#quantity-avg-box');
      const quantityAvgValue = quantityAvgBox?.querySelector('h1')?.textContent?.trim() || '0';
      const quantityAvgPercentEl = quantityAvgBox?.querySelector('.stat-percent');
      const quantityAvgPercent = quantityAvgPercentEl?.textContent?.trim() || '0 %';
      const quantityAvgHtml = quantityAvgPercentEl?.innerHTML || '';

      // Función helper para parsear valor
      const parseValue = (text: string): number => {
        return parseFloat(text.replace(/[€\s]/g, '').replace(',', '.')) || 0;
      };

      // Función helper para parsear porcentaje
      const parsePercentage = (text: string): number => {
        const match = text.match(/([\d,.]+)\s*%/);
        return match ? parseFloat(match[1].replace(',', '.')) : 0;
      };

      // Función helper para detectar tendencia desde el HTML
      const getTrend = (html: string): 'up' | 'down' => {
        return html.includes('fa-level-up') ? 'up' : 'down';
      };

      return {
        ticketMedio: {
          value: parseValue(ticketMedioValue),
          change: parsePercentage(ticketMedioPercent),
          trend: getTrend(ticketMedioHtml),
        },
        mediaVentasEuros: {
          value: parseValue(moneyAvgValue),
          change: parsePercentage(moneyAvgPercent),
          trend: getTrend(moneyAvgHtml),
        },
        mediaVentasUnidades: {
          value: parseValue(quantityAvgValue),
          change: parsePercentage(quantityAvgPercent),
          trend: getTrend(quantityAvgHtml),
        },
      };
    });

    console.log('[Dashboard Scraper] Métricas extraídas:', metrics);
    return metrics;
  }

  /**
   * Extrae datos de una gráfica de Chart.js (específicamente pie/doughnut charts)
   */
  async extractChartData(canvasId: string): Promise<ChartDataPoint[]> {
    const data = await this.page.evaluate((id) => {
      const canvas = document.querySelector(`canvas#${id}`) as any;
      if (!canvas) {
        console.warn(`Canvas #${id} no encontrado`);
        return [];
      }

      try {
        // Buscar instancia de Chart.js
        if (typeof (window as any).Chart !== 'undefined') {
          const chartInstances = (window as any).Chart.instances;
          
          if (chartInstances) {
            for (const instance of Object.values(chartInstances)) {
              const chart = instance as any;
              
              if (chart.canvas === canvas) {
                const chartConfig = chart.config || chart.options;
                const datasets = chart.data?.datasets || chartConfig?.data?.datasets || [];
                const labels = chart.data?.labels || chartConfig?.data?.labels || [];
                
                if (datasets.length === 0) {
                  console.warn(`No hay datasets en chart #${id}`);
                  return [];
                }
                
                // Para pie/doughnut charts, típicamente hay 1 dataset con múltiples valores
                const dataset = datasets[0];
                const dataValues = dataset.data || [];
                const colors = dataset.backgroundColor || [];
                
                const chartData: any[] = [];
                
                // Los valores de dinero vienen en CENTAVOS, hay que dividir por 100
                const isMoneyChart = id.includes('money');
                
                // Crear una entrada por cada label/valor
                labels.forEach((label: string, idx: number) => {
                  let value = dataValues[idx] || 0;
                  
                  // Convertir centavos a euros
                  if (isMoneyChart) {
                    value = value / 100;
                  }
                  
                  const color = Array.isArray(colors) ? colors[idx] : colors;
                  
                  chartData.push({
                    label: label,
                    value: value,
                    color: color || '#cccccc',
                  });
                });
                
                return chartData;
              }
            }
          }
        }
        
        console.warn(`No se encontró instancia de Chart para #${id}`);
      } catch (error) {
        console.error(`Error extrayendo datos de #${id}:`, error);
      }

      return [];
    }, canvasId);

    if (data.length === 0) {
      console.warn(`[Dashboard Scraper] ⚠️  No se extrajeron datos de ${canvasId}`);
      return [];
    }

    // Calcular porcentajes
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const result = data.map(item => ({
      ...item,
      percentage: total > 0 ? (item.value / total) * 100 : 0,
    }));
    
    console.log(`[Dashboard Scraper] ✓ Extraídos ${result.length} items de ${canvasId}, total: ${total.toFixed(2)}`);
    return result;
  }

  /**
   * Hace clic en el botón de filtro de período y espera a que se actualicen los datos
   */
  async switchToPeriod(period: DashboardPeriod): Promise<void> {
    console.log(`[Dashboard Scraper] 🎯 Cambiando a período "${period}"...`);
    
    const buttonIds: Record<DashboardPeriod, string> = {
      'Día': 'btn-summary-home-daily',
      'Semana': 'btn-summary-home-weekly',
      'Mes': 'btn-summary-home-monthly',
    };
    
    const buttonId = buttonIds[period];
    
    // Hacer clic en el botón del período
    const clicked = await this.page.evaluate((id) => {
      const button = document.getElementById(id);
      if (button) {
        (button as HTMLElement).click();
        return true;
      }
      return false;
    }, buttonId);
    
    if (!clicked) {
      throw new Error(`No se pudo hacer clic en el botón del período "${period}" (ID: ${buttonId})`);
    }
    
    // Esperar a que se actualicen los datos observando cambios en el DOM
    console.log(`[Dashboard Scraper] ⏳ Esperando actualización de datos para "${period}"...`);
    
    // Estrategia inteligente: esperar a que los valores cambien en lugar de timeout fijo
    await this.page.waitForFunction((periodName) => {
      const button = document.querySelector(`#btn-summary-home-${periodName.toLowerCase()}ly`);
      return button?.classList.contains('active') || button?.getAttribute('aria-pressed') === 'true';
    }, period, { timeout: 3000 }).catch(() => {});
    
    // Pequeña espera para que Chart.js re-renderice
    await this.page.waitForTimeout(800);
    
    console.log(`[Dashboard Scraper] ✅ Período "${period}" activo`);
  }

  /**
   * Extrae datos de un período específico
   */
  async scrapePeriod(period: DashboardPeriod): Promise<DashboardPeriodData> {
    console.log(`\n[Dashboard Scraper] 📊 Extrayendo datos de "${period}"...`);
    
    // Cambiar al período correspondiente
    await this.switchToPeriod(period);
    
    // Extraer todos los datos en paralelo
    const [metrics, totalVentasEuros, totalVentasUnidades, totalRecargas] = await Promise.all([
      this.extractMetrics(),
      this.extractChartData('total_sales_money_chart'),
      this.extractChartData('total_sales_chart'),
      this.extractChartData('total_topups_money_chart'),
    ]);
    
    return {
      metrics,
      totalVentasEuros,
      totalVentasUnidades,
      totalRecargas,
    };
  }

  /**
   * Scrapea todos los datos del dashboard para los 3 períodos
   */
  async scrapeAll(): Promise<DashboardData> {
    // Navegar al dashboard
    await this.navigateToDashboard();

    // Extraer datos de cada período secuencialmente
    // (no se puede hacer en paralelo porque necesitamos hacer clic en los botones)
    console.log('\n[Dashboard Scraper] 🔄 Iniciando extracción de todos los períodos...');
    
    const diaData = await this.scrapePeriod('Día');
    const semanaData = await this.scrapePeriod('Semana');
    const mesData = await this.scrapePeriod('Mes');

    console.log('\n[Dashboard Scraper] ✅ Extracción completa de todos los períodos');

    return {
      periods: {
        'Día': diaData,
        'Semana': semanaData,
        'Mes': mesData,
      },
      scrapedAt: new Date(),
    };
  }
}

/**
 * Función auxiliar para scraping rápido de dashboard
 */
export async function scrapeDashboard(page: Page): Promise<DashboardData> {
  const scraper = new DashboardScraper(page);
  return await scraper.scrapeAll();
}
