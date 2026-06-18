#!/usr/bin/env node

import dotenv from 'dotenv';
import { executeRevenueJob } from '../lib/services/revenue-scrape-runner';

dotenv.config({ path: '.env.local' });

async function main() {
  const startedAt = Date.now();
  console.log('[FREKUENT] Iniciando scraping diario y mensual...');

  const result = await executeRevenueJob('frekuent');

  console.log('[FREKUENT] Scraping completado', {
    machinesScraped: result.machinesScraped,
    durationSeconds: result.durationSeconds,
    elapsedSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
  });
}

main().catch((error) => {
  console.error('[FREKUENT] Error:', error);
  process.exitCode = 1;
});
