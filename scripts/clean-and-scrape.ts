/**
 * Script para limpiar la base de datos y ejecutar el scraping completo
 * 
 * Uso:
 *   pnpm exec tsx scripts/clean-and-scrape.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Cargar variables de entorno desde .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Verificar que las variables de entorno están cargadas
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Variables de entorno no configuradas');
  console.error('   Asegúrate de tener un archivo .env.local con:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Cliente Supabase con service role (necesario para operaciones de limpieza)
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanDatabase() {
  console.log('🧹 Limpiando base de datos...');
  
  try {
    // 1. Eliminar recaudaciones
    console.log('   Eliminando snapshots de recaudación...');
    const { error: revenueError } = await supabase
      .from('machine_revenue_snapshots')
      .delete()
      .not('id', 'is', null); // Eliminar todos los registros con ID (todos)
    
    if (revenueError) throw revenueError;
    
    // 2. Eliminar asignaciones cliente-máquina
    console.log('   Eliminando asignaciones cliente-máquina...');
    const { error: assignmentError } = await supabase
      .from('client_machine_assignments')
      .delete()
      .not('id', 'is', null);
    
    if (assignmentError) throw assignmentError;
    
    // 3. Eliminar máquinas
    console.log('   Eliminando máquinas...');
    const { error: machinesError } = await supabase
      .from('machines')
      .delete()
      .not('id', 'is', null);
    
    if (machinesError) throw machinesError;
    
    // 4. Verificar que todo está limpio
    const { count: machinesCount } = await supabase
      .from('machines')
      .select('*', { count: 'exact', head: true });
    
    const { count: assignmentsCount } = await supabase
      .from('client_machine_assignments')
      .select('*', { count: 'exact', head: true });
    
    const { count: revenuesCount } = await supabase
      .from('machine_revenue_snapshots')
      .select('*', { count: 'exact', head: true });
    
    console.log('✅ Limpieza completada:');
    console.log(`   - Máquinas: ${machinesCount || 0}`);
    console.log(`   - Asignaciones: ${assignmentsCount || 0}`);
    console.log(`   - Recaudaciones: ${revenuesCount || 0}`);
    
    if (machinesCount === 0 && assignmentsCount === 0 && revenuesCount === 0) {
      console.log('🎉 Base de datos limpia. Lista para nuevo scraping.\n');
      return true;
    } else {
      console.warn('⚠️ Aún quedan datos. Revisa manualmente.\n');
      return false;
    }
  } catch (error) {
    console.error('❌ Error limpiando base de datos:', error);
    throw error;
  }
}

async function runScrapers() {
  console.log('🚀 Ejecutando scrapers...\n');
  
  try {
    // 1. Scraper de Frekuent (recaudación)
    console.log('📊 [1/2] Ejecutando Frekuent Revenue Scraper...');
    const { stdout: frekuentOut, stderr: frekuentErr } = await execAsync(
      'pnpm exec tsx scraper/frekuent-revenue-scraper.ts',
      { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
    );
    
    if (frekuentOut) console.log(frekuentOut);
    if (frekuentErr) console.error(frekuentErr);
    
    console.log('✅ Frekuent Revenue Scraper completado\n');
    
    // 2. Scraper de Televend (máquinas y recaudación)
    console.log('📺 [2/2] Ejecutando Televend Scraper...');
    const { stdout: televendOut, stderr: televendErr } = await execAsync(
      'pnpm exec tsx scraper/televend-scraper.ts',
      { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
    );
    
    if (televendOut) console.log(televendOut);
    if (televendErr) console.error(televendErr);
    
    console.log('✅ Televend Scraper completado\n');
    
    console.log('🎉 Todos los scrapers completados exitosamente!');
  } catch (error: any) {
    console.error('❌ Error ejecutando scrapers:', error.message);
    throw error;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('  LIMPIEZA Y SCRAPING COMPLETO');
  console.log('='.repeat(60));
  console.log();
  
  try {
    // Paso 1: Limpiar base de datos
    const cleaned = await cleanDatabase();
    
    if (!cleaned) {
      console.error('⚠️ La base de datos no se limpió correctamente. Abortando scraping.');
      process.exit(1);
    }
    
    // Paso 2: Ejecutar scrapers
    await runScrapers();
    
    console.log();
    console.log('='.repeat(60));
    console.log('  ✅ PROCESO COMPLETADO');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Error en el proceso:', error);
    process.exit(1);
  }
}

// Ejecutar
main();
