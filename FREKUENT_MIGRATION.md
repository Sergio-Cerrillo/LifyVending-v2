# 🔄 Migración de Orain a Frekuent - Documentación Completa

## 📋 Resumen

Orain ha migrado a una nueva plataforma llamada **Frekuent**. Este documento describe todos los cambios implementados en el sistema de scraping para adaptarse a la nueva plataforma.

---

## 🎯 Cambios Principales

### **URLs Actualizadas**
- **Antes (Orain)**: `https://dashboard.orain.io/`
- **Ahora (Frekuent)**: `https://frekuent.io/app/`

### **Estructura de Navegación**
#### Stock / Planograma:
- **Orain**: Dashboard > Data > Stock > Click en checkbox > Ver tabla de productos
- **Frekuent**: Home > Frekuent Spots > Puntos de venta > Seleccionar máquina > "..." > Detalles > Tab "Planograma"

#### Recaudación:
- **Orain**: Dashboard > Datos > Máquinas > Configurar filtros > Extraer de tabla
- **Frekuent**: Puntos de venta > Filtro de fecha > Columna "Ventas" visible directamente

---

## 📂 Archivos Creados

### 1. `scraper/frekuent-scraper.ts`
**Scraper de stock/planograma adaptado a Frekuent**

**Características:**
- ✅ Login con sesión persistente
- ✅ Navegación a "Puntos de venta"
- ✅ Configuración automática de paginación (100/página)
- ✅ Navegación por cada máquina:
  - Selecciona checkbox
  - Click en menú "..." → "Detalles"
  - Click en tab "Planograma"
  - Extrae productos con stock (formato: "6/6", "4/6", etc.)
  - Navega de vuelta con botón de flecha
- ✅ Manejo robusto de errores y reintentos

**Uso:**
```typescript
import { FrekuentScraper } from '@/scraper/frekuent-scraper';

const scraper = new FrekuentScraper({
  user: process.env.FREKUENT_USERNAME!,
  pass: process.env.FREKUENT_PASSWORD!,
  headless: true
});

const results = await scraper.scrapeAllMachines((current, total, name) => {
  console.log(`[${current}/${total}] ${name}`);
});
```

### 2. `scraper/frekuent-revenue-scraper.ts`
**Scraper de recaudación simplificado para Frekuent**

**Características:**
- ✅ Scraping directo desde tabla principal (sin navegar máquina por máquina)
- ✅ Filtros de fecha: "Hoy" (daily) y "Este mes" (monthly)
- ✅ Extracción de columna "Ventas"
- ✅ Mucho más rápido que el scraper de Orain
- ✅ Función mock para testing

**Uso:**
```typescript
import { scrapeFrekuentRevenue, scrapeFrekuentRevenueMultiple } from '@/scraper/frekuent-revenue-scraper';

// Single period
const result = await scrapeFrekuentRevenue(
  { username: '...', password: '...' },
  'daily'
);

// Multiple periods (recommended)
const { daily, monthly } = await scrapeFrekuentRevenueMultiple({
  username: '...',
  password: '...'
});
```

---

## 🔄 Archivos Modificados

### 1. `app/api/stock/route.ts`
**Cambios:**
- ❌ Removido `OrainScraper`
- ✅ Agregado `FrekuentScraper`
- ✅ Migración automática de `orain_machine_id` → `frekuent_machine_id`
- ✅ Logs actualizados para reflejar Frekuent

**Migración de Base de Datos:**
El código detecta automáticamente máquinas con `orain_machine_id` y las migra:
```typescript
// Busca con frekuent_machine_id
const { data: frekuentData } = await supabase
  .from('machines')
  .select('id')
  .eq('frekuent_machine_id', machineId)
  .single();

// Si no existe, busca con orain_machine_id (fallback)
if (!frekuentData) {
  const { data: orainData } = await supabase
    .from('machines')
    .select('id')
    .eq('orain_machine_id', machineId)
    .single();
  
  // Migra a frekuent_machine_id
  if (orainData) {
    await supabase
      .from('machines')
      .update({ 
        frekuent_machine_id: machineId,
        orain_machine_id: null 
      })
      .eq('id', orainData.id);
  }
}
```

### 2. `app/api/cron/scrape-machines/route.ts`
**Cambios:**
- ❌ Removido `scrapeMachineRevenue` (Orain)
- ✅ Agregado `scrapeFrekuentRevenueMultiple`
- ✅ Soporte para migración automática Orain → Frekuent
- ✅ Scraping de daily y monthly en paralelo
- ✅ Logs mejorados con fuentes (FREKUENT vs TELEVEND)

**Comportamiento:**
```typescript
const [frekuentResult, televendResult] = await Promise.all([
  scrapeFrekuentRevenueMultiple({ username, password }),
  televendScraper.scrapeAllMachinesRevenue()
]);

// Consolida datos de ambas fuentes
// Crea máquinas nuevas automáticamente
// Actualiza recaudación daily y monthly
```

---

## 🔧 Variables de Entorno

### **Nuevas Variables (Recomendadas)**
```env
# Credenciales Frekuent (nueva plataforma)
FREKUENT_USERNAME=tu_email@ejemplo.com
FREKUENT_PASSWORD=tu_contraseña

# Si no existen, usa las antiguas como fallback
ORAIN_USERNAME=tu_email@ejemplo.com  # Opcional (fallback)
ORAIN_PASSWORD=tu_contraseña          # Opcional (fallback)
```

### **Variables Existentes (Mantener)**
```env
# Televend (sin cambios)
TELEVEND_USERNAME=...
TELEVEND_PASSWORD=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Cron
CRON_SECRET=...

# Testing
USE_MOCK_SCRAPER=true  # Para testing sin scraping real
```

**Prioridad de credenciales:**
```typescript
const username = process.env.FREKUENT_USERNAME || process.env.ORAIN_USERNAME!;
const password = process.env.FREKUENT_PASSWORD || process.env.ORAIN_PASSWORD!;
```

---

## 🗄️ Base de Datos

### **Cambios en Schema**

Agregar nueva columna a la tabla `machines`:

```sql
-- Agregar columna frekuent_machine_id
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS frekuent_machine_id TEXT;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_machines_frekuent_machine_id 
ON machines(frekuent_machine_id);

-- Opcional: Migrar datos existentes
UPDATE machines
SET frekuent_machine_id = orain_machine_id
WHERE orain_machine_id IS NOT NULL
  AND frekuent_machine_id IS NULL;
```

**Estructura de columnas de máquinas:**
```
machines
├── id (uuid, PK)
├── name (text)
├── location (text)
├── frekuent_machine_id (text, NUEVO)  ← ID de Frekuent
├── orain_machine_id (text, LEGACY)    ← Mantener para migración
├── televend_machine_id (text)
├── daily_total (numeric)
├── monthly_total (numeric)
├── last_scraped_at (timestamp)
└── ...
```

---

## 🧪 Testing

### **Modo Mock**
Para testing sin hacer scraping real:

```env
USE_MOCK_SCRAPER=true
```

**Funciones mock disponibles:**
```typescript
// Stock mock (no implementado aún en Frekuent)
// No hay función mock específica para frekuent-scraper

// Revenue mock
import { scrapeFrekuentRevenueMock } from '@/scraper/frekuent-revenue-scraper';

const mockDaily = await scrapeFrekuentRevenueMock('daily');
const mockMonthly = await scrapeFrekuentRevenueMock('monthly');
```

### **Testing Manual**
```bash
# Endpoint de testing (solo development)
curl -X POST http://localhost:3000/api/cron/scrape-machines

# Endpoint de stock
curl -X POST http://localhost:3000/api/stock
```

---

## 📊 Comparativa: Orain vs Frekuent

| Aspecto | Orain | Frekuent |
|---------|-------|----------|
| **URL Base** | `dashboard.orain.io` | `frekuent.io/app` |
| **Stock: Navegación** | Click checkbox → Ver tabla | Seleccionar → Menú → Detalles → Tab |
| **Stock: Retorno** | Deseleccionar checkbox | Botón de flecha atrás |
| **Stock: Formato** | Columnas separadas (capacidad, disponible) | Formato visual "6/6" |
| **Revenue: Acceso** | Navegación a "Datos > Máquinas" | Directamente en "Puntos de venta" |
| **Revenue: Filtros** | Selector `#reportrange` | Botón de fecha con dropdown |
| **Revenue: Datos** | Columnas específicas (6, 7, 8) | Columna "Ventas" (columna 6) |
| **Branding** | Orain | Frekuent |
| **Velocidad** | Media | **Más rápida** (revenue directo) |

---

## ⚠️ Notas Importantes

### **Migración Gradual**
El sistema está diseñado para migrar gradualmente de Orain a Frekuent:

1. ✅ Nuevas máquinas se crean con `frekuent_machine_id`
2. ✅ Máquinas existentes con `orain_machine_id` se migran automáticamente
3. ✅ Ambos IDs pueden coexistir durante la transición
4. ⚠️ Una vez migradas, `orain_machine_id` se pone a `null`

### **Compatibilidad con Televend**
- ✅ Televend sigue funcionando sin cambios
- ✅ Los scrapers de Frekuent y Televend corren en paralelo
- ✅ Los datos se consolidan automáticamente

### **Retrocompatibilidad**
- ✅ Las credenciales de Orain funcionan como fallback
- ✅ El código busca primero `FREKUENT_*`, luego `ORAIN_*`
- ✅ No es necesario eliminar las variables `ORAIN_*`

---

## 🚀 Deployment

### **Pasos para Deploy**

1. **Actualizar Variables de Entorno (Vercel/Production)**
   ```bash
   vercel env add FREKUENT_USERNAME
   vercel env add FREKUENT_PASSWORD
   ```

2. **Ejecutar Migración de Base de Datos**
   ```sql
   -- En Supabase SQL Editor
   ALTER TABLE machines ADD COLUMN IF NOT EXISTS frekuent_machine_id TEXT;
   CREATE INDEX IF NOT EXISTS idx_machines_frekuent_machine_id ON machines(frekuent_machine_id);
   ```

3. **Deploy del Código**
   ```bash
   git add .
   git commit -m "feat: Migración de Orain a Frekuent"
   git push origin main
   ```

4. **Verificar Cron Jobs**
   - Asegurarse de que el cron job de Vercel sigue activo
   - Verificar que tiene el `CRON_SECRET` correcto

5. **Testing Post-Deploy**
   ```bash
   # Verificar que el scraping funciona
   curl -X GET https://tu-app.vercel.app/api/cron/scrape-machines \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

---

## 🐛 Troubleshooting

### **Problema: "No se encontraron campos de login"**
**Solución**: Verificar que la URL de login es correcta: `https://frekuent.io/login`

### **Problema: "No se encontró el tab Planograma"**
**Solución**: Verificar que:
1. Estás en la página de detalles de una máquina
2. El selector de tabs es correcto (puede variar según actualizaciones de Frekuent)

### **Problema: "Máquinas duplicadas"**
**Solución**: Ejecutar script de limpieza:
```sql
-- Eliminar duplicados manteniendo el registro más reciente
DELETE FROM machines a USING machines b
WHERE a.id < b.id
  AND a.frekuent_machine_id = b.frekuent_machine_id
  AND a.frekuent_machine_id IS NOT NULL;
```

### **Problema: "Scraping muy lento"**
**Solución**: 
- Verificar que la paginación está configurada a 100/página
- Considerar aumentar timeouts en `playwright`
- Verificar logs para ver dónde se está deteniendo

---

## 📝 Checklist Post-Migración

- [ ] Variables `FREKUENT_USERNAME` y `FREKUENT_PASSWORD` configuradas
- [ ] Columna `frekuent_machine_id` agregada a BD
- [ ] Índice creado para `frekuent_machine_id`
- [ ] Deploy realizado exitosamente
- [ ] Cron job ejecutado al menos una vez sin errores
- [ ] Datos de recaudación actualizándose correctamente
- [ ] Stock actualizándose correctamente
- [ ] Máquinas de Orain migradas automáticamente
- [ ] Logs verificados (sin errores críticos)
- [ ] Testing manual completado

---

## 👨‍💻 Mantenimiento

### **Monitoreo**
Verificar regularmente:
- Logs del cron job en Vercel
- Tabla `scrape_runs` en Supabase
- Columnas `last_scraped_at` en `machines`

### **Optimizaciones Futuras**
- [ ] Implementar scraping por API (si Frekuent lo soporta)
- [ ] Cachear sesiones de login más tiempo
- [ ] Paralelizar scraping de máquinas individuales
- [ ] Implementar notificaciones de errores

---

## 📞 Contacto y Soporte

Para preguntas o problemas:
1. Revisar logs en Vercel
2. Verificar tabla `scrape_runs` para detalles de errores
3. Consultar este documento
4. Revisar código fuente de los scrapers

---

**Última actualización**: 12 de abril de 2026  
**Versión**: 1.0.0 (Migración inicial Orain → Frekuent)
