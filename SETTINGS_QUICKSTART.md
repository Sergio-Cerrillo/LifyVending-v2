# ⚙️ Sistema de Configuración - Inicio Rápido

## 🚀 Setup (Primera Vez)

### 1. Ejecutar Migración SQL

Desde el dashboard de Supabase o usando psql:

```bash
psql -U postgres -h YOUR_HOST -d YOUR_DB -f supabase/migrations/20260306_create_app_settings.sql
```

O copia y pega el contenido del archivo en el SQL Editor de Supabase.

### 2. Insertar Registro Inicial

```sql
INSERT INTO app_settings (
  id,
  company_name,
  admin_panel_name,
  client_portal_name,
  support_email,
  timezone,
  currency,
  date_format,
  default_language,
  scraping_config,
  clients_config,
  security_config,
  notifications_config,
  appearance_config,
  maintenance_config
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'LifyVending',
  'Panel Administrativo',
  'Portal Cliente',
  'info@lifyvending.com',
  'Europe/Madrid',
  'EUR',
  'DD/MM/YYYY',
  'es',
  '{
    "enabled": true,
    "orain_enabled": true,
    "televend_enabled": true,
    "default_interval_hours": 12,
    "retry_attempts": 3,
    "retry_delay_minutes": 5,
    "timeout_seconds": 60,
    "concurrent_scrapes": 3,
    "headless_mode": true,
    "screenshot_on_error": true,
    "notification_on_failure": true,
    "log_level": "info"
  }'::jsonb,
  '{
    "default_percentage": 50,
    "allow_custom_percentage": true,
    "auto_refresh_enabled": true,
    "refresh_interval_minutes": 30,
    "max_refresh_requests_per_day": 10,
    "require_approval_for_new_clients": false,
    "allow_client_registration": false,
    "client_portal_enabled": true
  }'::jsonb,
  '{
    "password_min_length": 8,
    "password_require_uppercase": true,
    "password_require_lowercase": true,
    "password_require_numbers": true,
    "password_require_special": false,
    "session_timeout_minutes": 480,
    "max_login_attempts": 5,
    "lockout_duration_minutes": 15,
    "require_email_verification": true,
    "two_factor_enabled": false,
    "ip_whitelist_enabled": false,
    "rate_limit_enabled": true,
    "rate_limit_requests_per_minute": 60
  }'::jsonb,
  '{
    "email_notifications_enabled": true,
    "notify_on_scrape_failure": true,
    "notify_on_machine_offline": true,
    "notify_on_low_stock": false,
    "notify_on_new_client": true,
    "admin_email": "admin@lifyvending.com",
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 587,
    "smtp_user": "",
    "smtp_from_name": "LifyVending",
    "smtp_from_email": "noreply@lifyvending.com"
  }'::jsonb,
  '{
    "theme": "system",
    "primary_color": "#3b82f6",
    "logo_url": "",
    "favicon_url": "",
    "company_logo_url": "",
    "show_branding": true,
    "custom_css": "",
    "welcome_message": "Bienvenido al Panel de Administración",
    "footer_text": "© 2026 LifyVending. Todos los derechos reservados."
  }'::jsonb,
  '{
    "maintenance_mode": false,
    "maintenance_message": "Estamos realizando tareas de mantenimiento. Volveremos pronto.",
    "allow_admin_access": true,
    "scheduled_maintenance": false,
    "maintenance_start": null,
    "maintenance_end": null
  }'::jsonb 
) 
ON CONFLICT (id) DO NOTHING;
```

---

## 📱 Acceso

1. Inicia sesión como **administrador** en tu app
2. Navega a: **`/admin/configuracion`**
3. Verás 7 pestañas:
   - ⚙️ **General** - Info de la empresa
   - 📊 **Scraping** - Configuración de extracción de datos
   - 👥 **Clientes** - Configuración de clientes
   - 🔒 **Seguridad** - Políticas de contraseñas y sesiones
   - 📧 **Notificaciones** - Alertas por email y SMTP
   - 🎨 **Apariencia** - Personalización visual
   - 🛠️ **Mantenimiento** - Modo mantenimiento

---

## 💡 Uso Común

### Activar/Desactivar Scraping
1. Ve a **Scraping** tab
2. Toggle el switch "Scraping Habilitado"
3. Click "Guardar Cambios"

### Cambiar Porcentaje por Defecto de Clientes
1. Ve a **Clientes** tab
2. Modifica "Porcentaje Por Defecto"
3. Click "Guardar Cambios"

### Activar Modo Mantenimiento
1. Ve a **Mantenimiento** tab
2. Toggle "Modo de Mantenimiento"
3. Escribe mensaje personalizado
4. Click "Guardar Cambios"
⚠️ **Cuidado**: Deshabilitará acceso para todos los usuarios (excepto admins si está habilitado)

### Ejecutar Scraping Manual
1. Ve a **Scraping** tab
2. Click "Ejecutar Scraping Manual" en la card de estado
3. El scraping se ejecutará inmediatamente

---

## 🔧 Archivos Importantes

- **Migración**: `supabase/migrations/20260306_create_app_settings.sql`
- **TypeScript Types**: `lib/types/settings.ts`
- **Service Layer**: `lib/services/settings-service.ts`
- **Página Principal**: `app/admin/configuracion/page.tsx`
- **Formularios**: `components/admin/settings/*.tsx`

---

## 📚 Documentación Completa

Ver `SETTINGS_SYSTEM_DOCUMENTATION.md` para documentación detallada completa.

---

## ✅ Checklist Post-Setup

- [ ] Migración SQL ejecutada sin errores
- [ ] Registro inicial insertado
- [ ] Puedes acceder a `/admin/configuracion`
- [ ] Todas las pestañas cargan correctamente
- [ ] Puedes guardar cambios en cada sección
- [ ] Recibes toast notifications al guardar
- [ ] El scraping manual funciona (tab Scraping)

---

## 🐛 Troubleshooting

**Error: "Cannot read property 'scraping_config' of null"**
→ No se insertó el registro inicial. Ejecuta el INSERT de arriba.

**Error: "Permission denied for table app_settings"**
→ Las RLS policies requieren rol 'admin'. Asegúrate de estar logueado como admin.

**No se guarda nada**
→ Revisa la consola del navegador. Probablemente error de permisos o tabla no creada.

**Scraping manual no funciona**
→ Verifica que el endpoint `/api/admin/force-scrape` existe y funciona.

---

##  ¡Listo!

El sistema de configuración está ahora completamente funcional y accesible desde el panel de administración.
