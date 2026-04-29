# Sistema de Configuración - Documentación Completa

## 📋 Resumen

Sistema completo de configuración para el panel de administración de LifyVending. Permite gestionar todos los aspectos de la aplicación desde una interfaz centralizada con 7 secciones principales.

---

## 🗂️ Estructura de Archivos Creados

### **1. Base de Datos**
```
supabase/migrations/20260306_create_app_settings.sql
```
- Tabla `app_settings` con patrón single-record (constraint en UUID)
- 6 columnas JSONB para configuraciones modulares
- RLS policies (admin-only)
- Trigger para auto-actualización de timestamps
- Vista `settings_audit` para historial de cambios

### **2. TypeScript Types**
```
lib/types/settings.ts
```
Interfaces completas para:
- `AppSettings` (estructura principal)
- `ScrapingConfig`, `ClientsConfig`, `SecurityConfig`
- `NotificationsConfig`, `AppearanceConfig`, `MaintenanceConfig`
- `ScrapingStatus`, `SettingsAudit`
- Tipos parciales para formularios

### **3. Service Layer**
```
lib/services/settings-service.ts
```
Funciones CRUD:
- `getSettings()`: Obtener configuración global
- `updateGeneralSettings()`: Actualizar configuración general
- `updateScrapingConfig()`: Configuración de scraping
- `updateClientsConfig()`: Configuración de clientes
- `updateSecurityConfig()`: Configuración de seguridad
- `updateNotificationsConfig()`: Configuración de notificaciones
- `updateAppearanceConfig()`: Configuración de apariencia
- `updateMaintenanceConfig()`: Modo mantenimiento
- `getSettingsAudit()`: Historial de cambios
- `getScrapingStatus()`: Estadísticas de scraping
- `triggerManualScraping()`: Forzar ejecución manual

### **4. React Components - Forms**
```
components/admin/settings/
├── general-form.tsx            # Configuración general
├── scraping-form.tsx           # Configuración de scraping
├── clients-form.tsx            # Configuración de clientes
├── security-form.tsx           # Configuración de seguridad
├── notifications-form.tsx      # Configuración de notificaciones
├── appearance-form.tsx         # Configuración de apariencia
└── maintenance-form.tsx        # Modo mantenimiento
```

### **5. Settings Page**
```
app/admin/configuracion/page.tsx
```
Página principal con navegación por tabs

---

## 📊 Configuraciones Disponibles

### **1️⃣ General** (`Settings`)
- Nombre de la empresa
- Nombre del panel admin
- Nombre del portal cliente
- Email de soporte
- Teléfono de soporte
- Zona horaria
- Moneda
- Formato de fecha
- Idioma por defecto
- Texto legal / pie de página

### **2️⃣ Scraping** (`Activity`)
- **Estado del Scraping**: Card con estadísticas en tiempo real
- **Scraping Global**: Switch maestro
- **Proveedores**: Habilitar/deshabilitar Orain y Televend
- **Intervalos**:
  - Intervalo por defecto (horas)
  - Intentos de reintento
  - Delay entre reintentos
  - Timeout
  - Scrapes concurrentes
- **Opciones Avanzadas**:
  - Modo headless
  - Captura en error
  - Notificación en fallo
  - Nivel de log
- **Botón Manual**: Ejecutar scraping manual

### **3️⃣ Clientes** (`Users`)
- **Portal**: Habilitar/deshabilitar portal cliente
- **Porcentajes**:
  - Porcentaje por defecto
  - Permitir porcentaje personalizado
- **Auto-Refresh**:
  - Habilitar auto-refresh
  - Intervalo de refresco (minutos)
  - Máx. peticiones/día
- **Registro**:
  - Permitir auto-registro
  - Requiere aprobación

### **4️⃣ Seguridad** (`Shield`)
- **Política de Contraseñas**:
  - Longitud mínima
  - Requerir mayúsculas
  - Requerir minúsculas
  - Requerir números
  - Requerir caracteres especiales
- **Gestión de Sesiones**:
  - Timeout de sesión
  - Intentos máximos de login
  - Duración del bloqueo
- **Autenticación**:
  - Verificación de email
  - 2FA
- **Restricciones de IP**:
  - Whitelist habilitada
  - Lista de IPs permitidas
- **Rate Limiting**:
  - Habilitar limitación
  - Peticiones por minuto

### **5️⃣ Notificaciones** (`Bell`)
- **Master Switch**: Notificaciones email habilitadas
- **Tipos de Notificaciones**:
  - Fallos de scraping
  - Máquina offline
  - Stock bajo
  - Nuevo cliente
- **Email Admin**: Email principal para alertas
- **Configuración SMTP**:
  - Servidor SMTP
  - Puerto
  - Usuario
  - Nombre del remitente
  - Email del remitente

### **6️⃣ Apariencia** (`Palette`)
- **Tema**: Claro / Oscuro / Sistema
- **Color Primario**: Selector de color + hex input
- **Branding**:
  - Mostrar branding
  - URL del logo (panel admin)
  - URL del logo de empresa
  - URL del favicon
- **Contenido**:
  - Mensaje de bienvenida
  - Texto del pie de página
- **CSS Personalizado**: Estilos globales (avanzado)

### **7️⃣ Mantenimiento** (`Wrench`)
- **Modo Mantenimiento**: Switch principal (con alerta)
- **Mensaje**: Texto mostrado a usuarios
- **Acceso Admin**: Permitir acceso durante mantenimiento
- **Programación**:
  - Mantenimiento programado
  - Fecha/hora inicio
  - Fecha/hora fin
- **Nota Informativa**: Alert box explicativo

---

## 🔐 Seguridad

### **RLS Policies**
```sql
-- Solo admins pueden leer
CREATE POLICY "settings_select_policy"
ON app_settings FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Solo admins pueden actualizar
CREATE POLICY "settings_update_policy"
ON app_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

### **Audit Trail**
- Campo `updated_at`: Auto-actualizado via trigger
- Campo `updated_by`: Auto-actualizado con `auth.uid()`
- Vista `settings_audit`: JOIN con tabla `profiles` para detalles del usuario

---

## 🧩 Patrón de Arquitectura

### **Single-Record Pattern**
```sql
CONSTRAINT app_settings_single_record 
  CHECK (id = '00000000-0000-0000-0000-000000000001')
```
- Solo permite un registro global
- Simplifica queries (no necesita WHERE id = ...)
- Evita duplicados

### **JSONB Configuration**
```typescript
{
  scraping_config: { enabled: true, orain_enabled: true, ... },
  clients_config: { default_percentage: 50, ... },
  security_config: { password_min_length: 8, ... },
  notifications_config: { email_notifications_enabled: true, ... },
  appearance_config: { theme: 'light', ... },
  maintenance_config: { maintenance_mode: false, ... }
}
```

**Ventajas**:
- Actualizaciones atómicas por sección
- Flexibilidad para agregar campos
- Type-safe en TypeScript
- Merge behavior conserva campos no modificados

---

## 📡 API Endpoints Utilizados

### **REST API**
```typescript
// Llamado desde triggerManualScraping()
POST /api/admin/force-scrape
```

### **Direct Supabase**
```typescript
// Service layer usa directamente Supabase client
supabase.from('app_settings').select('*').single()
supabase.from('app_settings').update({ ... })
supabase.from('scrape_runs').select('*')
```

---

## 🎨 UI Components Utilizados

### **shadcn/ui**
- `Tabs` / `TabsContent` / `TabsList` / `TabsTrigger`
- `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent`
- `Form` / `FormField` / `FormItem` / `FormLabel` / `FormControl` / `FormDescription` / `FormMessage`
- `Input` / `Textarea` / `Select` / `Switch`
- `Button` / `Badge` / `Alert` / `Skeleton`

### **Validación**
- `Zod`: Schemas de validación
- `React Hook Form`: Gestión de estado del formulario
- `@hookform/resolvers/zod`: Integración

### **Notificaciones**
- `sonner`: Toast notifications para feedback

---

## 🚀 Integración con Sistema Existente

### **Navegación**
Ya integrado en [components/admin/admin-layout.tsx](components/admin/admin-layout.tsx):
```typescript
{
  name: 'Configuración',
  href: '/admin/configuracion',
  icon: Settings,
  roles: ['admin'],
},
```

### **Auth Context**
Hereda automáticamente contexto de autenticación:
```typescript
// app/admin/layout.tsx
<AuthProvider>
  <DataProvider>
    <AdminLayout>{children}</AdminLayout>
  </DataProvider>
</AuthProvider>
```

### **Scraping Integration**
- `getScrapingStatus()`: Lee de tabla `scrape_runs` existente
- `triggerManualScraping()`: POST a endpoint existente `/api/admin/force-scrape`
- Dashboard scraping usa configuración de `settings.scraping_config`

---

## 📝 Ejemplo de Uso

### **Leer Configuración**
```typescript
import { getSettings } from '@/lib/services/settings-service';

const settings = await getSettings();
console.log(settings.scraping_config.enabled); // true/false
```

### **Actualizar Configuración**
```typescript
import { updateScrapingConfig } from '@/lib/services/settings-service';

const result = await updateScrapingConfig({
  enabled: false,
  default_interval_hours: 24,
});

if (result.success) {
  toast.success('Guardado correctamente');
}
```

### **Estadísticas de Scraping**
```typescript
import { getScrapingStatus } from '@/lib/services/settings-service';

const status = await getScrapingStatus();
console.log(status?.success_rate); // 95.5
```

---

## ✅ Checklist de Implementación

- [x] Migración SQL creada
- [x] TypeScript types definidas
- [x] Service layer implementado
- [x] 7 formularios de configuración creados
- [x] Página principal con tabs
- [x] Validación con Zod
- [x] Integración con admin layout
- [x] RLS policies configuradas
- [x] Audit trail implementado
- [x] Loading states y error handling
- [x] Toast notifications
- [x] Responsive design (grid tablets/desktop)
- [x] Iconos lucide-react
- [x] Type safety completo

---

## 🔄 Próximos Pasos

1. **Ejecutar Migración SQL**:
   ```bash
   # Desde Supabase Dashboard o CLI
   psql -U postgres -h <HOST> -d <DB> -f supabase/migrations/20260306_create_app_settings.sql
   ```

2. **Insertar Registro Inicial** (si no existe):
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
     default_language
   ) VALUES (
     '00000000-0000-0000-0000-000000000001',
     'LifyVending',
     'Panel Administrativo',
     'Portal Cliente',
     'soporte@lifyvending.com',
     'Europe/Madrid',
     'EUR',
     'DD/MM/YYYY',
     'es'
   ) ON CONFLICT (id) DO NOTHING;
   ```

3. **Probar en Desarrollo**:
   - Navegar a `/admin/configuracion`
   - Probar cada tab
   - Verificar guardado correcto
   - Verificar validaciones

4. **Testing Adicional**:
   - Verificar RLS (intentar editar sin permisos de admin)
   - Probar scraping manual
   - Verificar audit trail
   - Testing responsive (mobile/tablet/desktop)

5. **Documentación para Usuario Final**:
   - Crear guía de usuario con screenshots
   - Explicar cada configuración
   - Casos de uso comunes

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: Next.js 14 (App Router), React Server Components
- **Backend**: Supabase PostgreSQL
- **TypeScript**: Type safety completo
- **UI**: shadcn/ui + Tailwind CSS
- **Validación**: Zod + React Hook Form
- **Notificaciones**: Sonner
- **Iconos**: Lucide React

---

## 📞 Soporte

Para problemas o preguntas sobre este sistema:
1. Revisar esta documentación completa
2. Verificar logs de Supabase
3. Revisar errores de TypeScript
4. Consultar errores en consola del navegador

---

## 📄 Licencia

Código propietario de LifyVending © 2026
