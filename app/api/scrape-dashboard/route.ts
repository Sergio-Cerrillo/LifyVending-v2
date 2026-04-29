import { NextResponse } from 'next/server';
import { scrapeDashboard } from '@/scraper/dashboard-scraper';
import { getAuthenticatedPage } from '@/scraper/orain-scraper';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  let browser = null;
  let page = null;

  try {
    console.log('[Dashboard API] Iniciando scraping de dashboard...');

    // Autenticar y obtener página
    const result = await getAuthenticatedPage();
    browser = result.browser;
    page = result.page;

    if (!page || !browser) {
      throw new Error('Failed to initialize browser or page');
    }

    console.log('[Dashboard API] Autenticación exitosa, extrayendo datos...');

    // Scraping de dashboard (paralelo internamente)
    const dashboardData = await scrapeDashboard(page);

    console.log('[Dashboard API] Datos extraídos exitosamente');

    // Guardar datos en archivo JSON
    const outputDir = path.join(process.cwd(), 'scraper', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, 'dashboard-data.json');
    fs.writeFileSync(outputFile, JSON.stringify(dashboardData, null, 2), 'utf-8');

    console.log(`[Dashboard API] Datos guardados en ${outputFile}`);

    await browser.close();

    return NextResponse.json({
      success: true,
      data: dashboardData,
      message: 'Dashboard data scraped successfully',
    });
  } catch (error: any) {
    console.error('[Dashboard API] Error completo:', error);
    console.error('[Dashboard API] Stack trace:', error.stack);
    console.error('[Dashboard API] Message:', error.message);

    if (browser) {
      await browser.close().catch(console.error);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to scrape dashboard',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
