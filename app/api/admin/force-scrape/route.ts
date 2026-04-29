import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scrapeFrekuentRevenueMultiple, scrapeFrekuentRevenueMock } from '@/scraper/frekuent-revenue-scraper';
import { TelevendScraper } from '@/scraper/televend-scraper';

// Cliente Supabase con service_role
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
 * POST /api/admin/force-scrape
 * 
 * Permite al administrador forzar una ejecución manual del scraping
 * fuera del horario automático (cron).
 * 
 * Requisitos:
 * - Usuario autenticado
 * - Rol: admin
 * 
 * Proceso idéntico al cron, pero registra quién lo ejecutó
 */
export async function POST(request: NextRequest) {
  try {
    // ============================================
    // 1. VALIDAR AUTENTICACIÓN Y ROL ADMIN
    // ============================================
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Validar token con Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token', details: authError?.message },
        { status: 401 }
      );
    }

    // Verificar que es admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin role required' },
        { status: 403 }
      );
    }

    console.log(`[ADMIN-SCRAPE] Scraping manual iniciado por admin: ${user.id}`);

    // ============================================
    // 2. CREAR REGISTRO DE SCRAPE_RUN (con usuario)
    // ============================================
    const { data: scrapeRun, error: scrapeRunError } = await supabaseAdmin
      .from('scrape_runs')
      .insert({
        triggered_by_user_id: user.id,
        triggered_role: 'admin',
        status: 'running'
      })
      .select()
      .single();

    if (scrapeRunError || !scrapeRun) {
      console.error('[ADMIN-SCRAPE] Error creando scrape_run:', scrapeRunError);
      return NextResponse.json(
        { error: 'Failed to create scrape run', details: scrapeRunError?.message },
        { status: 500 }
      );
    }

    const scrapeRunId = scrapeRun.id;

    // ============================================
    // 3. EJECUTAR SCRAPING (Frekuent + Televend en paralelo)
    // ============================================
    try {
      const useMock = process.env.USE_MOCK_SCRAPER === 'true';
      console.log(`[ADMIN-SCRAPE] Modo: ${useMock ? 'MOCK' : 'REAL'}`);

      // Ejecutar scraping de Frekuent (anteriormente Orain)
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
        ? Promise.resolve({ data: [], totalMachines: 0 })
        : (async () => {
            try {
              const televendScraper = new TelevendScraper({
                username: process.env.TELEVEND_USERNAME!,
                password: process.env.TELEVEND_PASSWORD!,
                headless: true
              });

              const results = await televendScraper.scrapeAllMachinesRevenue((current, total, name) => {
                console.log(`[TELEVEND] [${current}/${total}] ${name}`);
              });

              await televendScraper.close();

              // Convertir al formato esperado
              return {
                data: results.flatMap(r => [
                  {
                    machineName: r.machineName,
                    location: r.location,
                    anonymousTotal: r.daily,
                    anonymousCard: 0,
                    anonymousCash: 0,
                    period: 'daily' as const,
                    scrapedAt: new Date()
                  },
                  {
                    machineName: r.machineName,
                    location: r.location,
                    anonymousTotal: r.monthly,
                    anonymousCard: 0,
                    anonymousCash: 0,
                    period: 'monthly' as const,
                    scrapedAt: new Date()
                  }
                ]),
                totalMachines: results.length
              };
            } catch (error) {
              console.error('[TELEVEND] Error en scraping:', error);
              return { data: [], totalMachines: 0 };
            }
          })();

      // Esperar ambos scrapings
      const [frekuentResult, televendResult] = await Promise.all([
        frekuentScrapePromise,
        televendScrapePromise
      ]);

      // Combinar datos de Frekuent (daily + monthly)
      const frekuentData = [
        ...(frekuentResult.daily?.data || []),
        ...(frekuentResult.monthly?.data || [])
      ];
      
      const frekuentMachines = (frekuentResult.daily?.totalMachines || 0) + (frekuentResult.monthly?.totalMachines || 0);

      // Combinar datos de todas las plataformas
      const combinedData = [...frekuentData, ...televendResult.data];
      const totalMachines = frekuentMachines + televendResult.totalMachines;

      console.log(`[ADMIN-SCRAPE] Frekuent: ${frekuentMachines} máquinas`);
      console.log(`[ADMIN-SCRAPE] Televend: ${televendResult.totalMachines} máquinas`);
      console.log(`[ADMIN-SCRAPE] Total: ${totalMachines} máquinas`);

      // Agrupar datos por máquina
      const machinesMap = new Map<string, {
        machineName: string;
        location: string;
        source: 'orain' | 'televend';
        periods: {
          daily?: { totalRevenue: number; anonymousTotal: number; anonymousCard: number; anonymousCash: number };
          monthly?: { totalRevenue: number; anonymousTotal: number; anonymousCard: number; anonymousCash: number };
        };
      }>();

      for (const item of combinedData) {
        const key = item.machineName;
        const isTelevend = televendResult.data.includes(item);
        
        if (!machinesMap.has(key)) {
          machinesMap.set(key, {
            machineName: item.machineName,
            location: item.location,
            source: isTelevend ? 'televend' : 'orain',
            periods: {}
          });
        }

        const machine = machinesMap.get(key)!;
        
        // Mapear campos según el origen de los datos
        if (isTelevend) {
          // Televend ya viene convertido con anonymousTotal, anonymousCard, anonymousCash
          machine.periods[item.period] = {
            totalRevenue: (item as any).anonymousTotal || 0,
            anonymousTotal: (item as any).anonymousTotal || 0,
            anonymousCard: (item as any).anonymousCard || 0,
            anonymousCash: (item as any).anonymousCash || 0
          };
        } else {
          // Frekuent usa totalRevenue (no tiene desglose card/cash)
          const revenue = (item as any).totalRevenue || 0;
          machine.periods[item.period] = {
            totalRevenue: revenue,
            anonymousTotal: revenue,
            anonymousCard: 0,
            anonymousCash: 0
          };
        }
      }

      // Procesar máquinas (crear/actualizar)
      let machinesCreated = 0;
      let machinesUpdated = 0;
      let snapshotsInserted = 0;

      for (const [machineName, machineData] of machinesMap.entries()) {
        const { location, periods, source } = machineData;
        
        // Determinar IDs según la fuente
        const orain_machine_id = source === 'orain' ? machineName : null;
        const televend_machine_id = source === 'televend' ? `televend_${machineName.replace(/[^a-zA-Z0-9]/g, '_')}` : null;

        // Buscar si existe (por cualquier ID)
        let existingMachine = null;
        
        if (orain_machine_id) {
          const { data } = await supabaseAdmin
            .from('machines')
            .select('id')
            .eq('orain_machine_id', orain_machine_id)
            .single();
          existingMachine = data;
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
          machineId = existingMachine.id;
          await supabaseAdmin
            .from('machines')
            .update({ last_scraped_at: new Date().toISOString() })
            .eq('id', machineId);
          machinesUpdated++;
        } else {
          const { data: newMachine, error: createError } = await supabaseAdmin
            .from('machines')
            .insert({
              orain_machine_id,
              televend_machine_id,
              name: machineName,
              location: location || 'Sin ubicación',
              status: 'active',
              last_scraped_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (createError || !newMachine) {
            console.error(`[ADMIN-SCRAPE] Error creando máquina ${machineName}:`, createError);
            continue;
          }

          machineId = newMachine.id;
          machinesCreated++;
          const sourceLabel = source === 'orain' ? 'FREKUENT/ORAIN' : source.toUpperCase();
          console.log(`[ADMIN-SCRAPE] ✨ Nueva máquina: ${machineName} (${sourceLabel})`);
        }

        // Actualizar columnas de recaudación directamente en la máquina
        const updateData: any = {
          last_scraped_at: new Date().toISOString()
        };

        const now = new Date().toISOString();

        if (periods.daily) {
          updateData.daily_total = periods.daily.totalRevenue;
          updateData.daily_card = periods.daily.anonymousCard;
          updateData.daily_cash = periods.daily.anonymousCash;
          updateData.daily_updated_at = now;
        }

        if (periods.monthly) {
          updateData.monthly_total = periods.monthly.totalRevenue;
          updateData.monthly_card = periods.monthly.anonymousCard;
          updateData.monthly_cash = periods.monthly.anonymousCash;
          updateData.monthly_updated_at = now;
        }

        const { error: updateError } = await supabaseAdmin
          .from('machines')
          .update(updateData)
          .eq('id', machineId);

        if (updateError) {
          console.error(`[ADMIN-SCRAPE] Error actualizando recaudación para ${machineName}:`, updateError);
        } else {
          snapshotsInserted += Object.keys(periods).length;
          console.log(`[ADMIN-SCRAPE] Recaudación actualizada para ${machineName}`);
        }
      }

      // Actualizar scrape_run con éxito
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
        machines_frekuent: frekuentMachines,
        machines_televend: televendResult.totalMachines,
        machines_created: machinesCreated,
        machines_updated: machinesUpdated,
        revenue_updates: snapshotsInserted,
        triggered_by: 'admin',
        timestamp: new Date().toISOString()
      };

      console.log('[ADMIN-SCRAPE] ✅ Scraping manual completado:', summary);

      return NextResponse.json(summary, { status: 200 });

    } catch (scrapeError: any) {
      console.error('[ADMIN-SCRAPE] ❌ Error durante scraping:', scrapeError);

      await supabaseAdmin
        .from('scrape_runs')
        .update({
          status: 'error',
          finished_at: new Date().toISOString(),
          error_message: scrapeError.message || 'Error desconocido'
        })
        .eq('id', scrapeRunId);

      return NextResponse.json(
        {
          success: false,
          error: scrapeError.message || 'Unknown error',
          scrape_run_id: scrapeRunId
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[ADMIN-SCRAPE] Error general:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
