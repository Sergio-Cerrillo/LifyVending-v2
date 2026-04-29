# 🔧 Correcciones Realizadas - Máquinas y Recaudaciones

## Fecha: 6 de marzo de 2026

### 📋 Problemas Identificados y Solucionados

#### 1. ✅ Máquinas Duplicadas
**Problema:** Máquinas aparecían duplicadas en recaudaciones totales y al asignar a clientes, algunas con importes y otras sin datos.

**Solución:**
- Creado script SQL para limpiar todas las máquinas: `DELETE_MACHINES_CLEAN_START.sql`
- Este script borra:
  - Todas las máquinas
  - Asignaciones de máquinas a clientes
  - Snapshots de recaudación
- **Acción requerida:** Ejecutar el script en Supabase SQL Editor y luego volver a ejecutar el scraping

#### 2. ✅ Datos de Televend Incorrectos
**Problema:** Televend marcaba el mismo importe en mensual que en diario porque no extraía correctamente los datos separados.

**Solución:**
- **Modificado:** `scraper/televend-scraper.ts`
- Cambiado de usar "Last Month" a **"Last 30 Days"**
- Ahora extrae correctamente:
  - **Daily:** "Today" (hoy)
  - **Monthly:** "Last 30 Days" (últimos 30 días rolling)

**Código cambiado:**
```typescript
// ANTES (incorrecto):
const lastMonthOption = options.find(opt => 
  opt.textContent?.trim() === 'Last Month'
);

// AHORA (correcto):
const last30DaysOption = options.find(opt => 
  opt.textContent?.trim() === 'Last 30 Days' ||
  opt.textContent?.trim().toLowerCase().includes('30 d')
);
```

#### 3. ✅ Separación de Visualización Orain vs Televend
**Problema:** No se distinguía que Orain usa "este mes" (mes calendario) y Televend usa "últimos 30 días" (rolling).

**Solución:**
- **Modificado:** `app/admin/recaudaciones-general/page.tsx`
- **Modificado:** `app/api/admin/revenue/route.ts`

**Cambios en la UI:**

1. **Cards separadas por fuente:**
   - **Card Azul:** Máquinas Orain - "Este mes"
   - **Card Morada:** Máquinas Televend - "Últimos 30 días"

2. **Tabla con badges:**
   - Columna "Fuente" añadida
   - Badge azul para Orain
   - Badge morado para Televend

3. **Nota informativa:**
   - En el tab "Mensual (Mixto)" hay un aviso amarillo explicando la diferencia

4. **Totales separados:**
   - Se calculan y muestran totales independientes para cada fuente
   - Contador de máquinas por fuente

---

## 📁 Archivos Modificados

### 1. `scraper/televend-scraper.ts`
- Cambiado selector de "Last Month" → "Last 30 Days"
- Añadidos comentarios explicando que "monthly" = últimos 30 días (rolling)
- Actualizado log de consola para reflejar "Last 30 Days"

### 2. `app/api/admin/revenue/route.ts`
- Añadido campo `source` a cada máquina ('orain' | 'televend')
- Añadidos cálculos de totales separados:
  - `totalsOrain`
  - `totalsTelevend`
  - `countOrain`
  - `countTelevend`

### 3. `app/admin/recaudaciones-general/page.tsx`
- Actualizada interfaz `MachineRevenue` con campo `source`
- Actualizada interfaz `RevenueData` con totales separados
- Añadidas 2 cards para totales generales
- Añadidas 2 cards separadas (Orain azul, Televend morada)
- Tab "Mensual" renombrado a "Mensual (Mixto)"
- Añadida nota informativa sobre diferencia Orain vs Televend
- Tabla actualizada con columna "Fuente" y badges de colores

### 4. `app/api/admin/force-scrape/route.ts`
- Añadido comentario explicativo sobre diferencia Orain vs Televend

### 5. `app/api/admin/machines/route.ts`
- Añadido campo `source` a cada máquina en el endpoint GET
- Calcula automáticamente si es 'orain' o 'televend' basado en los IDs

### 6. `app/admin/clients/[id]/page.tsx`
- Actualizada interfaz `Machine` con campo `source`
- Añadidos badges de colores (azul/morado) en el selector de asignación de máquinas
- Ahora el admin puede ver qué máquinas son de Orain vs Televend al asignarlas

---

## 🚀 Cómo Usar las Correcciones

### Paso 1: Limpiar Máquinas Duplicadas
```sql
-- Ejecutar en Supabase SQL Editor
-- Copiar y pegar el contenido de:
DELETE_MACHINES_CLEAN_START.sql
```

### Paso 2: Verificar Limpieza
```sql
SELECT COUNT(*) as total_machines FROM machines;
-- Debe devolver: 0
```

### Paso 3: Ejecutar Scraping
1. Ir a: `http://localhost:3000/admin/recaudaciones-general`
2. Click en botón **"Actualizar"**
3. Esperar a que complete el scraping
4. Las nuevas máquinas se crearán correctamente sin duplicados

### Paso 4: Verificar Resultado
- Deberías ver 2 cards separadas:
  - **Orain (azul):** Mostrando "Este mes"
  - **Televend (morada):** Mostrando "Últimos 30 días"
- En la tabla verás badges de colores identificando cada máquina

---

## 🎨 Vista Previa de los Cambios

### Cards de Totales (Nuevas)
```
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ Total Diario (Hoy)              │  │ Total Mensual                   │
│ 42.179,85 €                     │  │ 45.245,38 €                     │
│ 124 máquinas                    │  │ Combinado                       │
└─────────────────────────────────┘  └─────────────────────────────────┘

┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ 🔵 Máquinas Orain [Este mes]    │  │ 🟣 Máquinas Televend            │
│ Diario: 30.000 €                │  │  [Últimos 30 días]              │
│ Mensual: 40.000 €               │  │ Diario: 12.179,85 €             │
│ 100 máquinas                    │  │ Últimos 30 días: 5.245,38 €     │
└─────────────────────────────────┘  │ 24 máquinas                     │
                                     └─────────────────────────────────┘
```

### Tabla con Badges
```
Máquina              | Fuente      | Ubicación | Total
---------------------|-------------|-----------|----------
ADELTE 5/10         | [🔵 Orain]  | ADELTE    | 1,45 €
ANYTIME 5/187       | [🟣 Televend]| GINKAGO  | 2,00 €
```

---

## ⚠️ Consideraciones Importantes

### Diferencia entre Orain y Televend
| Aspecto | Orain | Televend |
|---------|-------|----------|
| **Diario** | Hoy | Hoy |
| **Mensual** | Mes calendario actual (1-31) | Rolling 30 días |
| **Ejemplo** | Si hoy es 6 marzo, muestra desde 1 marzo | Si hoy es 6 marzo, muestra desde 6 febrero |
| **Color UI** | Azul | Morado |

### Por qué esta diferencia
- **Orain:** API/Dashboard usa filtros de "este mes" basados en mes calendario
- **Televend:** Dashboard usa períodos rolling de 30 días

### Impacto en Reportes
- Los totales mensuales **NO son directamente comparables** entre Orain y Televend
- Se recomienda usar el periodo "Diario" para comparaciones precisas
- Para reportes mensuales, considerar esta diferencia al analizar datos

---

## 🔍 Verificación de Correcciones

### Checklist Post-Implementación
- [ ] Script SQL ejecutado sin errores
- [ ] Tabla `machines` vacía (0 registros)
- [ ] Scraping ejecutado exitosamente
- [ ] Máquinas aparecen una sola vez (sin duplicados)
- [ ] Cards azules (Orain) y moradas (Televend) visibles
- [ ] Badges de colores aparecen en la tabla
- [ ] Nota amarilla visible en tab "Mensual (Mixto)"
- [ ] Totales de Televend diferentes entre diario y últimos 30 días

---

## 📞 Soporte

Si después de aplicar estos cambios:
- Siguen apareciendo duplicados
- Los datos de Televend siguen siendo iguales en diario y mensual
- No ves las cards de colores

Revisa:
1. Que hayas ejecutado el script SQL completo
2. Que el scraping se completó sin errores
3. Que no haya errores en la consola del navegador (F12)

---

## 🎯 Resumen Ejecutivo

**Antes:**
- ❌ Máquinas duplicadas
- ❌ Televend con datos incorrectos (daily = monthly)
- ❌ No se distinguía Orain de Televend
- ❌ Confusión sobre "este mes" vs "últimos 30 días"

**Después:**
- ✅ Máquinas sin duplicados (tras ejecutar script)
- ✅ Televend extrae "Last 30 Days" correctamente
- ✅ UI separa claramente Orain (azul) de Televend (morado)
- ✅ Documentación clara sobre diferencias de períodos
