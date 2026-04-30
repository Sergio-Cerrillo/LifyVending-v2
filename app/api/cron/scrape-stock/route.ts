import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TelevendScraper } from '@/scraper/televend-scraper';

// Cliente Supabase con service_role para operaciones sin RLS
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

/**
 * CRON JOB: Scraping automático de STOCK cada 30 minutos
 * 
 * Este endpoint es llamado por cron-job.org cada 30 minutos
 * 
 * Flujo:
 * 1. Valida token de seguridad (CRON_SECRET)
 * 2. Obtiene lista de máquinas activas
 * 3. Inicializa scraper de Televend y hace login
 * 4. Para cada máquina:
 *    a. Scrape stock desde Televend
 *    b. UPSERT en machine_stock_current (actualiza si existe, crea si no)
 *    c. DELETE productos antiguos de esa máquina
 *    d. INSERT nuevos productos
 * 5. Retorna resultado con estadísticas
 * 
 * Notas:
 * - NO guarda histórico - solo mantiene el snapshot más reciente
 * - UPSERT garantiza que solo hay 1 registro por máquina
 * - DELETE CASCADE elimina productos automáticamente al actualizar
 * - Si una máquina falla, continúa con las siguientes
 * 
 * Seguridad:
 * - Requiere header Authorization: Bearer <CRON_SECRET>
 * - Solo cron-job.org debe conocer este secret
 */
export async function GET(request: NextRequest) {
  console.log('[CRON STOCK v3] Iniciando scraping automático de stock...');

  // ============================================
  // 1. VALIDAR TOKEN DE SEGURIDAD
  // ============================================
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (!process.env.CRON_SECRET) {
    console.error('[CRON STOCK v3] ERROR: CRON_SECRET no está configurado');
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  if (authHeader !== expectedAuth) {
    console.warn('[CRON STOCK v3] Intento de acceso no autorizado');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const supabaseAdmin = getSupabaseAdmin();

  try {
    // ============================================
    // 2. OBTENER MÁQUINAS ACTIVAS
    // ============================================
    console.log('[CRON STOCK v3] Obteniendo lista de máquinas activas...');
    
    const { data: activeMachines, error: machinesError } = await supabaseAdmin
      .from('machines')
      .select('id, name, location, orain_machine_id, televend_machine_id')
      .order('name');

    if (machinesError) {
      console.error('[CRON STOCK v3] Error obteniendo máquinas:', machinesError);
      return NextResponse.json(
        { error: 'Database error', details: machinesError.message },
        { status: 500 }
      );
    }

    if (!activeMachines || activeMachines.length === 0) {
      console.log('[CRON STOCK v3] No hay máquinas activas para scrapear');
      return NextResponse.json({
        success: true,
        message: 'No active machines to scrape',
        machinesScraped: 0,
        machinesFailed: 0,
        duration: Date.now() - startTime
      });
    }

    console.log(`[CRON STOCK v3] ${activeMachines.length} máquinas activas encontradas`);

    // ============================================
    // 3. INICIALIZAR SCRAPER TELEVEND
    // ============================================
    console.log('[CRON STOCK v3] Inicializando scraper de Televend...');
    
    const televend = new TelevendScraper({
      username: process.env.TELEVEND_USERNAME!,
      password: process.env.TELEVEND_PASSWORD!,
      headless: true,
    });

    await televend.initialize();
    await televend.login();
    await televend.navigateToMachines();

    console.log('[CRON STOCK] ✅ Login exitoso en Televend');

    // ============================================
    // 4. SCRAPE Y ALMACENAR STOCK POR MÁQUINA
    // ============================================
    let successCount = 0;
    let failCount = 0;
    const errors: Array<{ machineId: string; machineName: string; error: string }> = [];

    for (const machine of activeMachines) {
      try {
        console.log(`[CRON STOCK] Procesando: ${machine.name} (ID: ${machine.id})`);

        // Construir URL de la máquina en Televend
        // Asumiendo que la URL sigue el patrón:
        // https://app.televendcloud.com/companies/4949/machines/{id}
        const machineUrl = machine.televend_machine_id 
          ? `https://app.televendcloud.com/companies/4949/machines/${machine.televend_machine_id}`
          : null;

        if (!machineUrl) {
          console.warn(`[CRON STOCK] ⚠️  Máquina ${machine.name} no tiene televend_machine_id, saltando...`);
          failCount++;
          errors.push({
            machineId: machine.id,
            machineName: machine.name,
            error: 'No televend_machine_id configured'
          });
          continue;
        }

        // Scrape stock de la máquina
        const stockData = await televend.extractStockForMachine({
          id: machine.id,
          name: machine.name,
          url: machineUrl,
        });

        if (!stockData || !stockData.products || stockData.products.length === 0) {
          console.warn(`[CRON STOCK] ⚠️  No se obtuvieron productos para ${machine.name}`);
          failCount++;
          errors.push({
            machineId: machine.id,
            machineName: machine.name,
            error: 'No products returned from scraper'
          });
          continue;
        }

        // Calcular estadísticas
        const totalProducts = stockData.products.length;
        const totalCapacity = stockData.products.reduce((sum, p) => sum + (p.totalCapacity || 0), 0);
        const totalAvailable = stockData.products.reduce((sum, p) => sum + (p.availableUnits || 0), 0);
        const totalToReplenish = stockData.products.reduce((sum, p) => sum + (p.unitsToReplenish || 0), 0);

        // ============================================
        // 4a. UPSERT en machine_stock_current
        // ============================================
        const { data: stockRecord, error: stockError } = await supabaseAdmin
          .from('machine_stock_current')
          .upsert({
            machine_id: machine.id,
            machine_name: machine.name,
            machine_location: machine.location,
            scraped_at: new Date().toISOString(),
            total_products: totalProducts,
            total_capacity: totalCapacity,
            total_available: totalAvailable,
            total_to_replenish: totalToReplenish,
          }, {
            onConflict: 'machine_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (stockError) {
          console.error(`[CRON STOCK] Error upserting stock para ${machine.name}:`, stockError);
          failCount++;
          errors.push({
            machineId: machine.id,
            machineName: machine.name,
            error: `Database error: ${stockError.message}`
          });
          continue;
        }

        // ============================================
        // 4b. BORRAR productos antiguos
        // ============================================
        const { error: deleteError } = await supabaseAdmin
          .from('stock_products_current')
          .delete()
          .eq('stock_id', stockRecord.id);

        if (deleteError) {
          console.error(`[CRON STOCK] Error eliminando productos antiguos para ${machine.name}:`, deleteError);
          // Continuar de todos modos para insertar nuevos
        }

        // ============================================
        // 4c. INSERTAR nuevos productos
        // ============================================
        const productsToInsert = stockData.products.map(p => ({
          stock_id: stockRecord.id,
          product_name: p.name,
          category: p.category || null,
          line: p.line || null,
          total_capacity: p.totalCapacity || 0,
          available_units: p.availableUnits || 0,
          units_to_replenish: p.unitsToReplenish || 0,
        }));

        const { error: productsError } = await supabaseAdmin
          .from('stock_products_current')
          .insert(productsToInsert);

        if (productsError) {
          console.error(`[CRON STOCK] Error insertando productos para ${machine.name}:`, productsError);
          failCount++;
          errors.push({
            machineId: machine.id,
            machineName: machine.name,
            error: `Failed to insert products: ${productsError.message}`
          });
          continue;
        }

        console.log(`[CRON STOCK] ✅ ${machine.name}: ${totalProducts} productos, ${totalToReplenish} a reponer`);
        successCount++;

      } catch (error: any) {
        console.error(`[CRON STOCK] Error procesando ${machine.name}:`, error);
        failCount++;
        errors.push({
          machineId: machine.id,
          machineName: machine.name,
          error: error.message || 'Unknown error'
        });
      }
    }

    // ============================================
    // 5. CERRAR SCRAPER
    // ============================================
    await televend.close();
    console.log('[CRON STOCK] Scraper cerrado');

    // ============================================
    // 6. RESULTADO FINAL
    // ============================================
    const duration = Date.now() - startTime;
    const durationMinutes = (duration / 1000 / 60).toFixed(2);

    console.log(`[CRON STOCK] ✅ Completado en ${durationMinutes} minutos`);
    console.log(`[CRON STOCK] Exitosas: ${successCount}, Fallidas: ${failCount}`);

    return NextResponse.json({
      success: true,
      machinesScraped: successCount,
      machinesFailed: failCount,
      totalMachines: activeMachines.length,
      duration,
      durationMinutes: parseFloat(durationMinutes),
      timestamp: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('[CRON STOCK] Error fatal:', error);
    
    return NextResponse.json(
      {
        error: 'Fatal error during stock scraping',
        message: error.message,
        duration: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}
