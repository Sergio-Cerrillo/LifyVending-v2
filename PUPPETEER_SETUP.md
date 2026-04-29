# Solución: Error de Puppeteer Timeout

## Problema
```
Error [TimeoutError]: Timed out after 30000 ms while waiting for the WS endpoint URL to appear in stdout!
```

Este error significa que **Chromium no está instalado** o no puede lanzarse.

## Solución Rápida

### 1. Instalar Chromium para Puppeteer

```bash
# Opción 1: Usando npx (recomendado)
npx puppeteer browsers install chrome

# Opción 2: Usando pnpm
pnpm exec puppeteer browsers install chrome
```

### 2. Verificar la instalación

```bash
# Ver dónde está instalado Chromium
node -e "const puppeteer = require('puppeteer'); console.log(puppeteer.executablePath())"
```

### 3. Reintentar el scraping

Una vez instalado Chromium, el scraping debería funcionar correctamente.

## Causas Comunes del Error

1. **Chromium no descargado**: Puppeteer necesita descargar Chromium la primera vez
2. **Permisos insuficientes**: En algunos sistemas, se requieren permisos especiales
3. **Memoria insuficiente**: El servidor puede no tener suficiente RAM
4. **Variables de entorno**: Vercel/otras plataformas pueden requerir configuración especial

## Solución Alternativa: Usar Playwright

Si Puppeteer sigue fallando, considera usar Playwright (ya está instalado):

```typescript
// Ya está disponible en el proyecto
import { chromium } from 'playwright';
```

Los scrapers de Televend ya usan Playwright y funcionan bien.

## Para Vercel / Producción

En Vercel, agrega a `vercel.json`:

```json
{
  "functions": {
    "api/**/*.ts": {
      "memory": 3008,
      "maxDuration": 300
    }
  }
}
```

Y asegúrate de que el build incluye la instalación de Chromium:

```json
// package.json
{
  "scripts": {
    "postinstall": "npx puppeteer browsers install chrome || echo 'Puppeteer browser install failed'"
  }
}
```
