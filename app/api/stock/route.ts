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

// Estado del scraping en memoria
let isScrapingNow = false;

/**
 * GET /api/stock
 * 
 * Obtiene datos de stock desde la BASE DE DATOS
 * 
 * Query params:
 * - action=status: Estado del scraping y metadata
 * - action=data: Datos de stock completos
 * - machines=id1,id2: Filtrar por IDs de máquinas específicas
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // ============================================
    // ACTION: STATUS
    // ============================================
    if (action === 'status') {
      // Obtener la fecha del último scraping de la BD
      const { data: latestStock } = await supabaseAdmin
        .from('machine_stock_current')
        .select('scraped_at')
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();

      // Contar cuántas máquinas tienen stock en la BD
      const { count } = await supabaseAdmin
        .from('machine_stock_current')
        .select('*', { count: 'exact', head: true });

      return NextResponse.json({
        isRunning: isScrapingNow,
        lastScrape: latestStock?.scraped_at || null,
        machineCount: count || 0,
        hasData: (count || 0) > 0,
      });
    }

    // ============================================
    // ACTION: DATA
    // ============================================
    if (action === 'data') {
      const selectedIds = searchParams.get('machines')?.split(',').filter(Boolean);
      
      // Query base: obtener stock de máquinas con sus productos
      let query = supabaseAdmin
        .from('machine_stock_current')
        .select(`
          *,
          products:stock_products_current(
            id,
            product_name,
            category,
            line,
            total_capacity,
            available_units,
            units_to_replenish
          )
        `);

      // Filtrar por IDs de máquinas si se especificaron
      if (selectedIds && selectedIds.length > 0) {
        query = query.in('machine_id', selectedIds);
      }

      const { data: stockData, error } = await query;

      if (error) {
        console.error('[STOCK-API] Error obteniendo datos:', error);
        throw new Error(error.message);
      }

      // Convertir formato BD → formato MachineStock
      const machines: MachineStock[] = (stockData || []).map(stock => ({
        machineId: stock.machine_id,
        machineName: stock.machine_name,
        location: stock.machine_location || undefined,
        scrapedAt: new Date(stock.scraped_at),
        products: (stock.products || []).map((p: any) => ({
          name: p.product_name,
          category: p.category || undefined,
          line: p.line || undefined,
          totalCapacity: p.total_capacity,
          availableUnits: p.available_units,
          unitsToReplenish: p.units_to_replenish,
        })),
      }));

      // Si hay máquinas seleccionadas, calcular summary
      if (selectedIds && selectedIds.length > 0) {
        const summary = aggregateStock(machines, selectedIds);
        const stats = getStockStats(machines, selectedIds);
        
        return NextResponse.json({
          summary,
          stats,
          machines,
        });
      }

      // Sin selección: devolver todas las máquinas
      return NextResponse.json({
        machines,
        stats: getStockStats(machines),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[STOCK-API] Error en GET:', error);
    return NextResponse.json(
      { error: error.message || 'Error fetching stock data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stock
 * 
 * Ejecuta scraping y GUARDA en la BASE DE DATOS
 * 
 * Body:
 * - source: 'both' | 'televend' | 'frekuent'
 */
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
    
    // Validar que no haya IDs duplicados
    const uniqueIds = new Set(results.map(m => m.machineId));
    if (uniqueIds.size !== results.length) {
      console.warn(`⚠️ [STOCK-SCRAPE] Detectados IDs duplicados: ${results.length} total, ${uniqueIds.size} únicos`);
      // Filtrar duplicados quedándonos con el primero
      const seenIds = new Set<string>();
      const filteredResults = results.filter(m => {
        if (seenIds.has(m.machineId)) {
          console.warn(`  ⚠️ Máquina duplicada ignorada: ${m.machineId} - ${m.machineName}`);
          return false;
        }
        seenIds.add(m.machineId);
        return true;
      });
      results.length = 0;
      results.push(...filteredResults);
      console.log(`[STOCK-SCRAPE] Después de eliminar duplicados: ${results.length} máquinas`);
    }

    const scrapedAt = new Date();

    // ============================================
    // GUARDAR MÁQUINAS Y STOCK EN BASE DE DATOS
    // ============================================
    console.log(`[STOCK-SCRAPE] Guardando ${results.length} máquinas en BBDD...`);
    
    let machinesCreated = 0;
    let machinesUpdated = 0;
    let stockRecordsCreated = 0;

    // PASO 1: Obtener todas las máquinas existentes
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

    // PASO 2: Preparar operaciones bulk para machines
    const machinesToUpdate: any[] = [];
    const machinesToInsert: any[] = [];

    // Mapear machineStock → machine_id de BD
    const machineStockToDbId = new Map<string, string>();

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
        }
      } else if (televend_machine_id) {
        existingMachine = existingMachinesMap.get(`televend:${televend_machine_id}`);
      }

      if (existingMachine) {
        machinesToUpdate.push({
          id: existingMachine.id,
          last_scraped_at: scrapedAt.toISOString(),
          frekuent_machine_id, // Actualizar por si era orain_machine_id antiguo
          televend_machine_id,
        });
        machineStockToDbId.set(machineId, existingMachine.id);
        machinesUpdated++;
      } else {
        // Generar UUID temporal para identificar después del insert
        const tempId = `temp_${Math.random().toString(36).substring(7)}`;
        machinesToInsert.push({
          frekuent_machine_id,
          televend_machine_id,
          name: machineName,
          location: machineStock.location || 'Sin ubicación',
          status: 'active',
          last_scraped_at: scrapedAt.toISOString()
        });
        machineStockToDbId.set(machineId, tempId);
        machinesCreated++;
      }
    }

    // PASO 3: Ejecutar operaciones bulk en machines
    if (machinesToUpdate.length > 0) {
      console.log(`[STOCK-SCRAPE] Actualizando ${machinesToUpdate.length} máquinas...`);
      await supabaseAdmin.from('machines').upsert(machinesToUpdate, { onConflict: 'id' });
    }

    let insertedMachines: any[] = [];
    if (machinesToInsert.length > 0) {
      console.log(`[STOCK-SCRAPE] Insertando ${machinesToInsert.length} máquinas nuevas...`);
      const { data, error } = await supabaseAdmin
        .from('machines')
        .insert(machinesToInsert)
        .select('id, frekuent_machine_id, televend_machine_id');
      
      if (error) {
        console.error('[STOCK-SCRAPE] Error insertando máquinas:', error);
      } else {
        insertedMachines = data || [];
        
        // Actualizar el map con los IDs reales
        // Buscar todas las entradas con IDs temporales y actualizarlas
        for (const [key, value] of machineStockToDbId.entries()) {
          if (typeof value === 'string' && value.startsWith('temp_')) {
            // Buscar la máquina insertada que corresponde a esta clave
            const insertedMachine = insertedMachines.find(m => 
              (m.frekuent_machine_id && m.frekuent_machine_id === key) ||
              (m.televend_machine_id && m.televend_machine_id === key)
            );
            
            if (insertedMachine) {
              console.log(`[STOCK-SCRAPE] Mapeando ${key} → ${insertedMachine.id}`);
              machineStockToDbId.set(key, insertedMachine.id);
            } else {
              console.warn(`[STOCK-SCRAPE] No se encontró máquina insertada para ${key}`);
            }
          }
        }
      }
    }

    console.log(`[STOCK-SCRAPE] Máquinas guardadas: ${machinesCreated} creadas, ${machinesUpdated} actualizadas`);

    // PASO 4: GUARDAR STOCK EN LAS TABLAS NUEVAS
    console.log(`[STOCK-SCRAPE] Guardando stock en tablas machine_stock_current...`);

    let stockSaveErrors = 0;
    for (const machineStock of results) {
      const dbMachineId = machineStockToDbId.get(machineStock.machineId);
      
      if (!dbMachineId) {
        console.error(`[STOCK-SCRAPE] ❌ No se encontró ID de BD para ${machineStock.machineId} (${machineStock.machineName})`);
        stockSaveErrors++;
        continue;
      }
      
      if (dbMachineId.startsWith('temp_')) {
        console.error(`[STOCK-SCRAPE] ❌ ID temporal no resuelto para ${machineStock.machineId} (${machineStock.machineName})`);
        stockSaveErrors++;
        continue;
      }

      // Calcular estadísticas
      const totalProducts = machineStock.products.length;
      const totalCapacity = machineStock.products.reduce((sum, p) => sum + p.totalCapacity, 0);
      const totalAvailable = machineStock.products.reduce((sum, p) => sum + p.availableUnits, 0);
      const totalToReplenish = machineStock.products.reduce((sum, p) => sum + p.unitsToReplenish, 0);

      // UPSERT en machine_stock_current (reemplaza el anterior)
      const { data: stockRecord, error: stockError } = await supabaseAdmin
        .from('machine_stock_current')
        .upsert({
          machine_id: dbMachineId,
          machine_name: machineStock.machineName,
          machine_location: machineStock.location || null,
          scraped_at: scrapedAt.toISOString(),
          total_products: totalProducts,
          total_capacity: totalCapacity,
          total_available: totalAvailable,
          total_to_replenish: totalToReplenish,
        }, {
          onConflict: 'machine_id', // UPSERT por machine_id
          ignoreDuplicates: false    // Actualizar si existe
        })
        .select('id')
        .single();

      if (stockError) {
        console.error(`[STOCK-SCRAPE] Error upserting stock para máquina ${machineStock.machineId}:`, stockError);
        continue;
      }

      if (!stockRecord) {
        console.warn(`[STOCK-SCRAPE] No se pudo obtener ID de stock para ${machineStock.machineId}`);
        continue;
      }

      // BORRAR productos anteriores
      await supabaseAdmin
        .from('stock_products_current')
        .delete()
        .eq('stock_id', stockRecord.id);

      // INSERTAR nuevos productos
      if (machineStock.products.length > 0) {
        const productsToInsert = machineStock.products.map(p => ({
          stock_id: stockRecord.id,
          product_name: p.name,
          category: p.category || null,
          line: p.line || null,
          total_capacity: p.totalCapacity,
          available_units: p.availableUnits,
          units_to_replenish: p.unitsToReplenish,
        }));

        const { error: productsError } = await supabaseAdmin
          .from('stock_products_current')
          .insert(productsToInsert);

        if (productsError) {
          console.error(`[STOCK-SCRAPE] Error insertando productos para stock ${stockRecord.id}:`, productsError);
        } else {
          stockRecordsCreated++;
        }
      }
    }

    isScrapingNow = false;
    console.log(`[STOCK-SCRAPE] ✅ Stock guardado: ${stockRecordsCreated} máquinas con productos`);
    if (stockSaveErrors > 0) {
      console.error(`[STOCK-SCRAPE] ⚠️ Errores al guardar: ${stockSaveErrors} máquinas fallaron`);
    }
    console.log(`[STOCK-SCRAPE] 📊 Resumen: ${results.length} scrapeadas → ${stockRecordsCreated} guardadas → ${stockSaveErrors} errores`);

    const stats = getStockStats(results);

    return NextResponse.json({
      success: true,
      machineCount: results.length,
      machinesCreated,
      machinesUpdated,
      stockRecordsCreated,
      stockSaveErrors,
      productCount: stats.totalProducts,
      unitsToReplenish: stats.totalUnitsToReplenish,
      scrapedAt,
    });
  } catch (error: any) {
    isScrapingNow = false;
    console.error('[STOCK-SCRAPE] Error durante scraping:', error);
    
    return NextResponse.json(
      { error: error.message || 'Error durante el scraping' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stock
 * 
 * Vacía las tablas de stock (machine_stock_current y stock_products_current)
 * 
 * Los productos se borran automáticamente por CASCADE
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('[STOCK-API] Vaciando tablas de stock...');

    // Borrar todos los registros de machine_stock_current
    // Los productos se borran automáticamente por CASCADE
    const { error } = await supabaseAdmin
      .from('machine_stock_current')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Borrar todos (condición siempre true)

    if (error) {
      console.error('[STOCK-API] Error vaciando tablas:', error);
      throw new Error(error.message);
    }

    console.log('[STOCK-API] ✅ Tablas de stock vaciadas correctamente');

    return NextResponse.json({
      success: true,
      message: 'Tablas de stock vaciadas correctamente',
    });
  } catch (error: any) {
    console.error('[STOCK-API] Error en DELETE:', error);
    return NextResponse.json(
      { error: error.message || 'Error vaciando tablas de stock' },
      { status: 500 }
    );
  }
}

