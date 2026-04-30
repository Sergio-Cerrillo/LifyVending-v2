/**
 * Browser Helper - Conecta a Browserless.io o Chrome local
 * 
 * Si BROWSERLESS_API_KEY está configurado, usa Browserless.io (para producción en Vercel)
 * Si no, usa Chrome local (para desarrollo)
 */

import { chromium, Browser } from 'playwright';

export interface BrowserConfig {
  headless: boolean;
}

export async function launchBrowser(config: BrowserConfig): Promise<Browser> {
  const browserlessApiKey = process.env.BROWSERLESS_API_KEY;

  if (browserlessApiKey) {
    // Usar Browserless.io en producción
    console.log('🌐 Conectando a Browserless.io...');
    console.log(`🔑 API Key presente: ${browserlessApiKey.substring(0, 8)}...${browserlessApiKey.substring(browserlessApiKey.length - 4)}`);
    
    const browser = await chromium.connect({
      wsEndpoint: `wss://production-sfo.browserless.io?token=${browserlessApiKey}`,
      timeout: 60000, // Aumentado a 60 segundos
    });

    console.log('✅ Conectado a Browserless.io');
    return browser;
  } else {
    // Usar Chrome local en desarrollo
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
}
