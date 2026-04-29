import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { MachineStock, StockProduct, StockSummary } from '@/lib/types';

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

/**
 * API: Consultar stock desde base de datos
 * 
 * GET /api/admin/stock
 * 
 * Query params:
 * - action: 'status' | 'data' (requerido)
 * - machines: string (comma-separated IDs, opcional) - filtrar por máquinas específicas
 * 
 * Retorna:
 * - action=status: { hasData, lastScrape, machineCount }
 * - action=data: { machines: MachineStock[], stats: {...}, summary?: StockSummary[] }
 * 
 * Notas:
 * - Los datos son actualizados cada 30 min por CRON (/api/cron/scrape-stock)
 * - NO hace scraping en tiempo real - solo consulta BD
 * - Respuesta instantánea (~50-200ms)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // ============================================
    // ACTION: STATUS
    // Retorna info básica del último scraping
    // ============================================
    if (action === 'status') {
      console.log('[STOCK API] Consultando estado...');

      // Obtener fecha del último scraping
      const { data: lastStock } = await supabaseAdmin
        .from('machine_stock_current')
        .select('scraped_at')
        .order('scraped_at', { ascending: false })
        .limit(1)
        .single();

      // Contar máquinas con stock
      const { count: machineCount } = await supabaseAdmin
        .from('machine_stock_current')
        .select('*', { count: 'exact', head: true });

      return NextResponse.json({
        hasData: (machineCount || 0) > 0,
        lastScrape: lastStock?.scraped_at || null,
        machineCount: machineCount || 0,
        isRunning: false, // Ya no hacemos scraping manual
      });
    }

    // ============================================
    // ACTION: DATA
    // Retorna stock completo o filtrado
    // ============================================
    if (action === 'data') {
      const selectedIds = searchParams.get('machines')?.split(',').filter(Boolean);
      
      console.log('[STOCK API] Consultando datos de stock...', {
        filteredMachines: selectedIds?.length || 'todas'
      });

      // Query base - obtener stock con productos
      let query = supabaseAdmin
        .from('machine_stock_current')
        .select(`
          id,
          machine_id,
          machine_name,
          machine_location,
          scraped_at,
          total_products,
          total_capacity,
          total_available,
          total_to_replenish,
          products:stock_products_current(
            id,
            product_name,
            category,
            line,
            total_capacity,
            available_units,
            units_to_replenish
          )
        `)
        .order('machine_name');

      // Filtrar por máquinas específicas si se proporcionan
      if (selectedIds && selectedIds.length > 0) {
        query = query.in('machine_id', selectedIds);
      }

      const { data: stockRecords, error } = await query;

      if (error) {
        console.error('[STOCK API] Error consultando stock:', error);
        return NextResponse.json(
          { error: 'Database error', details: error.message },
          { status: 500 }
        );
      }

      if (!stockRecords || stockRecords.length === 0) {
        return NextResponse.json({
          machines: [],
          stats: {
            machineCount: 0,
            totalProducts: 0,
            totalCapacity: 0,
            totalAvailable: 0,
            totalUnitsToReplenish: 0,
          },
          summary: [],
        });
      }

      // Transformar datos a formato MachineStock
      const machines: MachineStock[] = stockRecords.map((record: any) => ({
        machineId: record.machine_id,
        machineName: record.machine_name,
        location: record.machine_location,
        scrapedAt: new Date(record.scraped_at),
        products: (record.products || []).map((p: any) => ({
          name: p.product_name,
          category: p.category,
          line: p.line,
          totalCapacity: p.total_capacity,
          availableUnits: p.available_units,
          unitsToReplenish: p.units_to_replenish,
        })),
      }));

      // Calcular estadísticas globales
      const stats = {
        machineCount: machines.length,
        totalProducts: machines.reduce((sum, m) => sum + m.products.length, 0),
        totalCapacity: machines.reduce(
          (sum, m) => sum + m.products.reduce((s, p) => s + p.totalCapacity, 0),
          0
        ),
        totalAvailable: machines.reduce(
          (sum, m) => sum + m.products.reduce((s, p) => s + p.availableUnits, 0),
          0
        ),
        totalUnitsToReplenish: machines.reduce(
          (sum, m) => sum + m.products.reduce((s, p) => s + p.unitsToReplenish, 0),
          0
        ),
      };

      // Si hay máquinas seleccionadas, calcular resumen agregado
      let summary: StockSummary[] = [];
      
      if (selectedIds && selectedIds.length > 0) {
        summary = aggregateStockSummary(machines);
      }

      console.log('[STOCK API] ✅ Datos consultados:', {
        machines: machines.length,
        products: stats.totalProducts,
        toReplenish: stats.totalUnitsToReplenish
      });

      return NextResponse.json({
        machines,
        stats,
        summary: summary.length > 0 ? summary : undefined,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use action=status or action=data' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[STOCK API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Error fetching stock data' },
      { status: 500 }
    );
  }
}

/**
 * Agrega productos por nombre desde múltiples máquinas
 */
function aggregateStockSummary(machines: MachineStock[]): StockSummary[] {
  const productMap = new Map<string, StockSummary>();

  for (const machine of machines) {
    for (const product of machine.products) {
      const normalizedName = product.name.trim().toUpperCase();

      if (productMap.has(normalizedName)) {
        const existing = productMap.get(normalizedName)!;
        existing.totalUnitsToReplenish += product.unitsToReplenish;
        existing.machineCount += 1;
        
        if (product.unitsToReplenish > 0 && !existing.machineNames.includes(machine.machineName)) {
          existing.machineNames.push(machine.machineName);
        }
      } else {
        productMap.set(normalizedName, {
          productName: product.name, // Mantener formato original
          category: product.category,
          totalUnitsToReplenish: product.unitsToReplenish,
          machineCount: 1,
          machineNames: product.unitsToReplenish > 0 ? [machine.machineName] : [],
        });
      }
    }
  }

  // Ordenar por cantidad descendente
  return Array.from(productMap.values())
    .sort((a, b) => b.totalUnitsToReplenish - a.totalUnitsToReplenish);
}
