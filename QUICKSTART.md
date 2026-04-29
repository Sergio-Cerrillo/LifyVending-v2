# 🚀 Quickstart - Sistema Multi-Tenant Vending

Guía rápida para poner en marcha el sistema en **menos de 15 minutos**.

---

## ⚡ Pasos Rápidos

### **1. Instalar Dependencias** (2 min)

```bash
cd NewLifyVending
pnpm install
```

### **2. Configurar Supabase** (5 min)

#### Crear Proyecto
1. Ir a https://app.supabase.com
2. Click "New Project"
3. Anotar:
   - Project URL
   - Anon key
   - Service role key

#### Ejecutar Migraciones
1. Abrir **SQL Editor** en Supabase Dashboard
2. Copiar y ejecutar contenido de:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_seed_data.sql`

### **3. Configurar Variables de Entorno** (2 min)

```bash
# Copiar template
cp .env.example .env.local

# Editar .env.local con tus valores
nano .env.local
```

Valores mínimos requeridos:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
USE_MOCK_SCRAPER=true
```

### **4. Crear Usuario Admin** (2 min)

En **Supabase Dashboard > Authentication > Users**:
1. Click "Add User" → "Create New User"
2. Email: `admin@lifyvending.com`
3. Password: (tu contraseña segura)
4. Anotar el **User ID**

Ejecutar en **SQL Editor**:
```sql
-- Reemplazar 'tu-user-id-aqui' con el ID del paso anterior
INSERT INTO profiles (id, role, email, display_name)
VALUES (
  'tu-user-id-aqui',
  'admin',
  'admin@lifyvending.com',
  'Administrador'
);
```

### **5. Ejecutar Desarrollo** (1 min)

```bash
pnpm dev
```

Abrir: http://localhost:3000

---

## 🎯 Primer Uso

### **Login como Admin**
1. Ir a http://localhost:3000/login
2. Email: `admin@lifyvending.com`
3. Password: (la que creaste)

### **Crear Primer Cliente**
1. Click "Gestión de Clientes"
2. Click "Nuevo Cliente"
3. Completar:
   - Email: `cliente@ejemplo.com`
   - Password: `cliente123`
   - Empresa: `Mi Empresa S.L.`
   - Comisión: `30`
4. Click "Crear Cliente"

### **Asignar Máquinas**
1. Click "Configurar" en el cliente creado
2. Seleccionar máquinas (ej: CLUB DE MAR 5172, 5173)
3. Click "Guardar Cambios"

### **Ver como Cliente**
1. Logout
2. Login con:
   - Email: `cliente@ejemplo.com`
   - Password: `cliente123`
3. Ver dashboard con recaudación NETA
4. Click "Actualizar Datos" (ejecuta mock)

---

## 📦 Usuarios de Prueba (Seed Data)

Si ejecutaste `002_seed_data.sql`:

### **Admin**
- Email: `admin@lifyvending.com`
- Crear manualmente en Authentication

### **Clientes Precargados**

**Hotel Del Mar**
- Email: `hotel.delmar@example.com`
- Crear password en Authentication
- Comisión: 30%
- 3 máquinas asignadas

**Gimnasio Atom**
- Email: `gimnasio.atom@example.com`
- Crear password en Authentication
- Comisión: 25%
- 4 máquinas asignadas

---

## 🔍 Verificar Instalación

### **Test 1: Admin ve bruto y neto**
1. Login como admin
2. Ir a cliente → overview
3. Verificar:
   - ✅ Muestra "Bruto"
   - ✅ Muestra "Comisión"
   - ✅ Muestra "Neto (cliente ve)"

### **Test 2: Cliente solo ve neto**
1. Login como cliente
2. Ver dashboard
3. Verificar:
   - ✅ Solo muestra valores netos
   - ❌ NO muestra bruto
   - ❌ NO muestra porcentaje

### **Test 3: Scraping funciona**
1. Como cliente, click "Actualizar Datos"
2. Esperar 2-3 segundos
3. Verificar:
   - ✅ Cambia a "Actualizando..."
   - ✅ Recarga datos automáticamente
   - ✅ Muestra nueva "Última actualización"

---

## 🐛 Problemas Comunes

### **"No autorizado" al hacer login**
**Solución:**
- Verificar que el usuario existe en Authentication
- Verificar que existe profile en tabla `profiles`
```sql
SELECT * FROM profiles WHERE email = 'tu-email@ejemplo.com';
```

### **Cliente no ve máquinas**
**Solución:**
```sql
-- Verificar asignaciones
SELECT * FROM client_machine_assignments 
WHERE client_id = 'tu-client-id';

-- Si está vacío, asignar desde admin UI o SQL:
INSERT INTO client_machine_assignments (client_id, machine_id)
VALUES ('client-id', 'machine-id');
```

### **Scraping falla**
**Solución:**
- Asegurar `USE_MOCK_SCRAPER=true` en `.env.local`
- Verificar logs de consola para errores

### **RLS policy violation**
**Solución:**
```sql
-- Verificar que RLS está activo
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Debe mostrar rowsecurity = true

-- Si no, ejecutar:
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_settings ENABLE ROW LEVEL SECURITY;
-- ... resto de tablas
```

---

## 📚 Siguientes Pasos

1. **Personalizar UI**: Editar componentes en `components/ui/`
2. **Configurar Scraping Real**: 
   - Añadir credenciales ORAIN a `.env.local`
   - Cambiar `USE_MOCK_SCRAPER=false`
3. **Añadir Más Clientes**: Usar UI admin
4. **Importar Máquinas Reales**: Ejecutar scraping o insertar SQL
5. **Deploy a Producción**: Ver `MULTI_TENANT_DOCS.md` sección Deployment

---

## 🆘 Ayuda

- **Documentación Completa**: Ver `MULTI_TENANT_DOCS.md`
- **Seguridad**: Ver `SECURITY_CHECKLIST.md`
- **API Reference**: `MULTI_TENANT_DOCS.md` sección "API Endpoints"

---

## ✅ Checklist de Instalación

- [ ] Dependencias instaladas (`pnpm install`)
- [ ] Proyecto Supabase creado
- [ ] Migraciones ejecutadas (001 + 002)
- [ ] Variables de entorno configuradas (`.env.local`)
- [ ] Usuario admin creado
- [ ] Servidor de desarrollo corriendo (`pnpm dev`)
- [ ] Login admin funciona
- [ ] Creado primer cliente de prueba
- [ ] Asignadas máquinas al cliente
- [ ] Login cliente funciona
- [ ] Dashboard cliente muestra datos netos
- [ ] Botón "Actualizar Datos" funciona

---

**¡Todo listo! 🎉**

Sistema funcionando en: http://localhost:3000
