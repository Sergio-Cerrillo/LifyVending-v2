/**
 * Integración de recaudación Televend archivada.
 *
 * No se importa desde ningún flujo de producción. Se conserva para una futura
 * reactivación sin mezclar sus credenciales, tiempos ni errores con Frekuent.
 */
import { TelevendScraper } from '@/scraper/televend-scraper';

export async function scrapeTelevendRevenueForFutureUse() {
  const username = process.env.TELEVEND_USERNAME;
  const password = process.env.TELEVEND_PASSWORD;

  if (!username || !password) {
    throw new Error('Faltan credenciales de Televend');
  }

  const scraper = new TelevendScraper({ username, password, headless: true });

  try {
    return await scraper.scrapeAllMachinesRevenue();
  } finally {
    await scraper.close().catch(() => {});
  }
}
