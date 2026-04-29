import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scrapeFrekuentRevenueMultiple, scrapeFrekuentRevenueMock } from '@/scraper/frekuent-revenue-scraper';
import { TelevendScraper } from '@/scraper/televend-scraper';

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

/**
 * CRON JOB: Scraping automático de máquinas cada hora
 * 
 * Este endpoint es llamado por Vercel Cron cada hora en punto (12:00, 13:00, etc.)
 * 
 * Flujo:
 * 1. Valida token de seguridad (CRON_SECRET)
 * 2. Crea registro en scrape_runs
 * 3. Ejecuta scraping de Frekuent (obtiene todas las máquinas con recaudaciones) 
 * 4. Para cada máquina en el scraping:
 *    - Si ya existe (por frekuent_machine_id): actualiza last_scraped_at
 *    - Si NO existe: la crea automáticamente en la BD
 * 5. Actualiza columnas de recaudación directamente en machines (daily/monthly)
 * 6. Actualiza scrape_run con resultado
 * 
 * Los clientes consultan directamente estos datos de machines - NO se usan snapshots
 * 
 * Seguridad:
 * - Requiere header Authorization: Bearer <CRON_SECRET>
 * - Solo Vercel Cron debe conocer este secret
 */
export async function GET(request: NextRequest) {
  console.log('[CRON] Iniciando scraping automático de máquinas...');

  // ============================================
  // 1. VALIDAR TOKEN DE SEGURIDAD
  // ============================================
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  
  if (!process.env.CRON_SECRET) {
    console.error('[CRON] ERROR: CRON_SECRET no está configurado');
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  if (authHeader !== expectedAuth) {
    console.warn('[CRON] Intento de acceso no autorizado');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // ============================================
  // 2. CREAR REGISTRO DE SCRAPE_RUN
  // ============================================
  const { data: scrapeRun, error: scrapeRunError } = await supabaseAdmin
    .from('scrape_runs')
    .insert({
      triggered_by_user_id: null, // NULL = automático (cron)
      triggered_role: null,
      status: 'running'
    })
    .select()
    .single();

  if (scrapeRunError || !scrapeRun) {
    console.error('[CRON] Error creando scrape_run:', scrapeRunError);
    return NextResponse.json(
      { error: 'Failed to create scrape run', details: scrapeRunError?.message },
      { status: 500 }
    );
  }

  const scrapeRunId = scrapeRun.id;
  console.log(`[CRON] Scrape run creado: ${scrapeRunId}`);

  try {
    // ============================================
    // 3. EJECUTAR SCRAPING (Frekuent + Televend en paralelo)
    // ============================================
    const useMock = process.env.USE_MOCK_SCRAPER === 'true';
    console.log(`[CRON] Modo: ${useMock ? 'MOCK' : 'REAL'}`);

    // Ejecutar scraping de Frekuent
    const frekuentScrapePromise = useMock
      ? (async () => {
          const daily = await scrapeFrekuentRevenueMock('daily');
          const monthly = await scrapeFrekuentRevenueMock('monthly');
          return { daily, monthly };
        })()
      : scrapeFrekuentRevenueMultiple({
          username: process.env.FREKUENT_USERNAME || process.env.ORAIN_USERNAME!,
          password: process.env.FREKUENT_PASSWORD || process.env.ORAIN_PASSWORD!
        });

    // Ejecutar scraping de Televend (solo en modo REAL)
    const televendScrapePromise = useMock
      ? Promise.resolve({ daily: { data: [], totalMachines: 0 }, monthly: { data: [], totalMachines: 0 } })
      : (async () => {
          try {
            const televendScraper = new TelevendScraper({
              username: process.env.TELEVEND_USERNAME!,
              password: process.env.TELEVEND_PASSWORD!,
              headless: true
            });

            const results = await televendScraper.scrapeAllMachinesRevenue((current, total, name) => {
              console.log(`[CRON-TELEVEND] [${current}/${total}] ${name}`);
            });

            await televendScraper.close();

            // Convertir al formato esperado
            return {
              daily: {
                data: results.map(r => ({
                  machineName: r.machineName,
                  deviceId: `televend_${r.machineName}`,
                  location: r.location,
                  totalRevenue: r.daily,
                  period: 'daily' as const,
                  scrapedAt: new Date()
                })),
                totalMachines: results.length,
                success: true,
                scrapedAt: new Date()
              },
              monthly: {
                data: results.map(r => ({
                  machineName: r.machineName,
                  deviceId: `televend_${r.machineName}`,
                  location: r.location,
                  totalRevenue: r.monthly,
                  period: 'monthly' as const,
                  scrapedAt: new Date()
                })),
                totalMachines: results.length,
                success: true,
                scrapedAt: new Date()
              }
            };
          } catch (error) {
            console.error('[CRON-TELEVEND] Error en scraping:', error);
            return {
              daily: { data: [], totalMachines: 0, success: false, scrapedAt: new Date() },
              monthly: { data: [], totalMachines: 0, success: false, scrapedAt: new Date() }
            };
          }
        })();

    // Ejecutar ambos scrapers en paralelo
    const [frekuentResult, televendResult] = await Promise.all([
      frekuentScrapePromise,
      televendScrapePromise
    ]);

    console.log(`[CRON] Frekuent daily: ${frekuentResult.daily.totalMachines} máquinas, monthly: ${frekuentResult.monthly.totalMachines} máquinas`);
    console.log(`[CRON] Televend daily: ${televendResult.daily.totalMachines} máquinas, monthly: ${televendResult.monthly.totalMachines} máquinas`);

    // ============================================
    // 4. CONSOLIDAR DATOS POR MÁQUINA
    // ============================================
    const machinesMap = new Map<string, {
      location: string;
      periods: {
        daily?: { totalRevenue: number };
        monthly?: { totalRevenue: number };
      };
      source: 'frekuent' | 'televend';
    }>();

    // Procesar datos de Frekuent (daily)
    for (const item of frekuentResult.daily.data) {
      const key = item.machineName;
      if (!machinesMap.has(key)) {
        machinesMap.set(key, {
          location: item.location,
          periods: {},
          source: 'frekuent'
        });
      }
      const machine = machinesMap.get(key)!;
      machine.periods.daily = { totalRevenue: item.totalRevenue };
    }

    // Procesar datos de Frekuent (monthly)
    for (const item of frekuentResult.monthly.data) {
      const key = item.machineName;
      if (!machinesMap.has(key)) {
        machinesMap.set(key, {
          location: item.location,
          periods: {},
          source: 'frekuent'
        });
      }
      const machine = machinesMap.get(key)!;
      machine.periods.monthly = { totalRevenue: item.totalRevenue };
    }

    // Procesar datos de Televend (daily)
    for (const item of televendResult.daily.data) {
      const key = item.machineName;
      if (!machinesMap.has(key)) {
        machinesMap.set(key, {
          location: item.location,
          periods: {},
          source: 'televend'
        });
      }
      const machine = machinesMap.get(key)!;
      machine.periods.daily = { totalRevenue: item.totalRevenue };
    }

    // Procesar datos de Televend (monthly)
    for (const item of televendResult.monthly.data) {
      const key = item.machineName;
      if (!machinesMap.has(key)) {
        machinesMap.set(key, {
          location: item.location,
          periods: {},
          source: 'televend'
        });
      }
      const machine = machinesMap.get(key)!;
      machine.periods.monthly = { totalRevenue: item.totalRevenue };
    }

    // ============================================
    // 5. PROCESAR CADA MÁQUINA (crear si no existe)
    // ============================================
    let machinesCreated = 0;
    let machinesUpdated = 0;
    let revenueUpdates = 0;

    for (const [machineName, machineData] of machinesMap.entries()) {
      const { location, periods, source } = machineData;
      
      // Determinar IDs según la fuente
      const frekuent_machine_id = source === 'frekuent' ? machineName : null;
      const televend_machine_id = source === 'televend' ? `televend_${machineName.replace(/[^a-zA-Z0-9]/g, '_')}` : null;

      // Buscar si la máquina ya existe (por cualquier ID)
      let existingMachine = null;
      
      if (frekuent_machine_id) {
        // Intentar con frekuent_machine_id
        const { data: frekuentData } = await supabaseAdmin
          .from('machines')
          .select('id')
          .eq('frekuent_machine_id', frekuent_machine_id)
          .single();
        
        if (frekuentData) {
          existingMachine = frekuentData;
        } else {
          // Fallback: migrar desde orain_machine_id
          const { data: orainData } = await supabaseAdmin
            .from('machines')
            .select('id')
            .eq('orain_machine_id', frekuent_machine_id)
            .single();
          
          if (orainData) {
            // Migrar de Orain a Frekuent
            await supabaseAdmin
              .from('machines')
              .update({
                frekuent_machine_id: frekuent_machine_id,
                orain_machine_id: null
              })
              .eq('id', orainData.id);
            
            existingMachine = orainData;
            console.log(`[CRON] Máquina migrada de Orain a Frekuent/Orain: ${machineName}` );
          }
        }
      } else if (televend_machine_id) {
        const { data } = await supabaseAdmin
          .from('machines')
          .select('id')
          .eq('televend_machine_id', televend_machine_id)
          .single();
        existingMachine = data;
      }

      let machineId: string;

      if (existingMachine) {
        // Máquina ya existe: actualizar last_scraped_at
        machineId = existingMachine.id;
        await supabaseAdmin
          .from('machines')
          .update({ last_scraped_at: new Date().toISOString() })
          .eq('id', machineId);
        
        machinesUpdated++;
        console.log(`[CRON] Máquina actualizada: ${machineName} (${source.toUpperCase()})`);
      } else {
        // Máquina nueva: crearla automáticamente
        const { data: newMachine, error: createError } = await supabaseAdmin
          .from('machines')
          .insert({
            frekuent_machine_id,
            televend_machine_id,
            name: machineName,
            location: location || 'Sin ubicación',
            status: 'active',
            last_scraped_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (createError || !newMachine) {
          console.error(`[CRON] Error creando máquina ${machineName}:`, createError);
          continue; // Saltar esta máquina
        }

        machineId = newMachine.id;
        machinesCreated++;
        console.log(`[CRON] ✨ Máquina NUEVA creada: ${machineName} (${source.toUpperCase()})`);
      }

      // Actualizar columnas de recaudación directamente en la máquina
      const updateData: any = {
        last_scraped_at: new Date().toISOString()
      };

      const now = new Date().toISOString();

      if (periods.daily) {
        updateData.daily_total = periods.daily.totalRevenue;
        updateData.daily_updated_at = now;
        revenueUpdates++;
      }

      if (periods.monthly) {
        updateData.monthly_total = periods.monthly.totalRevenue;
        updateData.monthly_updated_at = now;
        revenueUpdates++;
      }

      const { error: updateError } = await supabaseAdmin
        .from('machines')
        .update(updateData)
        .eq('id', machineId);

      if (updateError) {
        console.error(`[CRON] Error actualizando recaudación para ${machineName}:`, updateError);
      } else {
        console.log(`[CRON] ✅ Recaudación actualizada para ${machineName}`);
      }
    }

    // ============================================
    // 6. FINALIZAR SCRAPE RUN
    // ============================================
    const totalMachines = machinesMap.size;

    await supabaseAdmin
      .from('scrape_runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        machines_scraped: totalMachines
      })
      .eq('id', scrapeRunId);

    const summary = {
      success: true,
      scrape_run_id: scrapeRunId,
      machines_total: totalMachines,
      machines_frekuent: frekuentResult.daily.totalMachines,
      machines_televend: televendResult.daily.totalMachines,
      machines_created: machinesCreated,
      machines_updated: machinesUpdated,
      revenue_updates: revenueUpdates,
      timestamp: new Date().toISOString()
    };

    console.log('[CRON] ✅ Scraping completado exitosamente:', summary);

    return NextResponse.json(summary, { status: 200 });

  } catch (error: any) {
    // ============================================
    // MANEJO DE ERRORES
    // ============================================
    console.error('[CRON] ❌ Error durante scraping:', error);

    await supabaseAdmin
      .from('scrape_runs')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: error.message || 'Error desconocido'
      })
      .eq('id', scrapeRunId);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Unknown error',
        scrape_run_id: scrapeRunId
      },
      { status: 500 }
    );
  }
}

/**
 * Endpoint adicional para testing manual (development only)
 * Permite ejecutar el scraping desde el navegador en dev
 */
export async function POST(request: NextRequest) {
  if ( process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Manual trigger only available in development' },
      { status: 403 }
    );
  }

  // En desarrollo, redirigir al GET
  return GET(request);
}
