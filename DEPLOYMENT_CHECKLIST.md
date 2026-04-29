# ✅ Checklist de Deployment - Quick Reference

## 🎯 Pre-Deployment

- [ ] Código compilando sin errores (`pnpm build`)
- [ ] Variables de entorno preparadas
- [ ] CRON_SECRET generado (32+ caracteres)
- [ ] Credenciales Televend verificadas
- [ ] Backup de BD actual (opcional pero recomendado)

## 📦 GitHub

```bash
# Crear nuevo repo en GitHub: newlify-vending-production

cd /Users/sergiocerrillo/Desktop/www-Proyectos/NewLifyVending

# Inicializar git
git init
git add .
git commit -m "Initial commit: Sistema de scraping automático"

# Conectar y push
git remote add origin https://github.com/TU_USUARIO/newlify-vending-production.git
git branch -M main
git push -u origin main
```

## 🗄️ Supabase

1. **SQL Editor:** Ejecutar `supabase/migrations/20260429_create_stock_tables.sql`
2. **Verificar:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('machine_stock_current', 'stock_products_current');
```

## ☁️ Vercel

### Variables de Entorno:

```bash
# Generar CRON_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TELEVEND_USERNAME=xxx
TELEVEND_PASSWORD=xxx
CRON_SECRET=xxx (el generado arriba)
ORAIN_USER=xxx (opcional)
ORAIN_PASS=xxx (opcional)
```

### Deploy:
1. Importar repo desde GitHub
2. Configurar variables de entorno
3. Deploy
4. Verificar CRONs en Settings → Cron Jobs

## ✅ Verificación Post-Deploy

```bash
# Test CRON manualmente (reemplaza DOMINIO y SECRET)
curl -X GET "https://DOMINIO.vercel.app/api/cron/scrape-stock" \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

### Checklist:
- [ ] App carga sin errores
- [ ] Stock page visible (sin botones scraping manual)
- [ ] Mensaje "Actualización automática cada 30 minutos" visible
- [ ] CRONs activos en Vercel Settings
- [ ] Logs sin errores en Vercel
- [ ] Datos aparecen en Supabase después del primer scraping

## 📊 Queries Útiles

```sql
-- Ver último scraping
SELECT MAX(scraped_at) as last_update, COUNT(*) as machines
FROM machine_stock_current;

-- Ver máquinas con productos a reponer
SELECT machine_name, total_to_replenish 
FROM machine_stock_current 
WHERE total_to_replenish > 0
ORDER BY total_to_replenish DESC;

-- Ver tamaño de tablas
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE '%stock%'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

## 🔄 Schedule CRONs

```
Stock:      */30 * * * *  (cada 30 minutos)
Revenue:    0 * * * *     (cada hora en punto)
```

## 🚨 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| CRON no ejecuta | Verificar CRON_SECRET en Vercel |
| Error 401 | Formato header: `Authorization: Bearer SECRET` |
| Timeout | Upgrade Vercel plan o reducir máquinas |
| No datos | Ejecutar CRON manual una vez |
| Error BD | Verificar migración SQL ejecutada |

## 📞 Contactos

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **GitHub Repo:** https://github.com/TU_USUARIO/newlify-vending-production

---

**¡Todo listo para producción!** 🚀
