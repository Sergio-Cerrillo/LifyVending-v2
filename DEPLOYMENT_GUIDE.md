# 🚀 GUÍA DE DEPLOY - VERCEL + SUPABASE

Guía paso a paso para desplegar el sistema multi-tenant de vending en producción con scraping automático cada hora.

---

## 📋 Requisitos previos

- [ ] Cuenta en [Vercel](https://vercel.com) (gratis)
- [ ] Cuenta en [Supabase](https://supabase.com) (gratis)
- [ ] Repositorio Git (GitHub/GitLab/Bitbucket)
- [ ] Credenciales de Orain (para scraping real)

---

## 🗄️ PASO 1: Configurar Supabase

### 1.1 Crear proyecto

1. Ve a [app.supabase.com](https://app.supabase.com)
2. Clic en **"New Project"**
3. Elige:
   - **Organization**: Tu organización
   - **Name**: `lify-vending` (o el nombre que prefieras)
   - **Database Password**: Genera uno seguro (guárdalo)
   - **Region**: Europe (West) - London
4. Clic en **"Create new project"**
5. **Espera 2-3 minutos** mientras se crea la base de datos

### 1.2 Ejecutar migraciones SQL

1. En el panel de Supabase, ve a **SQL Editor** (icono </> en la barra lateral)
2. Clic en **"New query"**
3. **Copia y pega** el contenido completo de `supabase/migrations/001_initial_schema.sql`
4. Clic en **"Run"** (esquina inferior derecha)
5. Deberías ver: `Success. No rows returned`

6. Crea otra nueva query
7. **Copia y pega** el contenido de `supabase/migrations/002_seed_data.sql`
8. Clic en **"Run"**
9. Deberías ver confirmación de inserción de datos

### 1.3 Obtener credenciales

1. Ve a **Settings** > **API** (en la barra lateral)
2. Copia y guarda:
   - **Project URL** → será tu `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → será tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key (⚠️ secreto) → será tu `SUPABASE_SERVICE_ROLE_KEY`

### 1.4 Crear usuario admin inicial

1. Ve a **Authentication** > **Users** (barra lateral)
2. Clic en **"Add user"** > **"Create new user"**
3. Completa:
   - **Email**: admin@tuempresa.com
   - **Password**: (genera una contraseña fuerte)
   - **Auto Confirm User**: ✅ marcado
4. Clic en **"Create user"**
5. **Importante**: Copia el UUID del usuario creado (lo necesitarás)

6. Ve a **SQL Editor** y ejecuta este query para hacerlo admin:

```sql
-- Reemplaza 'UUID_DEL_USUARIO' con el UUID real
INSERT INTO profiles (id, role, email, display_name)
VALUES (
  'UUID_DEL_USUARIO',
  'admin',
  'admin@tuempresa.com',
  'Administrador'
);
```

---

## 🌐 PASO 2: Configurar Vercel

### 2.1 Conectar repositorio

1. Push tu código a GitHub/GitLab/Bitbucket si aún no lo has hecho:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <TU_REPO_URL>
   git push -u origin main
   ```

2. Ve a [vercel.com](https://vercel.com) y loguéate
3. Clic en **"Add New..."** > **"Project"**
4. Selecciona tu repositorio
5. Vercel detectará automáticamente que es Next.js

### 2.2 Configurar variables de entorno

En la sección **Environment Variables**, añade TODAS estas:

#### Supabase (obligatorias)
```
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Scraper Orain (obligatorias para producción)
```
ORAIN_USERNAME=tu_usuario_orain
ORAIN_PASSWORD=tu_password_orain
USE_MOCK_SCRAPER=false
```

#### Cron Secret (obligatoria - genera una nueva)
```bash
# Genera un secret seguro:
openssl rand -base64 32
```

```
CRON_SECRET=<RESULTADO_DEL_COMANDO_ANTERIOR>
```

#### Opcional
```
NEXT_PUBLIC_SITE_URL=https://tu-dominio.vercel.app
```

### 2.3 Desplegar

1. Clic en **"Deploy"**
2. Espera 2-3 minutos mientras Vercel construye y despliega
3. Una vez completado, verás la URL de tu app: `https://tu-proyecto.vercel.app`

---

## ⏰ PASO 3: Configurar Vercel Cron

El archivo `vercel.json` ya contiene la configuración del cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-machines",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Esto ejecutará el scraping automáticamente cada hora en punto** (12:00, 13:00, 14:00...).

### 3.1 Verificar que el cron está activo

1. En el dashboard de Vercel, ve a tu proyecto
2. Clic en **Settings** > **Cron Jobs**
3. Deberías ver:
   - **Path**: `/api/cron/scrape-machines`
   - **Schedule**: `0 * * * *` (every hour)
   - **Status**: Active

### 3.2 Probar el cron manualmente (opcional)

Puedes ejecutar el cron manualmente para verificar:

```bash
curl -X GET "https://tu-proyecto.vercel.app/api/cron/scrape-machines" \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

Respuesta exitosa:
```json
{
  "success": true,
  "scrape_run_id": "uuid...",
  "machines_total": 10,
  "machines_created": 2,
  "machines_updated": 8,
  "snapshots_inserted": 30,
  "timestamp": "2026-03-04T12:00:00.000Z"
}
```

---

## 🧪 PASO 4: Verificar funcionamiento

### 4.1 Login como admin

1. Ve a `https://tu-proyecto.vercel.app/login`
2. Ingresa con el usuario admin que creaste
3. Deberías ver el panel de administración

### 4.2 Crear un cliente de prueba

1. En el panel admin, ve a **"Clientes"**
2. Clic en **"Nuevo Cliente"**
3. Completa:
   - **Email**: cliente1@ejemplo.com
   - **Contraseña**: (temporal)
   - **Nombre**: Cliente Demo
   - **Empresa**: Empresa Demo
   - **Comisión**: 15%
4. Asigna algunas máquinas al cliente
5. Guarda

### 4.3 Forzar primer scraping

1. En el panel admin, busca el botón **"Forzar Actualización"** (próximamente)
2. O ejecuta manualmente:

```bash
curl -X POST "https://tu-proyecto.vercel.app/api/admin/force-scrape" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

### 4.4 Probar como cliente

1. Abre una ventana de incógnito
2. Ve a `https://tu-proyecto.vercel.app/login`
3. Ingresa con `cliente1@ejemplo.com`
4. Deberías ver:
   - Dashboard con recaudación NETA (sin ver comisión)
   - Timestamp "Hace X minutos"
   - Badge "Automático cada hora"
   - SIN botón "Actualizar datos"

---

## 📊 PASO 5: Monitorización

### 5.1 Ver logs del cron

1. En Vercel, ve a tu proyecto
2. Clic en **"Functions"** > Busca `/api/cron/scrape-machines`
3. Verás logs de cada ejecución horaria:
   ```
   [CRON] Iniciando scraping automático...
   [CRON] Modo: REAL
   [CRON] Scraping completado: 10 máquinas
   [CRON] ✅ Scraping completado exitosamente
   ```

### 5.2 Ver historial en Supabase

1. En Supabase, ve a **Table Editor** > `scrape_runs`
2. Verás un registro por cada ejecución del cron:
   - **triggered_by_user_id**: `null` (automático)
   - **status**: `completed` o `error`
   - **started_at**: Hora de ejecución
   - **machines_scraped**: Cantidad de máquinas

---

## ⚙️ PASO 6: Configuraciones opcionales

### 6.1 Cambiar frecuencia del cron

Edita `vercel.json` y cambia el schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape-machines",
      "schedule": "0 */2 * * *"  // Cada 2 horas
      // "schedule": "0 8,20 * * *"  // A las 8:00 y 20:00
      // "schedule": "0 0 * * *"  // Una vez al día (medianoche)
    }
  ]
}
```

Push los cambios y Vercel actualizará el cron automáticamente.

### 6.2 Configurar dominio personalizado

1. En Vercel, ve a **Settings** > **Domains**
2. Clic en **"Add"**
3. Ingresa tu dominio: `vending.tuempresa.com`
4. Sigue las instrucciones para configurar DNS

### 6.3 Configurar notificaciones de errores (opcional)

Puedes integrar servicios como:
- **Sentry**: Monitoreo de errores
- **LogTail**: Logs centralizados
- **Vercel Notifications**: Alertas de deploy

---

## 🔒 PASO 7: Seguridad en producción

### ✅ Checklist de seguridad

- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada solo en Vercel (nunca en Git)
- [ ] `CRON_SECRET` generado con al menos 32 caracteres aleatorios
- [ ] `USE_MOCK_SCRAPER=false` en producción
- [ ] Contraseñas de admin y clientes fuertes
- [ ] SSL/HTTPS habilitado (Vercel lo hace por defecto)
- [ ] RLS policies verificadas en Supabase
- [ ] Credenciales de Orain en variables de entorno seguras

---

## 🆘 Troubleshooting

### El cron no se ejecuta

1. Verifica que `vercel.json` está en la raíz del proyecto
2. Verifica que la ruta del cron es correcta: `/api/cron/scrape-machines`
3. Ve a Vercel > Settings > Cron Jobs para ver el status
4. Espera hasta la próxima hora en punto (el cron se ejecuta en punto)

### Error 401 en el cron

- Verifica que `CRON_SECRET` está configurada en Vercel
- Asegúrate de que el secret no tiene espacios ni saltos de línea

### No se crean máquinas nuevas

- Verifica que el scraping está funcionando (logs en Vercel Functions)
- Verifica que `ORAIN_USERNAME` y `ORAIN_PASSWORD` son correctos
- Si estás usando mock (`USE_MOCK_SCRAPER=true`), deberías ver 10 máquinas mock

### Cliente no ve datos

- Verifica que tiene máquinas asignadas (tabla `client_machine_assignments`)
- Verifica que hay snapshots en `machine_revenue_snapshots`
- Ejecuta un scraping manual usando `/api/admin/force-scrape`

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs en Vercel Functions
2. Revisa los logs en Supabase (SQL Editor > ejecuta queries de diagnóstico)
3. Verifica que todas las variables de entorno están configuradas
4. Contacta al equipo de desarrollo

---

## 🎯 Próximos pasos

Una vez desplegado:

1. ✅ Crear todos tus clientes reales
2. ✅ Asignar máquinas a cada cliente
3. ✅ Configurar % de comisión por cliente
4. ✅ Cambiar contraseñas temporales
5. ✅ Configurar dominio personalizado
6. ✅ Monitorear el primer ciclo de scraping (esperar 1 hora)

---

**¡Tu sistema está listo para producción! 🚀**
