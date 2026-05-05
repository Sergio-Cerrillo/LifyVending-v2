# Solución: Error de Clientes Duplicados y Clientes no Visibles

## 🔍 El Problema

Cuando intentabas crear un cliente, aparecían dos problemas:

1. **Error de duplicado:**
   ```
   Error creando perfil: duplicate key value violates unique constraint "profiles_pkey"
   ```

2. **Clientes no visibles:** El GET mostraba "clientes encontrados: 0" aunque los usuarios se creaban.

### ¿Por qué pasaba esto?

Tu base de datos tiene un **trigger automático** llamado `on_auth_user_created` que:
1. Se ejecuta automáticamente cuando se crea un usuario en `auth.users`
2. Crea un perfil en la tabla `profiles` automáticamente

**Problemas identificados:**
- El código intentaba crear el perfil **manualmente** después → Error de duplicado
- El código no esperaba a que el trigger terminara → Timing issues
- Los clientes se creaban pero no aparecían porque el perfil no estaba listo al consultar

## ✅ Las Soluciones Implementadas

### 1. Código Arreglado con Retry Logic

He modificado la función `createNewClient` en `lib/supabase-helpers.ts` para:

- ✅ Pasar los datos correctos en `user_metadata` al crear el usuario
- ✅ **Esperar activamente** a que el trigger cree el perfil (con reintentos)
- ✅ **Fallback automático:** Si el trigger no funciona, crea el perfil manualmente
- ✅ Solo actualizar `company_name` cuando sea necesario
- ✅ Logs detallados para debugging

### 2. Flujo Completo de Creación

```
1. Admin llena formulario de nuevo cliente
   ↓
2. POST /api/admin/users
   ↓
3. Crear usuario en Auth (con user_metadata)
   ↓
4. TRIGGER automático crea perfil (300ms-1.5s)
   ↓
5. Código espera y verifica que perfil exista (5 reintentos)
   ↓
6. Si trigger falló → Crear perfil manualmente
   ↓
7. Actualizar company_name si es necesario
   ↓
8. Crear client_settings con comisiones
   ↓
9. ✅ Cliente listo para asignar máquinas
```

## 🚀 Cómo Probar

### 1. Crear un Nuevo Cliente

1. Ve a **Admin → Gestión de Clientes**
2. Click en **"Nuevo Cliente"**
3. Llena el formulario:
   - Email: `test@ejemplo.com`
   - Password: `test1234`
   - Nombre: `Cliente Prueba`
   - Empresa: `Empresa Test`
   - % Oculto: `30`
   - % Comisión: `15`
4. Click en **"Crear Cliente"**

**Logs esperados en consola:**
```
[CREATE-CLIENT] Datos recibidos RAW: {...}
[CREATE-CLIENT] Esperando a que el trigger cree el perfil...
[CREATE-CLIENT] ✅ Perfil creado por el trigger
[CREATE-CLIENT] Creando settings con % Oculto: 30 % Comisión: 15
[CREATE-CLIENT] ✅ Settings guardados en BD: [...]
```

### 2. Verificar que el Cliente Aparece

- Después de crear, la lista debería mostrar **"Clientes (1)"**
- El cliente debe aparecer con su nombre/empresa
- Debe mostrar **"0 máquinas"** inicialmente

### 3. Asignar Máquinas al Cliente

1. Click en **"Ver Cliente"** o el botón de configuración
2. Ve a la sección de **"Asignación de Máquinas"**
3. Selecciona las máquinas de la base de datos de recaudaciones
4. Guarda los cambios

**¿De dónde vienen las máquinas?**
- Las máquinas se obtienen de la tabla `machines`
- Esta tabla se llena automáticamente con el scraper (Orain, Televend, etc.)
- Solo puedes asignar máquinas que ya existan en la BD

### 4. Cliente Inicia Sesión

Cuando el cliente inicia sesión con sus credenciales:
1. El sistema verifica su rol (`client`)
2. Carga solo las máquinas asignadas (`client_machine_assignments`)
3. Muestra recaudación filtrada por esas máquinas
4. Aplica el porcentaje de comisión oculto configurado

## 🔧 Troubleshooting

### Si no ves logs de creación

Revisa la consola del navegador (F12 → Console) y la terminal del servidor.

### Si sigue mostrando "clientes encontrados: 0"

1. Ejecuta el PASO 1 del archivo `FIX_DUPLICATE_CLIENTS.sql`:
   ```sql
   SELECT au.id, au.email FROM auth.users au
   LEFT JOIN public.profiles p ON au.id = p.id
   WHERE p.id IS NULL;
   ```

2. Si hay usuarios sin perfil, ejecuta el PASO 3 para crearlos:
   ```sql
   INSERT INTO public.profiles (id, email, role, display_name)
   SELECT au.id, au.email, 'client'::user_role, au.email
   FROM auth.users au
   LEFT JOIN public.profiles p ON au.id = p.id
   WHERE p.id IS NULL
   ON CONFLICT (id) DO NOTHING;
   ```

### Verificar que el trigger está activo

```sql
SELECT trigger_name, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

Debe mostrar:
- `trigger_name`: `on_auth_user_created`
- `event_object_table`: `users`
- `action_timing`: `AFTER`

### Si el trigger no existe

Ejecuta la migración `20260429_add_operador_role.sql` que lo crea.

## 📊 Flujo del Sistema Multi-Tenant

```
┌─────────────────────────────────────────────────────┐
│              ADMIN (Lify Vending)                   │
│                                                     │
│  1. Crea Cliente (email, password, comisiones)     │
│  2. Asigna Máquinas al Cliente                     │
│  3. Ejecuta Scraper (obtiene recaudaciones)        │
│  4. Ve TODO: todas las máquinas y recaudaciones    │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│              CLIENTE (Hotel, Bar, etc.)             │
│                                                     │
│  1. Inicia sesión con sus credenciales             │
│  2. Ve SOLO sus máquinas asignadas                 │
│  3. Ve recaudación FILTRADA por sus máquinas       │
│  4. Recaudación NETA (con comisión aplicada)       │
│  5. NO puede ver otras máquinas del sistema        │
└─────────────────────────────────────────────────────┘
```

## 🗄️ Estructura de Datos

### Tablas Principales

1. **`auth.users`** → Autenticación (Supabase Auth)
2. **`profiles`** → Información del usuario (role, email, nombre)
3. **`client_settings`** → Configuración de comisiones por cliente
4. **`machines`** → Máquinas vending (scraped de Orain/Televend)
5. **`client_machine_assignments`** → Qué máquinas ve cada cliente
6. **`machine_revenue_snapshots`** → Recaudaciones por máquina

### Relaciones

```
auth.users (1) ─── (1) profiles
                         │
                         ├─── (1) client_settings
                         │
                         └─── (*) client_machine_assignments
                                    │
                                    └─── (*) machines
                                             │
                                             └─── (*) machine_revenue_snapshots
```

## 📝 Archivos Modificados

1. ✅ `lib/supabase-helpers.ts` - Función `createNewClient` con retry logic y fallback
2. ✅ `FIX_DUPLICATE_CLIENTS.sql` - Scripts de diagnóstico y reparación
3. ✅ `FIX_CLIENTES_README.md` - Esta guía actualizada

## ✨ Mejoras Implementadas

- **Robustez:** Funciona con o sin trigger
- **Logs detallados:** Fácil debugging
- **Retry logic:** Espera activa con reintentos
- **Fallback automático:** Crea perfil manualmente si el trigger falla
- **Sin errores de duplicado:** Maneja conflictos correctamente
