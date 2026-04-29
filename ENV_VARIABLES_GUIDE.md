# 🔐 Variables de Entorno - Configuración Completa

## 📋 Variables Requeridas para Producción

### 1. Supabase (Base de Datos)

```env
# URL pública de tu proyecto Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co

# Anon/Public key (segura para cliente)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cHJveWVjdG8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjI0MjA4OCwiZXhwIjoxOTMxODE4MDg4fQ.xxx

# Service role key (NUNCA exponer al cliente - solo servidor)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cHJveWVjdG8iLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjQyMDg4LCJleHAiOjE5MzE4MTgwODh9.xxx
```

**Cómo obtenerlas:**
1. Ir a [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleccionar tu proyecto
3. Settings → API
4. Copiar:
   - **URL:** Campo "Project URL"
   - **anon key:** Campo "anon/public"
   - **service_role key:** Campo "service_role" (⚠️ SECRETO)

---

### 2. Televend (Scraping de Stock)

```env
# Usuario de Televend Cloud
TELEVEND_USERNAME=tu_usuario_televend

# Contraseña de Televend Cloud
TELEVEND_PASSWORD=tu_password_televend
```

**Cómo obtenerlas:**
- Son las credenciales que usas para entrar en https://app.televendcloud.com
- Si no tienes acceso, contactar con Televend

⚠️ **IMPORTANTE:** Sin estas variables, el scraping de stock NO funcionará.

---

### 3. Orain/Frekuent (Scraping de Recaudaciones - Opcional)

```env
# Usuario de Orain
ORAIN_USER=tu_usuario_orain

# Contraseña de Orain
ORAIN_PASS=tu_password_orain
```

**Cómo obtenerlas:**
- Son las credenciales que usas para entrar en el portal de Orain/Frekuent
- Usadas para scraping de recaudaciones

ℹ️ **Nota:** Si solo usas Televend para stock, estas son opcionales.

---

### 4. CRON Secret (Seguridad)

```env
# Token secreto para proteger endpoints de CRON
CRON_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**Cómo generarla:**

```bash
# En tu terminal local (Mac/Linux):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Alternativamente (cualquier OS):
openssl rand -hex 32
```

⚠️ **CRÍTICO:** 
- Este secret protege tus endpoints de CRON
- NUNCA compartir este valor
- Mínimo 32 caracteres
- Solo Vercel debe conocerlo

---

### 5. Mock Mode (Desarrollo - Opcional)

```env
# Usar datos mock en lugar de scraping real
USE_MOCK_SCRAPER=false
```

**Valores posibles:**
- `false` - Scraping real (PRODUCCIÓN)
- `true` - Datos mock (DESARROLLO/TESTING)

💡 **Usar en desarrollo** para no saturar servidores externos.

---

## 📦 Archivo .env.example (Para Referencia)

Crea este archivo en tu proyecto para documentar:

```env
# ==========================================
# SUPABASE
# ==========================================
NEXT_PUBLIC_SUPABASE_URL=https://tuproyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # ⚠️ NUNCA commitear

# ==========================================
# TELEVEND (Requerido para Stock)
# ==========================================
TELEVEND_USERNAME=tu_usuario
TELEVEND_PASSWORD=tu_password # ⚠️ NUNCA commitear

# ==========================================
# ORAIN/FREKUENT (Opcional)
# ==========================================
ORAIN_USER=tu_usuario
ORAIN_PASS=tu_password # ⚠️ NUNCA commitear

# ==========================================
# CRON SECURITY (Crítico)
# ==========================================
CRON_SECRET=generar_con_crypto_randomBytes # ⚠️ NUNCA commitear

# ==========================================
# DEVELOPMENT (Opcional)
# ==========================================
USE_MOCK_SCRAPER=false
```

---

## 🚀 Configurar en Vercel

### Vía Dashboard (Recomendado)

1. Ir a tu proyecto en Vercel
2. **Settings → Environment Variables**
3. Para cada variable:
   - **Key:** Nombre (ej: `CRON_SECRET`)
   - **Value:** Valor secreto
   - **Environment:** Seleccionar:
     - ✅ Production
     - ✅ Preview (opcional)
     - ✅ Development (opcional)
4. Click **"Add"**

### Vía CLI (Alternativa)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Link a proyecto
vercel link

# Agregar variables
vercel env add CRON_SECRET production
vercel env add TELEVEND_USERNAME production
vercel env add TELEVEND_PASSWORD production
# ... etc
```

---

## 🔒 Seguridad: Variables Sensibles

### ❌ NUNCA Hacer:

```bash
# NUNCA commitear archivo .env con secretos reales
git add .env

# NUNCA compartir service_role key públicamente
console.log(process.env.SUPABASE_SERVICE_ROLE_KEY)

# NUNCA usar en código cliente
// ❌ MAL - expuesto al navegador
const secret = process.env.CRON_SECRET
```

### ✅ SÍ Hacer:

```bash
# Agregar .env al .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env*.local" >> .gitignore

# Crear .env.example sin valores reales
cp .env .env.example
# Editar .env.example y reemplazar valores con placeholders
```

```javascript
// ✅ BIEN - solo en API routes (servidor)
// app/api/cron/scrape-stock/route.ts
const secret = process.env.CRON_SECRET;
```

---

## 🧪 Testing de Variables

### Script de Verificación

Crear archivo `scripts/check-env.ts`:

```typescript
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TELEVEND_USERNAME',
  'TELEVEND_PASSWORD',
  'CRON_SECRET',
];

console.log('🔍 Verificando variables de entorno...\n');

let missing = 0;

for (const varName of requiredEnvVars) {
  const value = process.env[varName];
  if (!value) {
    console.error(`❌ ${varName} - NO CONFIGURADA`);
    missing++;
  } else {
    const masked = varName.includes('SECRET') || varName.includes('PASSWORD') || varName.includes('KEY')
      ? '***' + value.slice(-4)
      : value;
    console.log(`✅ ${varName} - ${masked}`);
  }
}

console.log(`\n${missing === 0 ? '✅ Todas las variables configuradas' : `❌ ${missing} variables faltantes`}`);
process.exit(missing > 0 ? 1 : 0);
```

**Ejecutar:**

```bash
tsx scripts/check-env.ts
```

---

## 📊 Variables por Entorno

### Development (Local)

```env
# .env.local (gitignored)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...local
SUPABASE_SERVICE_ROLE_KEY=eyJ...local
TELEVEND_USERNAME=dev_user
TELEVEND_PASSWORD=dev_pass
CRON_SECRET=dev_secret_min_32_chars
USE_MOCK_SCRAPER=true  # ← Usar mock en desarrollo
```

### Production (Vercel)

```env
# Configuradas en Vercel Dashboard
NEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...prod
SUPABASE_SERVICE_ROLE_KEY=eyJ...prod
TELEVEND_USERNAME=prod_user
TELEVEND_PASSWORD=prod_pass
CRON_SECRET=prod_secret_generado_con_crypto
USE_MOCK_SCRAPER=false  # ← Scraping real
```

---

## 🆘 Troubleshooting

### Error: "CRON_SECRET not configured"

**Causa:** Variable no configurada en Vercel

**Solución:**
1. Vercel Dashboard → Settings → Environment Variables
2. Agregar `CRON_SECRET` con valor generado
3. Redeploy: `vercel --prod`

### Error: "Unauthorized" en CRON

**Causa:** Header incorrecto o secret no coincide

**Solución:**
```bash
# Verificar que el secret coincide
curl -v -X GET "https://tu-dominio.vercel.app/api/cron/scrape-stock" \
  -H "Authorization: Bearer TU_CRON_SECRET_EXACTO"

# Nota: Debe ser exactamente "Bearer " + secret (con espacio)
```

### Error: "Cannot connect to Supabase"

**Causa:** URL o keys incorrectas

**Solución:**
1. Verificar URL no tenga espacios ni /
2. Copiar keys completas (muy largas, ~200+ caracteres)
3. Verificar que anon key empieza con `eyJ`

---

## 📞 Recursos

- **Supabase API Docs:** https://supabase.com/docs/guides/api
- **Vercel Env Vars:** https://vercel.com/docs/concepts/projects/environment-variables
- **Next.js Env Vars:** https://nextjs.org/docs/basic-features/environment-variables

---

**Última actualización:** 29 de abril de 2026
