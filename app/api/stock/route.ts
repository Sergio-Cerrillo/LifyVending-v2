import { NextRequest, NextResponse } from 'next/server';
import { FrekuentScraper } from '@/scraper/frekuent-scraper';
import { TelevendScraper } from '@/scraper/televend-scraper';
import { aggregateStock, getStockStats } from '@/scraper/aggregate';
import type { MachineStock } from '@/lib/types';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase con service_role para operaciones sin RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Configuración para Next.js
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Almacenamiento en memoria (en producción, usar base de datos)
let cachedStock: MachineStock[] = [];
let lastScrapeDate: Date | null = null;
let isScrapingNow = false;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'status') {
      return NextResponse.json({
        isRunning: isScrapingNow,
        lastScrape: lastScrapeDate,
        machineCount: cachedStock.length,
        hasData: cachedStock.length > 0,
      });
    }

    if (action === 'data') {
      const selectedIds = searchParams.get('machines')?.split(',').filter(Boolean);
      
      if (selectedIds && selectedIds.length > 0) {
        const summary = aggregateStock(cachedStock, selectedIds);
        const stats = getStockStats(cachedStock, selectedIds);
        
        return NextResponse.json({
          summary,
          stats,
          machines: cachedStock.filter(m => selectedIds.includes(m.machineId)),
        });
      }

      return NextResponse.json({
        machines: cachedStock,
        stats: getStockStats(cachedStock),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching stock data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (isScrapingNow) {
      return NextResponse.json(
        { error: 'Scraping ya en progreso' },
        { status: 429 }
      );
    }

    // Leer el body para obtener el source
    const body = await request.json().catch(() => ({}));
    const source = body.source || 'both'; // 'both', 'televend', 'frekuent'

    const user = process.env.ORAIN_USER;
    const pass = process.env.ORAIN_PASS;

    if (!user || !pass) {
      return NextResponse.json(
        { error: 'Credenciales de Orain no configuradas' },
        { status: 500 }
      );
    }

    isScrapingNow = true;

    // Ejecutar scraping según la fuente seleccionada
    console.log(`[STOCK-SCRAPE] Iniciando scraping de: ${source.toUpperCase()}...`);
    
    let frekuentResults: MachineStock[] = [];
    let televendResults: MachineStock[] = [];

    if (source === 'both' || source === 'frekuent') {
      // Scraping de Frekuent
      const frekuentScraper = new FrekuentScraper({ user, pass, headless: true });
      frekuentResults = await frekuentScraper.scrapeAllMachines((current, total, name) => {
        console.log(`[FREKUENT] [${current}/${total}] ${name}`);
      }).catch(error => {
        console.error('[FREKUENT] Error en scraping:', error);
        return [] as MachineStock[];
      });
    }

    if (source === 'both' || source === 'televend') {
      // Scraping de Televend
      const televendScraper = new TelevendScraper({
        username: process.env.TELEVEND_USERNAME || '',
        password: process.env.TELEVEND_PASSWORD || '',
        headless: true
      });
      televendResults = await televendScraper.scrapeAllMachinesStock((current, total, name) => {
        console.log(`[TELEVEND] [${current}/${total}] ${name}`);
      }).catch(error => {
        console.error('[TELEVEND] Error en scraping:', error);
        return [] as MachineStock[];
      });
    }

    // Combinar resultados de ambas fuentes
    const results = [...frekuentResults, ...televendResults];
    console.log(`[STOCK-SCRAPE] Total: ${frekuentResults.length} Frekuent + ${televendResults.length} Televend = ${results.length} máquinas`);

    cachedStock = results;
    lastScrapeDate = new Date();

    // ============================================
    // GUARDAR MÁQUINAS EN BASE DE DATOS (OPTIMIZADO)
    // ============================================
    console.log(`[STOCK-SCRAPE] Guardando ${results.length} máquinas en BBDD (modo bulk)...`);
    
    let machinesCreated = 0;
    let machinesUpdated = 0;

    // OPTIMIZACIÓN 1: Obtener todas las máquinas existentes de una vez
    const { data: existingMachines } = await supabaseAdmin
      .from('machines')
      .select('id, frekuent_machine_id, orain_machine_id, televend_machine_id');

    const existingMachinesMap = new Map<string, any>();
    existingMachines?.forEach(machine => {
      if (machine.frekuent_machine_id) {
        existingMachinesMap.set(`frekuent:${machine.frekuent_machine_id}`, machine);
      }
      if (machine.orain_machine_id) {
        existingMachinesMap.set(`orain:${machine.orain_machine_id}`, machine);
      }
      if (machine.televend_machine_id) {
        existingMachinesMap.set(`televend:${machine.televend_machine_id}`, machine);
      }
    });

    // OPTIMIZACIÓN 2: Preparar arrays para operaciones bulk
    const machinesToUpdate: any[] = [];
    const machinesToInsert: any[] = [];
    const machinesMigrate: any[] = [];

    for (const machineStock of results) {
      const machineId = machineStock.machineId;
      const machineName = machineStock.machineName;
      
      // Determinar fuente (Frekuent o Televend)
      const isTelevend = machineId.startsWith('televend_');
      const frekuent_machine_id = isTelevend ? null : machineId;
      const televend_machine_id = isTelevend ? machineId : null;

      let existingMachine = null;

      if (frekuent_machine_id) {
        existingMachine = existingMachinesMap.get(`frekuent:${frekuent_machine_id}`);
        
        // Fallback para migración de orain_machine_id
        if (!existingMachine) {
          existingMachine = existingMachinesMap.get(`orain:${frekuent_machine_id}`);
          if (existingMachine) {
            machinesMigrate.push({
              id: existingMachine.id,
              frekuent_machine_id: frekuent_machine_id,
              orain_machine_id: null
            });
            console.log(`[STOCK-SCRAPE] Máquina a migrar: ${machineName}`);
          }
        }
      } else if (televend_machine_id) {
        existingMachine = existingMachinesMap.get(`televend:${televend_machine_id}`);
      }

      if (existingMachine) {
        machinesToUpdate.push({
          id: existingMachine.id,
          last_scraped_at: new Date().toISOString()
        });
        machinesUpdated++;
      } else {
        machinesToInsert.push({
          frekuent_machine_id,
          televend_machine_id,
          name: machineName,
          location: machineStock.location || 'Sin ubicación',
          status: 'active',
          last_scraped_at: new Date().toISOString()
        });
        machinesCreated++;
      }
    }

    // OPTIMIZACIÓN 3: Ejecutar operaciones bulk en paralelo
    const bulkOperations = [];

    if (machinesMigrate.length > 0) {
      console.log(`[STOCK-SCRAPE] Migrando ${machinesMigrate.length} máquinas...`);
      bulkOperations.push(
        supabaseAdmin.from('machines').upsert(machinesMigrate, { onConflict: 'id' })
      );
    }

    if (machinesToUpdate.length > 0) {
      console.log(`[STOCK-SCRAPE] Actualizando ${machinesToUpdate.length} máquinas...`);
      bulkOperations.push(
        supabaseAdmin.from('machines').upsert(machinesToUpdate, { onConflict: 'id' })
      );
    }

    if (machinesToInsert.length > 0) {
      console.log(`[STOCK-SCRAPE] Insertando ${machinesToInsert.length} máquinas nuevas...`);
      bulkOperations.push(
        supabaseAdmin.from('machines').insert(machinesToInsert)
      );
    }

    // Ejecutar todas las operaciones en paralelo
    if (bulkOperations.length > 0) {
      await Promise.all(bulkOperations);
    }

    isScrapingNow = false;
    console.log(`[STOCK-SCRAPE] Guardado completado: ${machinesCreated} creadas, ${machinesUpdated} actualizadas`);

    const stats = getStockStats(results);

    return NextResponse.json({
      success: true,
      machineCount: results.length,
      machinesCreated,
      machinesUpdated,
      productCount: stats.totalProducts,
      unitsToReplenish: stats.totalUnitsToReplenish,
      scrapedAt: lastScrapeDate,
    });
  } catch (error: any) {
    isScrapingNow = false;
    console.error('Error during scraping:', error);
    
    return NextResponse.json(
      { error: error.message || 'Error durante el scraping' },
      { status: 500 }
    );
  }
}
