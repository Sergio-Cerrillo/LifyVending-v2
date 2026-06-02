# 💰 Script de Scraping de Recaudaciones

Script standalone para ejecutar el scraping de recaudaciones sin necesidad de levantar la UI del proyecto.

## 🚀 Uso Básico

```bash
# Scraping completo (Frekuent + Televend) y guardar en Supabase
npm run scrape:revenue

# Ver todas las opciones disponibles
npm run scrape:revenue -- --help
```

## 📋 Opciones Disponibles

| Opción | Descripción |
|--------|-------------|
| `--no-db` | No guardar en Supabase (solo mostrar resultados) |
| `--export` | Exportar datos a JSON y CSV en `scraper/output/` |
| `--only-frekuent` | Solo scraping de Frekuent (omite Televend) |
| `--only-televend` | Solo scraping de Televend (omite Frekuent) |
| `--help`, `-h` | Mostrar ayuda |

## 📝 Ejemplos de Uso

### 1. Scraping completo y guardar en base de datos
```bash
npm run scrape:revenue
```

### 2. Scraping y exportar archivos (JSON + CSV)
```bash
npm run scrape:revenue -- --export
```

### 3. Solo ver resultados sin guardar en DB
```bash
npm run scrape:revenue -- --no-db
```

### 4. Solo scraping de Frekuent
```bash
npm run scrape:revenue -- --only-frekuent
```

### 5. Solo scraping de Televend con exportación
```bash
npm run scrape:revenue -- --only-televend --export
```

### 6. Scraping sin guardar pero exportando archivos
```bash
npm run scrape:revenue -- --no-db --export
```

## ⚙️ Configuración

El script utiliza las siguientes variables de entorno del archivo `.env.local`:

### Credenciales Frekuent
```env
FREKUENT_USERNAME=tu_usuario
FREKUENT_PASSWORD=tu_contraseña

# O alternativamente (nombres antiguos):
ORAIN_USERNAME=tu_usuario
ORAIN_PASSWORD=tu_contraseña
```

### Credenciales Televend
```env
TELEVEND_USERNAME=tu_usuario
TELEVEND_PASSWORD=tu_contraseña
```

### Supabase (para guardar datos)
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

### Modo Mock (opcional)
```env
USE_MOCK_SCRAPER=true  # Para testing sin hacer scraping real
```

## 📊 Salida del Script

El script muestra información detallada en la consola:

```
🚀 SCRAPING DE RECAUDACIONES
══════════════════════════════════════════════════

⚙️  Configuración:
   • Modo: REAL (scraping)
   • Guardar en DB: Sí
   • Exportar archivos: No

🔄 Scraping de Frekuent...
   👤 Usuario: usuario@ejemplo.com
   ✅ Daily: 15 máquinas
   ✅ Monthly: 15 máquinas

🔄 Scraping de Televend...
   👤 Usuario: usuario@ejemplo.com
   📦 [1/5] Máquina 1
   ...
   ✅ 5 máquinas procesadas

📊 Consolidando datos...
   ✅ 20 máquinas únicas encontradas

💰 Resumen de recaudaciones:
   • Total diario: 1,234.56 €
   • Total mensual: 45,678.90 €

💾 Guardando datos en Supabase...
   ✅ Creadas: 2
   ✅ Actualizadas: 18

══════════════════════════════════════════════════
✅ Proceso completado en 45.23s
```

## 📁 Archivos Exportados

Cuando se usa la opción `--export`, los archivos se guardan en `scraper/output/`:

- **JSON**: `revenue-YYYY-MM-DDTHH-MM-SS.json` - Datos completos en formato JSON
- **CSV**: `revenue-YYYY-MM-DDTHH-MM-SS.csv` - Datos en formato CSV para Excel

### Formato CSV
```csv
Máquina,Ubicación,Recaudación Diaria,Recaudación Mensual,Fuente,Fecha Scraping
"Máquina 1","Ubicación A",125.50,3850.00,frekuent,2024-01-15T10:30:00.000Z
"Máquina 2","Ubicación B",89.30,2670.00,televend,2024-01-15T10:30:00.000Z
```

## 🔄 Integración con Supabase

El script actualiza automáticamente la tabla `machines` en Supabase:

- **Si la máquina existe**: Actualiza `revenue_daily`, `revenue_monthly` y `last_scraped_at`
- **Si la máquina NO existe**: La crea automáticamente con los datos scrapeados

Las máquinas se identifican por:
- **Frekuent**: `frekuent_machine_id`
- **Televend**: `televend_machine_id`

## ⚡ Ejecución Automática (Cron)

Este script puede programarse para ejecutarse automáticamente:

### En sistemas Unix/Linux/macOS con cron:

```bash
# Editar crontab
crontab -e

# Ejecutar cada hora a la hora en punto
0 * * * * cd /ruta/a/NewLifyVending && npm run scrape:revenue

# Ejecutar cada día a las 6 AM
0 6 * * * cd /ruta/a/NewLifyVending && npm run scrape:revenue --export
```

### En Windows con Task Scheduler:
1. Abrir "Programador de tareas"
2. Crear tarea básica
3. Configurar acción: `npm run scrape:revenue`
4. Directorio de inicio: ruta del proyecto

## 🐛 Solución de Problemas

### Error: Faltan variables de entorno
```
❌ Error: Faltan credenciales FREKUENT_USERNAME/PASSWORD
```
**Solución**: Verifica que `.env.local` tenga las credenciales correctas.

### Error: No se encontraron máquinas
```
⚠️  No se encontraron máquinas. Verifica las credenciales o el modo mock.
```
**Solución**: 
- Verifica las credenciales
- Prueba con `USE_MOCK_SCRAPER=true` para testing

### Puppeteer no funciona
**Solución**: Instala las dependencias de Puppeteer:
```bash
# macOS
brew install chromium

# Linux
sudo apt-get install chromium-browser
```

## 📚 Comparación con otros scripts

| Script | Propósito | Comando |
|--------|-----------|---------|
| `scrape:revenue` | Recaudaciones (diarias/mensuales) | `npm run scrape:revenue` |
| `scrape` | Stock de productos | `npm run scrape` |

## 💡 Tips

1. **Modo Mock**: Usa `USE_MOCK_SCRAPER=true` para desarrollo sin hacer scraping real
2. **Solo consulta**: Usa `--no-db` para ver los datos sin modificar la base de datos
3. **Backup**: Usa `--export` regularmente para tener backups de las recaudaciones
4. **Performance**: `--only-frekuent` o `--only-televend` para scraping más rápido

## 🔐 Seguridad

⚠️ **Importante**: 
- Nunca subas `.env.local` al repositorio
- Las credenciales son sensibles, mantenlas seguras
- El `SUPABASE_SERVICE_ROLE_KEY` tiene permisos administrativos

## 📞 Soporte

Para más información, consulta:
- [README_CRON.md](README_CRON.md) - Documentación del sistema cron
- [SCRAPER README](scraper/README.md) - Documentación de scrapers
