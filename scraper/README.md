# 📦 Módulo de Stock - Sistema de Scraping Orain

Sistema automatizado para extraer datos de stock de Orain y calcular unidades a reponer por máquina.

## 🎯 Características

- ✅ Scraping automatizado de stock de Orain
- ✅ Cálculo automático de unidades a reponer
- ✅ Agregación por producto y categoría
- ✅ Selección múltiple de máquinas
- ✅ Exportación a CSV, JSON y lista de carga
- ✅ Optimización de velocidad (bloqueo de imágenes/fuentes)
- ✅ Modo headless y con interfaz para debug

## 🚀 Uso

### 1. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
ORAIN_USER=tu_email@ejemplo.com
ORAIN_PASS=tu_contraseña
HEADLESS=true  # false para ver el navegador
```

### 2. Instalar dependencias

```bash
npm install
npx playwright install chromium
```

### 3. Ejecutar scraping

```bash
# Desde la raíz del proyecto
npm run scrape

# O directamente con ts-node
npx ts-node scraper/index.ts
```

### 4. Modo debug (con interfaz)

```bash
HEADLESS=false npm run scrape
```

## 📁 Estructura de archivos

```
scraper/
├── index.ts              # Script principal
├── orain-scraper.ts      # Lógica de scraping con Playwright
├── aggregate.ts          # Agregación y cálculos
├── export.ts             # Exportación a CSV/JSON/TXT
├── output/               # Archivos generados
│   ├── stock-machines-*.json
│   ├── stock-summary-*.json
│   ├── stock-machines-*.csv
│   ├── stock-summary-*.csv
│   └── lista-carga-*.txt
└── README.md
```

## 📊 Salida de datos

### stock-machines-*.json
Lista completa de máquinas con todos sus productos:
```json
[
  {
    "machineId": "VM-001",
    "machineName": "UNITY TENNIS 5176",
    "location": "GIMNASIO UNITY",
    "products": [
      {
        "name": "COCA COLA LATA",
        "category": "Bebidas",
        "totalCapacity": 64,
        "availableUnits": 44,
        "unitsToReplenish": 20,
        "line": "2"
      }
    ],
    "scrapedAt": "2026-03-02T..."
  }
]
```

### stock-summary-*.json
Resumen agregado por producto:
```json
[
  {
    "productName": "COCA COLA LATA",
    "category": "Bebidas",
    "totalUnitsToReplenish": 85,
    "machineCount": 5
  }
]
```

### lista-carga-*.txt
Lista imprimible para preparar la furgoneta:
```
╔═══════════════════════════════════════════════════════╗
║         LISTA DE CARGA - FURGONETA REPARTO          ║
╚═══════════════════════════════════════════════════════╝

▶ BEBIDAS
─────────────────────────────────────────────────────────
  [ ]   85x  COCA COLA LATA
  [ ]   44x  FANTA NARANJA LATA
```

## 🌐 UI Web (Panel Admin)

Accede a `/admin/stock` para:
- Ver lista de máquinas
- Seleccionar múltiples máquinas
- Ver tabla resumen de productos
- Exportar CSV/JSON desde el navegador
- Ejecutar scraping manualmente

## 🔧 Optimización

El scraper está optimizado para velocidad:
- Bloquea carga de imágenes y fuentes
- Reutiliza el contexto del navegador
- Espera inteligente con `waitForSelector`
- Reintentos automáticos si falla

## 📝 Proceso de scraping

1. Login en Orain
2. Navegar a Datos → Stock
3. Obtener lista de máquinas
4. Para cada máquina:
   - Seleccionar máquina (checkbox)
   - Cambiar a "Mostrar 100 filas"
   - Extraer productos
   - Deseleccionar
5. Calcular agregados
6. Exportar resultados

## ⚡ Performance

- Tiempo estimado: ~3-5 segundos por máquina
- Para 50 máquinas: ~3-4 minutos
- Optimización API (futuro): < 30 segundos total

## 🐛 Troubleshooting

### Error: Page not initialized
→ Asegúrate de que el navegador se inicializó correctamente

### Error: No se encontraron máquinas
→ Verifica que las credenciales sean correctas
→ Revisa la estructura HTML de Orain (puede haber cambiado)

### Scraping muy lento
→ Usa `HEADLESS=true`
→ Verifica tu conexión a internet

## 🔐 Seguridad

- ✅ Credenciales SOLO en variables de entorno
- ✅ No se guardan contraseñas en el código
- ✅ Archivos de salida en `.gitignore`

## 📦 Dependencias

```json
{
  "playwright": "^1.40.0"
}
```

## 🚧 Próximas mejoras

- [ ] Detectar API endpoints de Orain para scraping más rápido
- [ ] Notificaciones cuando termina el scraping
- [ ] Programación automática (cron jobs)
- [ ] Comparación histórica de stock
- [ ] Alertas de productos con stock crítico
