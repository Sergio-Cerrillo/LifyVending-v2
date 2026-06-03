#!/usr/bin/env node

/**
 * SCRIPT STANDALONE: Scraping de Recaudaciones
 * 
 * Ejecuta el scraping de recaudaciones sin necesidad de levantar la UI del proyecto.
 * Puede ejecutarse desde la terminal con: npm run scrape:revenue
 * 
 * Características:
 * - Scraping de Frekuent (daily y monthly)
 * - Scraping de Televend (daily y monthly)
 * - Guarda datos en Supabase
 * - Exporta a JSON y CSV
 * - Soporte para modo mock (testing)
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { scrapeFrekuentRevenueMultiple, scrapeFrekuentRevenueMock } from './frekuent-revenue-scraper';
import { TelevendScraper } from './televend-scraper';
import { generateFrekuentId, generateTelevendId } from '../lib/machine-id-utils';
import * as fs from 'fs';
import * as path from 'path';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Tipos
interface MachineData {
  machineName: string;
  location: string;
  daily: number;
  monthly: number;
  source: 'frekuent' | 'televend';
  scrapedAt: Date;
}

interface ScrapingResult {
  success: boolean;
  totalMachines: number;
  machines: MachineData[];
  errors: string[];
  duration: number;
}

/**
 * Cliente Supabase con service_role para operaciones sin RLS
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('❌ Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Ejecuta scraping de Frekuent
 */
async function scrapeFrekuent(useMock: boolean): Promise<{
  daily: any;
  monthly: any;
}> {
  console.log('\n🔄 Scraping de Frekuent...');

  if (useMock) {
    console.log('   📝 Usando datos MOCK');
    const daily = await scrapeFrekuentRevenueMock('daily');
    const monthly = await scrapeFrekuentRevenueMock('monthly');
    return { daily, monthly };
  }

  const username = process.env.FREKUENT_USERNAME || process.env.ORAIN_USERNAME;
  const password = process.env.FREKUENT_PASSWORD || process.env.ORAIN_PASSWORD;

  if (!username || !password) {
    throw new Error('❌ Error: Faltan credenciales FREKUENT_USERNAME/PASSWORD u ORAIN_USERNAME/PASSWORD');
  }

  console.log(`   👤 Usuario: ${username}`);
  const result = await scrapeFrekuentRevenueMultiple({ username, password });
  
  console.log(`   ✅ Daily: ${result.daily.totalMachines} máquinas`);
  console.log(`   ✅ Monthly: ${result.monthly.totalMachines} máquinas`);
  
  return result;
}

/**
 * Ejecuta scraping de Televend
 */
async function scrapeTelvend(useMock: boolean): Promise<{
  daily: any;
  monthly: any;
}> {
  console.log('\n🔄 Scraping de Televend...');

  if (useMock) {
    console.log('   📝 Usando datos MOCK (vacío)');
    return {
      daily: { data: [], totalMachines: 0, success: true, scrapedAt: new Date() },
      monthly: { data: [], totalMachines: 0, success: true, scrapedAt: new Date() }
    };
  }

  const username = process.env.TELEVEND_USERNAME;
  const password = process.env.TELEVEND_PASSWORD;

  if (!username || !password) {
    console.log('   ⚠️  Credenciales Televend no configuradas, saltando...');
    return {
      daily: { data: [], totalMachines: 0, success: false, scrapedAt: new Date() },
      monthly: { data: [], totalMachines: 0, success: false, scrapedAt: new Date() }
    };
  }

  try {
    console.log(`   👤 Usuario: ${username}`);
    const scraper = new TelevendScraper({
      username,
      password,
      headless: true
    });

    const results = await scraper.scrapeAllMachinesRevenue((current, total, name) => {
      console.log(`   📦 [${current}/${total}] ${name}`);
    });

    await scraper.close();

    console.log(`   ✅ ${results.length} máquinas procesadas`);

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
    console.error('   ❌ Error en Televend:', error);
    return {
      daily: { data: [], totalMachines: 0, success: false, scrapedAt: new Date() },
      monthly: { data: [], totalMachines: 0, success: false, scrapedAt: new Date() }
    };
  }
}

/**
 * Consolida datos de múltiples fuentes
 */
function consolidateMachineData(frekuentResult: any, televendResult: any): Map<string, MachineData> {
  const machinesMap = new Map<string, MachineData>();

  // Procesar Frekuent (daily)
  for (const item of frekuentResult.daily.data) {
    const key = item.machineName;
    if (!machinesMap.has(key)) {
      machinesMap.set(key, {
        machineName: item.machineName,
        location: item.location,
        daily: 0,
        monthly: 0,
        source: 'frekuent',
        scrapedAt: new Date()
      });
    }
    machinesMap.get(key)!.daily = item.totalRevenue;
  }

  // Procesar Frekuent (monthly)
  for (const item of frekuentResult.monthly.data) {
    const key = item.machineName;
    if (!machinesMap.has(key)) {
      machinesMap.set(key, {
        machineName: item.machineName,
        location: item.location,
        daily: 0,
        monthly: 0,
        source: 'frekuent',
        scrapedAt: new Date()
      });
    }
    machinesMap.get(key)!.monthly = item.totalRevenue;
  }

  // Procesar Televend (daily)
  for (const item of televendResult.daily.data) {
    const key = item.machineName;
    if (!machinesMap.has(key)) {
      machinesMap.set(key, {
        machineName: item.machineName,
        location: item.location,
        daily: 0,
        monthly: 0,
        source: 'televend',
        scrapedAt: new Date()
      });
    }
    machinesMap.get(key)!.daily = item.totalRevenue;
  }

  // Procesar Televend (monthly)
  for (const item of televendResult.monthly.data) {
    const key = item.machineName;
    if (!machinesMap.has(key)) {
      machinesMap.set(key, {
        machineName: item.machineName,
        location: item.location,
        daily: 0,
        monthly: 0,
        source: 'televend',
        scrapedAt: new Date()
      });
    }
    machinesMap.get(key)!.monthly = item.totalRevenue;
  }

  return machinesMap;
}

/**
 * Guarda datos en Supabase
 */
async function saveToSupabase(machines: Map<string, MachineData>): Promise<{
  created: number;
  updated: number;
  errors: number;
}> {
  console.log('\n💾 Guardando datos en Supabase...');
  
  const supabase = getSupabaseAdmin();
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const [machineName, data] of machines) {
    try {
      // Generar ID según la fuente
      const machineId = data.source === 'frekuent' 
        ? generateFrekuentId(machineName)
        : generateTelevendId(machineName);

      // Intentar actualizar primero
      const { data: existingMachine, error: fetchError } = await supabase
        .from('machines')
        .select('id')
        .eq(data.source === 'frekuent' ? 'frekuent_machine_id' : 'televend_machine_id', machineId)
        .maybeSingle();

      if (fetchError) {
        console.error(`   ❌ Error buscando ${machineName}:`, fetchError.message);
        errors++;
        continue;
      }

      if (existingMachine) {
        // Actualizar máquina existente
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('machines')
          .update({
            daily_total: data.daily,
            daily_updated_at: now,
            monthly_total: data.monthly,
            monthly_updated_at: now,
            last_scraped_at: now
          })
          .eq('id', existingMachine.id);

        if (updateError) {
          console.error(`   ❌ Error actualizando ${machineName}:`, updateError.message);
          errors++;
        } else {
          updated++;
        }
      } else {
        // Crear nueva máquina
        const now = new Date().toISOString();
        const machineData: any = {
          name: machineName,
          location: data.location,
          daily_total: data.daily,
          daily_updated_at: now,
          monthly_total: data.monthly,
          monthly_updated_at: now,
          last_scraped_at: now,
          status: 'active-war'
        };

        if (data.source === 'frekuent') {
          machineData.frekuent_machine_id = machineId;
        } else {
          machineData.televend_machine_id = machineId;
        }

        const { error: insertError } = await supabase
          .from('machines')
          .insert(machineData);

        if (insertError) {
          console.error(`   ❌ Error creando ${machineName}:`, insertError.message);
          errors++;
        } else {
          created++;
        }
      }
    } catch (error: any) {
      console.error(`   ❌ Error procesando ${machineName}:`, error.message);
      errors++;
    }
  }

  console.log(`   ✅ Creadas: ${created}`);
  console.log(`   ✅ Actualizadas: ${updated}`);
  if (errors > 0) {
    console.log(`   ⚠️  Errores: ${errors}`);
  }

  return { created, updated, errors };
}

/**
 * Exporta datos a JSON
 */
function exportToJSON(machines: Map<string, MachineData>, outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `revenue-${timestamp}.json`;
  const filepath = path.join(outputDir, filename);

  const data = Array.from(machines.values());
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');

  return filepath;
}

/**
 * Exporta datos a CSV
 */
function exportToCSV(machines: Map<string, MachineData>, outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const filename = `revenue-${timestamp}.csv`;
  const filepath = path.join(outputDir, filename);

  const headers = ['Máquina', 'Ubicación', 'Recaudación Diaria', 'Recaudación Mensual', 'Fuente', 'Fecha Scraping'];
  const rows = Array.from(machines.values()).map(m => [
    m.machineName,
    m.location,
    m.daily.toFixed(2),
    m.monthly.toFixed(2),
    m.source,
    m.scrapedAt.toISOString()
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  fs.writeFileSync(filepath, csv, 'utf-8');

  return filepath;
}

/**
 * Función principal
 */
async function main() {
  const startTime = Date.now();
  console.log('🚀 SCRAPING DE RECAUDACIONES\n');
  console.log('═'.repeat(50));

  // Leer configuración
  const useMock = process.env.USE_MOCK_SCRAPER === 'true';
  const saveToDb = process.argv.includes('--no-db') ? false : true;
  const exportFiles = process.argv.includes('--export');
  const onlyFrekuent = process.argv.includes('--only-frekuent');
  const onlyTelevend = process.argv.includes('--only-televend');

  console.log(`\n⚙️  Configuración:`);
  console.log(`   • Modo: ${useMock ? 'MOCK (testing)' : 'REAL (scraping)'}`);
  console.log(`   • Guardar en DB: ${saveToDb ? 'Sí' : 'No'}`);
  console.log(`   • Exportar archivos: ${exportFiles ? 'Sí' : 'No'}`);
  if (onlyFrekuent) console.log(`   • Solo Frekuent`);
  if (onlyTelevend) console.log(`   • Solo Televend`);

  try {
    // Ejecutar scraping de Frekuent primero
    const frekuentResult = onlyTelevend
      ? { daily: { data: [], totalMachines: 0 }, monthly: { data: [], totalMachines: 0 } }
      : await scrapeFrekuent(useMock);

    // Guardado temprano de Frekuent para no perder actualización si Televend falla/cuélga
    if (saveToDb && !onlyTelevend) {
      const frekuentOnlyMap = consolidateMachineData(frekuentResult, {
        daily: { data: [], totalMachines: 0 },
        monthly: { data: [], totalMachines: 0 },
      });

      console.log('\n💾 Guardado temprano de Frekuent...');
      const earlyResult = await saveToSupabase(frekuentOnlyMap);
      if (earlyResult.errors > 0) {
        console.log(`⚠️  Guardado temprano con errores (${earlyResult.errors})`);
      }
    }

    // Ejecutar scraping de Televend después
    const televendResult = onlyFrekuent
      ? { daily: { data: [], totalMachines: 0 }, monthly: { data: [], totalMachines: 0 } }
      : await scrapeTelvend(useMock);

    // Consolidar datos
    console.log('\n📊 Consolidando datos...');
    const machines = consolidateMachineData(frekuentResult, televendResult);
    console.log(`   ✅ ${machines.size} máquinas únicas encontradas`);

    if (machines.size === 0) {
      console.log('\n⚠️  No se encontraron máquinas. Verifica las credenciales o el modo mock.');
      process.exit(0);
    }

    // Mostrar resumen
    let totalDaily = 0;
    let totalMonthly = 0;
    for (const machine of machines.values()) {
      totalDaily += machine.daily;
      totalMonthly += machine.monthly;
    }

    console.log('\n💰 Resumen de recaudaciones:');
    console.log(`   • Total diario: ${totalDaily.toFixed(2)} €`);
    console.log(`   • Total mensual: ${totalMonthly.toFixed(2)} €`);

    // Guardar en Supabase
    if (saveToDb && !onlyFrekuent) {
      const dbResult = await saveToSupabase(machines);
      
      if (dbResult.errors > 0) {
        console.log(`\n⚠️  Se completó con algunos errores (${dbResult.errors})`);
      }
    } else if (saveToDb && onlyFrekuent) {
      console.log('\n✅ Frekuent ya guardado en BD (guardado temprano)');
    } else {
      console.log('\n⏭️  Omitiendo guardado en base de datos (--no-db)');
    }

    // Exportar archivos
    if (exportFiles) {
      console.log('\n📁 Exportando archivos...');
      const outputDir = path.join(process.cwd(), 'scraper', 'output');
      
      // Crear directorio si no existe
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const jsonPath = exportToJSON(machines, outputDir);
      const csvPath = exportToCSV(machines, outputDir);

      console.log(`   ✅ JSON: ${jsonPath}`);
      console.log(`   ✅ CSV: ${csvPath}`);
    }

    // Tiempo total
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '═'.repeat(50));
    console.log(`✅ Proceso completado en ${duration}s`);

  } catch (error: any) {
    console.error('\n❌ Error durante el scraping:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Mostrar ayuda
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🚀 Scraping de Recaudaciones - Ayuda

USO:
  npm run scrape:revenue [opciones]

OPCIONES:
  --no-db           No guardar en Supabase (solo mostrar resultados)
  --export          Exportar datos a JSON y CSV
  --only-frekuent   Solo scraping de Frekuent
  --only-televend   Solo scraping de Televend
  --help, -h        Mostrar esta ayuda

VARIABLES DE ENTORNO (.env.local):
  FREKUENT_USERNAME / ORAIN_USERNAME    Usuario de Frekuent
  FREKUENT_PASSWORD / ORAIN_PASSWORD    Contraseña de Frekuent
  TELEVEND_USERNAME                     Usuario de Televend
  TELEVEND_PASSWORD                     Contraseña de Televend
  USE_MOCK_SCRAPER                      'true' para usar datos mock
  NEXT_PUBLIC_SUPABASE_URL              URL de Supabase
  SUPABASE_SERVICE_ROLE_KEY             Clave de servicio de Supabase

EJEMPLOS:
  npm run scrape:revenue                    # Scraping completo y guardar en DB
  npm run scrape:revenue -- --export        # Scraping + exportar archivos
  npm run scrape:revenue -- --no-db         # Scraping sin guardar en DB
  npm run scrape:revenue -- --only-frekuent # Solo Frekuent
  `);
  process.exit(0);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

export { main as runRevenueScraper };
