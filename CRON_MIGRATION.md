# 📝 RESUMEN DE CAMBIOS - SCRAPING AUTOMÁTICO

## 🎯 Cambio implementado

Se ha migrado de **scraping manual por cliente** a **scraping automático cada hora** ejecutado por Vercel Cron.

---

## ✅ Ventajas del nuevo sistema

| Antes (manual) | Ahora (automático) |
|----------------|-------------------|
| Cliente pulsa "Actualizar datos" | Scraping automático cada hora |
| Espera 30-60 segundos | Datos instantáneos desde BD |
| Riesgo de race conditions | Un solo scraping controlado |
| Posible abuse del botón | Solo admin puede forzar |
| Múltiples scraping simultáneos | Un scraping por hora |
| Mala UX (tiempos de espera) | Excelente UX (<100ms) |

---

## 📂 Archivos creados/modificados

### ✨ Nuevos archivos

1. **`app/api/cron/scrape-machines/route.ts`**
   - Endpoint ejecutado por Vercel Cron cada hora
   - Protegido con `CRON_SECRET`
   - Scraping completo de todas las máquinas
   - **Auto-crea máquinas nuevas** si aparecen en Orain
   - Guarda snapshots de recaudación (3 periodos)
   - Registra auditoría en `scrape_runs`

2. **`app/api/admin/force-scrape/route.ts`**
   - Permite al admin forzar scraping manual
   - Requiere autenticación JWT
   - Requiere rol `admin`
   - Idéntico al cron pero registra quién lo ejecutó

3. **`vercel.json`**
   - Configuración del Vercel Cron
   - Schedule: `"0 * * * *"` (cada hora en punto)
   - Ruta: `/api/cron/scrape-machines`

4. **`DEPLOYMENT_GUIDE.md`**
   - Guía completa de deployment paso a paso
   - Configuración de Vercel + Supabase
   - Configuración del Cron
   - Troubleshooting

### 🔄 Archivos modificados

1. **`app/client/dashboard/page.tsx`**
   - ❌ **Eliminado**: Botón "Actualizar datos"
   - ❌ **Eliminado**: Función `handleRefresh()`
   - ❌ **Eliminado**: Estado `refreshing`
   - ✅ **Añadido**: Función `formatRelativeTime()` (muestra "Hace 23 min")
   - ✅ **Mejorado**: Card de última actualización con badge "Automático cada hora"
   - ✅ **Añadido**: Botón "Recargar" (solo recarga UI, no lanza scraping)

2. **`app/api/client/refresh/route.ts`**
   - ⚠️ **Deprecado**: Ya no funciona
   - Retorna HTTP 410 Gone con mensaje de deprecación
   - Mantiene el archivo para compatibilidad hacia atrás

3. **`.env.example`**
   - ✅ **Añadido**: `CRON_SECRET` (obligatorio para producción)
   - ✅ **Añadidas**: Notas sobre arquitectura de scraping
   - ✅ **Añadido**: Comando para generar secret seguro

---

## 🗄️ Base de datos (sin cambios)

El SQL ya existía y está completo. **No necesitas ejecutar nada nuevo.**

### Tablas existentes (ya creadas)

1. **`profiles`** - Usuarios (admin/client) con roles
2. **`client_settings`** - Configuración por cliente (% comisión)
3. **`machines`** - Máquinas de vending
4. **`client_machine_assignments`** - Asignación máquinas ↔ clientes
5. **`machine_revenue_snapshots`** - Snapshots de recaudación (bruta)
6. **`scrape_runs`** - Auditoría de scraping

### Funciones SQL existentes

1. **`get_client_net_revenue()`** - Calcula recaudación neta para cliente
2. **`get_admin_client_overview()`** - Overview admin (bruto vs neto)

### RLS Policies existentes

- ✅ Cliente solo ve sus máquinas asignadas
- ✅ Cliente nunca ve `amount_gross`, `commission_hide_percent`
- ✅ Admin ve todo
- ✅ `client_settings` invisible para clientes

---

## 🔧 Cómo funciona el nuevo sistema

### Flujo automático (cada hora)

```
12:00 → Vercel Cron se dispara
  ↓
  Llama a /api/cron/scrape-machines
  ↓
  Valida CRON_SECRET
  ↓
  Crea registro en scrape_runs (triggered_by_user_id = null)
  ↓
  Ejecuta scraping de Orain (3 periodos: daily/weekly/monthly)
  ↓
  Para cada máquina encontrada:
    • Si existe (orain_machine_id) → actualiza last_scraped_at
    • Si NO existe → la CREA automáticamente
  ↓
  Guarda snapshots de recaudación
  ↓
  Actualiza scrape_run (status = completed)
  ↓
13:00 → Se repite
```

### Flujo del cliente

```
Cliente entra al dashboard
  ↓
  Carga /api/client/dashboard
  ↓
  API llama a get_client_net_revenue() (SQL function)
  ↓
  Retorna solo recaudación NETA (comisión ya aplicada)
  ↓
  UI muestra: "Hace 23 min • Automático cada hora"
```

### Flujo manual admin (opcional)

```
Admin pulsa "Forzar actualización" (futuro)
  ↓
  POST /api/admin/force-scrape
  ↓
  Valida JWT + rol admin
  ↓
  Crea scrape_run (triggered_by_user_id = admin_id)
  ↓
  Ejecuta scraping (idéntico al cron)
  ↓
  Guarda todo igual
```

---

## 🚀 Cómo desplegar

### Desarrollo local (testing)

```bash
# 1. Copia .env.example a .env.local
cp .env.example .env.local

# 2. Genera CRON_SECRET
openssl rand -base64 32

# 3. Edita .env.local y pega tu CRON_SECRET
# CRON_SECRET=el_resultado_del_comando_anterior

# 4. Ejecuta el proyecto
pnpm dev

# 5. Prueba el cron manualmente:
curl http://localhost:3000/api/cron/scrape-machines \
  -H "Authorization: Bearer TU_CRON_SECRET"

# Deberías ver:
# {
#   "success": true,
#   "machines_total": 10,
#   "machines_created": 0,
#   "machines_updated": 10,
#   ...
# }
```

### Producción (Vercel)

Sigue la guía completa en **`DEPLOYMENT_GUIDE.md`**.

Resumen:
1. Push a GitHub/GitLab
2. Conecta en Vercel
3. Configura variables de entorno (incluyendo `CRON_SECRET`)
4. Deploy
5. Vercel activa automáticamente el cron (vercel.json)
6. ✅ Scraping automático cada hora

---

## 📊 Monitorización

### Ver ejecuciones del cron

**En Vercel:**
- Dashboard > Tu proyecto > **Functions**
- Busca `/api/cron/scrape-machines`
- Ver logs de cada ejecución

**En Supabase:**
```sql
-- Ver últimas 10 ejecuciones
SELECT 
  id,
  triggered_by_user_id,
  status,
  started_at,
  finished_at,
  machines_scraped,
  error_message
FROM scrape_runs
ORDER BY started_at DESC
LIMIT 10;

-- Ver cuántas son automáticas vs manuales
SELECT 
  CASE 
    WHEN triggered_by_user_id IS NULL THEN 'Automático (Cron)'
    ELSE 'Manual (Admin)'
  END AS tipo,
  COUNT(*) as cantidad,
  AVG(machines_scraped) as promedio_maquinas
FROM scrape_runs
GROUP BY triggered_by_user_id IS NULL;
```

---

## 🔒 Seguridad

### Variables sensibles

| Variable | Dónde | Propósito |
|----------|-------|-----------|
| `CRON_SECRET` | Solo Vercel | Proteger endpoint del cron |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo Vercel | Operaciones sin RLS |
| `ORAIN_USERNAME` | Solo Vercel | Login en Orain |
| `ORAIN_PASSWORD` | Solo Vercel | Login en Orain |

**⚠️ NUNCA commitear estas variables a Git**

### Cómo generar CRON_SECRET seguro

```bash
# Opción 1: OpenSSL
openssl rand -base64 32

# Opción 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Opción 3: PowerShell (Windows)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

---

## 🧪 Testing

### Probar el cron en desarrollo

```bash
# Terminal 1: Iniciar servidor
pnpm dev

# Terminal 2: Ejecutar cron
curl http://localhost:3000/api/cron/scrape-machines \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d '=' -f2)"

# Ver respuesta
```

### Probar como cliente

1. Login con un cliente existente
2. Verás dashboard con timestamp relativo
3. NO verás botón "Actualizar datos"
4. Solo botón "Recargar" (recarga UI)

### Probar como admin

1. Login con admin
2. Ve al panel de clientes
3. Deberías ver el botón "Forzar actualización" (próximamente se implementará en la UI)

---

## 📋 Checklist de migración completa

- [x] Endpoint cron creado (`/api/cron/scrape-machines`)
- [x] Endpoint admin force-scrape creado
- [x] `vercel.json` configurado
- [x] Auto-creación de máquinas implementada
- [x] UI cliente actualizada (sin botón refresh)
- [x] Timestamp relativo implementado
- [x] Endpoint `/api/client/refresh` deprecado
- [x] `.env.example` actualizado
- [x] Documentación de deployment creada
- [x] SQL schema verificado (sin cambios necesarios)

---

## 🆘 Troubleshooting

### "Unauthorized" en cron
→ Verifica que `CRON_SECRET` está configurada en Vercel con el valor correcto

### Cron no se ejecuta cada hora
→ Verifica que `vercel.json` está en la raíz del proyecto
→ Ve a Vercel > Settings > Cron Jobs y verifica que está activo

### Máquinas no se crean automáticamente
→ Verifica logs en Vercel Functions (deberías ver `[CRON] ✨ Máquina NUEVA creada`)
→ Verifica que el scraping está retornando `orain_machine_id`

### Cliente ve datos viejos
→ Espera a la próxima hora en punto (el cron se ejecuta cada hora :00)
→ O ejecuta force-scrape como admin

---

## 🎉 ¡Listo!

Tu sistema ahora tiene:
- ✅ Scraping automático cada hora
- ✅ Auto-creación de máquinas
- ✅ UX instantánea para clientes
- ✅ Sin race conditions
- ✅ Escalable a 100+ clientes
- ✅ Deployment en Vercel fácil

**Siguiente paso:** Seguir la guía en `DEPLOYMENT_GUIDE.md` para desplegar en producción.
