# 🚀 Guía Completa de Deployment a Producción

**Fecha:** 29 de abril de 2026  
**Sistema:** Scraping automático de Stock y Recaudaciones

---

## 📋 Resumen de Cambios

Este deployment incluye:

✅ **Sistema de Stock Automatizado**
- Scraping cada 30 minutos vía CRON
- Consulta instantánea desde base de datos
- Sin histórico (solo último snapshot)
- Eliminados botones de scraping manual

✅ **Optimización de Recaudaciones**
- Scraping cada hora (ya configurado)
- Consulta desde BD (ya implementado)

✅ **Configuración de CRON en Vercel**
- `/api/cron/scrape-machines` → Cada hora (recaudaciones)
- `/api/cron/scrape-stock` → Cada 30 minutos (stock)

---

## 🗂️ Archivos Modificados/Creados

### **Nuevos Archivos:**
```
✅ supabase/migrations/20260429_create_stock_tables.sql
✅ app/api/cron/scrape-stock/route.ts
✅ app/api/admin/stock/route.ts
✅ DEPLOYMENT_STOCK_GUIDE.md (este archivo)
```

### **Archivos Modificados:**
```
✅ components/admin/stock-page.tsx (eliminados botones scraping manual)
✅ vercel.json (añadido CRON de stock)
```

---

## 📝 PASO 1: Preparar Repositorio en GitHub

### 1.1 Crear Nuevo Repositorio

```bash
# En GitHub, crear nuevo repositorio (ej: newlify-vending-production)
# NO inicializar con README (lo haremos localmente)
```

### 1.2 Inicializar Git Localmente

```bash
cd /Users/sergiocerrillo/Desktop/www-Proyectos/NewLifyVending

# Inicializar git si no existe
git init

# Agregar .gitignore si no existe
cat > .gitignore << 'EOF'
# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js
.yarn/install-state.gz

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# env files (do not commit)
.env
.env*.local
.env.production

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts

# scraper output
scraper/output/
*.json
output/

# playwright
test-results/
playwright-report/
playwright/.cache/
EOF
```

### 1.3 Commit Inicial

```bash
# Agregar todos los archivos
git add .

# Commit inicial
git commit -m "Initial commit: Sistema de scraping automático con CRON"

# Conectar con repositorio remoto (reemplaza con tu URL)
git remote add origin https://github.com/TU_USUARIO/newlify-vending-production.git

# Push a main
git branch -M main
git push -u origin main
```

---

## 🗄️ PASO 2: Ejecutar Migración SQL en Supabase

### 2.1 Acceder a Supabase Dashboard

1. Ir a: https://supabase.com/dashboard
2. Seleccionar tu proyecto
3. Ir a **SQL Editor** (icono de base de datos en el menú lateral)

### 2.2 Ejecutar Migración

**Abrir el archivo:** `supabase/migrations/20260429_create_stock_tables.sql`

**Copiar TODO el contenido** y pegarlo en el SQL Editor de Supabase

**Click en "RUN"** (botón verde abajo a la derecha)

### 2.3 Verificar Creación

Ejecutar este query de verificación:

```sql
-- Verificar que las tablas se crearon
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('machine_stock_current', 'stock_products_current')
ORDER BY table_name;

-- Verificar políticas RLS
SELECT 
    tablename,
    policyname
FROM pg_policies
WHERE tablename IN ('machine_stock_current', 'stock_products_current');
```

**Resultado esperado:**
```
✅ machine_stock_current (table)
✅ stock_products_current (table)
✅ 4 políticas RLS creadas
```

---

## ☁️ PASO 3: Desplegar en Vercel

### 3.1 Importar Proyecto en Vercel

1. Ir a: https://vercel.com/new
2. Click en **"Import Git Repository"**
3. Seleccionar el repositorio que creaste: `newlify-vending-production`
4. Click en **"Import"**

### 3.2 Configurar Variables de Entorno

En la sección **"Environment Variables"**, agregar las siguientes:

#### Variables Requeridas:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Orain (para Frekuent scraper - opcional si solo usas Televend)
ORAIN_USER=tu_usuario_orain
ORAIN_PASS=tu_password_orain

# Televend (REQUERIDO para scraping de stock)
TELEVEND_USERNAME=tu_usuario_televend
TELEVEND_PASSWORD=tu_password_televend

# CRON Security (IMPORTANTE)
CRON_SECRET=genera_un_secret_aleatorio_aqui_min_32_caracteres

# Opcional: Modo Mock para testing
USE_MOCK_SCRAPER=false
```

#### 🔐 Generar CRON_SECRET:

```bash
# En tu terminal local, ejecutar:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ejemplo de output:
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**⚠️ IMPORTANTE:** Copia este valor y úsalo en `CRON_SECRET`

### 3.3 Configurar Framework y Build

Vercel debería detectar automáticamente:

```
Framework Preset: Next.js
Build Command: next build
Output Directory: .next
Install Command: pnpm install
```

Si no detecta `pnpm`, agregar en **Settings → General**:
```
Package Manager: pnpm
```

### 3.4 Deploy

Click en **"Deploy"**

⏳ Esperar 2-5 minutos mientras Vercel:
- Instala dependencias
- Compila el proyecto
- Despliega a producción

✅ Verás mensaje: **"Your project is ready"**

---

## ⏰ PASO 4: Configurar CRON Jobs en Vercel

### 4.1 Verificar Configuración

Vercel debería detectar automáticamente el archivo `vercel.json` con:

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-machines",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/scrape-stock",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

### 4.2 Ver CRONs Activos

1. En Vercel Dashboard → Tu proyecto
2. Ir a **Settings → Cron Jobs**
3. Deberías ver:

```
✅ /api/cron/scrape-machines
   Schedule: 0 * * * * (Every hour)
   
✅ /api/cron/scrape-stock
   Schedule: */30 * * * * (Every 30 minutes)
```

### 4.3 Probar Manualmente (Opcional)

Para probar que los CRONs funcionan:

```bash
# Obtener tu CRON_SECRET de las variables de entorno
# Reemplazar en los comandos siguientes

# Probar scraping de recaudaciones:
curl -X GET "https://tu-dominio.vercel.app/api/cron/scrape-machines" \
  -H "Authorization: Bearer TU_CRON_SECRET_AQUI"

# Probar scraping de stock:
curl -X GET "https://tu-dominio.vercel.app/api/cron/scrape-stock" \
  -H "Authorization: Bearer TU_CRON_SECRET_AQUI"
```

**Resultado esperado:** JSON con `{ "success": true, "machinesScraped": X, ... }`

---

## ✅ PASO 5: Verificación Post-Deployment

### 5.1 Verificar que la App Carga

1. Ir a tu dominio: `https://tu-proyecto.vercel.app`
2. Login con usuario admin
3. Debería ver el dashboard sin errores

### 5.2 Verificar Stock Page

1. Ir a: `https://tu-proyecto.vercel.app/admin/stock`
2. **NO debería** ver botones de "Scraping Total", "Solo Televend", etc.
3. **SÍ debería** ver:
   - Botón "Refrescar"
   - Mensaje: "Actualización automática cada 30 minutos"
   - Última actualización: (fecha/hora)

### 5.3 Verificar Primer Scraping

**Opción A: Esperar 30 minutos** para que ejecute el CRON automático

**Opción B: Forzar primer scraping** (solo esta vez):

```bash
curl -X GET "https://tu-dominio.vercel.app/api/cron/scrape-stock" \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

### 5.4 Ver Logs en Vercel

1. En Vercel Dashboard → Tu proyecto
2. Click en **"Logs"** (menú superior)
3. Filtrar por: `/api/cron/scrape-stock`
4. Deberías ver logs tipo:

```
[CRON STOCK] Iniciando scraping automático de stock...
[CRON STOCK] 15 máquinas activas encontradas
[CRON STOCK] ✅ Login exitoso en Televend
[CRON STOCK] Procesando: Máquina 1 (ID: xxx)
[CRON STOCK] ✅ Máquina 1: 40 productos, 12 a reponer
...
[CRON STOCK] ✅ Completado en 2.34 minutos
```

### 5.5 Verificar Datos en Supabase

En Supabase SQL Editor:

```sql
-- Ver datos de stock insertados
SELECT 
    COUNT(*) as total_machines,
    MAX(scraped_at) as last_update
FROM machine_stock_current;

-- Ver productos
SELECT 
    COUNT(*) as total_products
FROM stock_products_current;

-- Ver máquinas con productos a reponer
SELECT 
    machine_name,
    total_to_replenish,
    scraped_at
FROM machine_stock_current
WHERE total_to_replenish > 0
ORDER BY total_to_replenish DESC
LIMIT 10;
```

---

## 🔧 PASO 6: Configurar Dominio Personalizado (Opcional)

Si tienes un dominio propio:

1. En Vercel → Settings → Domains
2. Agregar tu dominio: `www.tudominio.com`
3. Configurar DNS según instrucciones de Vercel
4. Esperar propagación (5-30 minutos)

---

## 📊 PASO 7: Monitoreo y Mantenimiento

### 7.1 Configurar Alertas en Vercel

1. Settings → Notifications
2. Activar:
   - ✅ Deployment Failed
   - ✅ Function Errors
   - ✅ Function Timeouts

### 7.2 Revisar Logs Periódicamente

**Cada semana:**
- Revisar logs de CRONs
- Verificar que no hay errores recurrentes
- Comprobar tiempos de ejecución

**Comandos útiles para debugging:**

```sql
-- Ver última ejecución de cada CRON
SELECT 
    'Stock' as scraper,
    MAX(scraped_at) as last_run,
    COUNT(*) as machines_scraped
FROM machine_stock_current
UNION ALL
SELECT 
    'Revenue' as scraper,
    MAX(last_scraped_at) as last_run,
    COUNT(*) as machines_scraped
FROM machines;
```

### 7.3 Limpieza de Datos (Opcional)

Si en el futuro quieres limpiar datos antiguos:

```sql
-- Eliminar stock de máquinas borradas hace más de 30 días
DELETE FROM machine_stock_current
WHERE machine_id IN (
    SELECT id FROM machines 
    WHERE deleted_at < NOW() - INTERVAL '30 days'
);
```

---

## 🚨 Troubleshooting

### Problema: CRON no se ejecuta

**Solución:**
1. Verificar que `CRON_SECRET` está configurado en Vercel
2. Ir a Settings → Cron Jobs → Ver status
3. Revisar logs en Vercel → Logs → Filtrar por `/api/cron`

### Problema: Error 401 Unauthorized en CRON

**Solución:**
- El header `Authorization` debe ser exactamente:
  ```
  Authorization: Bearer TU_CRON_SECRET
  ```
- Verificar que no hay espacios extra en la variable de entorno

### Problema: Error "No televend_machine_id"

**Solución:**
- Las máquinas necesitan tener `televend_machine_id` en la tabla `machines`
- Ejecutar update manual si es necesario:
  ```sql
  UPDATE machines 
  SET televend_machine_id = 'XXXX'
  WHERE name = 'Nombre de la Máquina';
  ```

### Problema: Scraping tarda más de 30 minutos

**Solución:**
- Vercel Functions tienen timeout de 10 min (plan hobby) o 60 min (plan pro)
- Si tienes muchas máquinas (>50), considera:
  - Upgrade a Vercel Pro
  - Dividir scraping en batches

### Problema: Base de datos crece mucho

**Esto NO debería pasar** porque no guardamos histórico, pero si pasa:

```sql
-- Ver tamaño de tablas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 📚 Recursos Útiles

- **Vercel Cron Docs:** https://vercel.com/docs/cron-jobs
- **Supabase SQL Editor:** https://supabase.com/docs/guides/database
- **Next.js API Routes:** https://nextjs.org/docs/api-routes/introduction

---

## ✨ Siguientes Pasos (Post-Deployment)

Una vez todo funcione:

1. ✅ **Monitorear primer día** - Ver que CRONs se ejecutan correctamente
2. ✅ **Educar usuarios** - Explicar que ya no hay botones de scraping manual
3. ✅ **Documentar** - Guardar este archivo para futuras referencias
4. ✅ **Backup** - Hacer backup de BD una vez estable

---

## 🎉 ¡Listo para Producción!

Tu sistema ahora:
- ✅ Scrapea stock automáticamente cada 30 minutos
- ✅ Scrapea recaudaciones automáticamente cada hora
- ✅ Consultas instantáneas desde base de datos
- ✅ Sin botones de scraping manual
- ✅ Optimizado para performance

**Contacto:** Si tienes problemas, revisa los logs de Vercel o consulta esta guía.

---

**Creado por:** GitHub Copilot  
**Fecha:** 29 de abril de 2026  
**Versión:** 1.0
