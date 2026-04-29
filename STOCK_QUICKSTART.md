# 🚀 Guía Rápida - Módulo de Stock

## ✅ Instalación y configuración

### 1. Instalar dependencias

```bash
npm install
npx playwright install chromium
```

### 2. Configurar credenciales de Orain

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
ORAIN_USER=tu_email@ejemplo.com
ORAIN_PASS=tu_contraseña_orain
HEADLESS=true
```

⚠️ **Importante**: Nunca subas el archivo `.env.local` a Git. Ya está en `.gitignore`.

## 🎯 Uso desde la UI Web

1. Accede a `http://localhost:3000/admin/stock`
2. Haz clic en **"Extraer de Orain"** para iniciar el scraping
3. Espera a que se complete (puede tardar varios minutos)
4. Selecciona las máquinas que vas a reabastecer
5. Verás el **resumen agregado** con los productos a cargar
6. Exporta a **CSV** o **JSON** según necesites

## 🖥️ Uso desde línea de comandos

```bash
# Ejecutar scraping completo
npm run scrape

# Con interfaz visible (debug)
HEADLESS=false npm run scrape
```

Los archivos se guardan en `scraper/output/`:
- `stock-machines-*.json` - Datos completos
- `stock-summary-*.json` - Resumen agregado
- `stock-summary-*.csv` - CSV para Excel
- `lista-carga-*.txt` - Lista imprimible

## 📊 Flujo de trabajo típico

1. **Por la mañana**: Ejecuta el scraping para obtener datos actualizados
2. **Planifica la ruta**: Selecciona las máquinas que vas a visitar hoy
3. **Prepara la furgoneta**: Usa el resumen para cargar los productos necesarios
4. **Exporta**: Descarga el CSV o imprime la lista de carga

## 🔧 Características

- ✅ Scraping automático de Orain
- ✅ Cálculo automático de unidades a reponer
- ✅ Selección múltiple de máquinas
- ✅ Agregación por producto
- ✅ Exportación a CSV/JSON
- ✅ Lista de carga imprimible
- ✅ Estadísticas en tiempo real
- ✅ Modo headless para velocidad máxima

## 🐛 Solución de problemas

### Error: "Credenciales no configuradas"
→ Verifica que hayas creado el archivo `.env.local` con las credenciales correctas

### El scraping tarda mucho
→ Es normal. Procesa cada máquina individualmente (~3-5 segundos por máquina)
→ Para 50 máquinas: ~3-4 minutos

### Error: "playwright not found"
→ Ejecuta: `npx playwright install chromium`

### Quiero ver qué está haciendo el scraper
→ Usa: `HEADLESS=false npm run scrape`

## 📁 Archivos importantes

- `/app/admin/stock/page.tsx` - Página de la UI
- `/components/admin/stock-page.tsx` - Componente principal
- `/app/api/stock/route.ts` - API para ejecutar scraping
- `/scraper/orain-scraper.ts` - Lógica de scraping
- `/scraper/aggregate.ts` - Agregación de datos
- `/scraper/export.ts` - Exportación de archivos
- `/lib/types.ts` - Tipos TypeScript

## 🎁 Próximas mejoras

- [ ] Detección de API de Orain (más rápido que UI scraping)
- [ ] Programación automática (cron jobs)
- [ ] Notificaciones por email/Telegram
- [ ] Comparación histórica de stock
- [ ] Alertas de productos con stock crítico
- [ ] Integración con sistema de rutas

## 📞 Soporte

Si tienes problemas, revisa:
1. Los logs en la consola
2. El archivo `scraper/README.md` para más detalles técnicos
3. Las credenciales en `.env.local`

¡Listo para optimizar el reabastecimiento! 🚛📦
