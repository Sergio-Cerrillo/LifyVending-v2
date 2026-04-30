/**
 * Browser Helper - Lanza Chrome local
 * 
 * Usado para scraping manual desde local
 */

import { chromium, Browser } from 'playwright';

export interface BrowserConfig {
  headless: boolean;
}

export async function launchBrowser(config: BrowserConfig): Promise<Browser> {
  console.log('💻 Lanzando Chrome local...');
  
  const browser = await chromium.launch({
    headless: config.headless,
    args: [
      '--disable-images',
      '--disable-fonts',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  console.log('✅ Chrome local inicializado');
  return browser;
}
