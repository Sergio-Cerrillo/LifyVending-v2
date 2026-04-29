# Sistema de Gestión de Empleados

Sistema completo para gestionar usuarios con diferentes roles y permisos de acceso.

## 📋 Características

### Roles Disponibles

1. **Administrador** (`admin`)
   - Acceso completo al sistema
   - Puede gestionar empleados
   - Acceso a todas las funcionalidades

2. **Operador** (`operador`)
   - Acceso limitado solo a Stock de máquinas
   - No puede crear/eliminar otros usuarios
   - Perfecto para trabajadores de campo

## 🚀 Funcionalidades

### Para Administradores

✅ **Crear empleados**
- Email y contraseña obligatorios
- Asignar rol (Admin u Operador)
- Los usuarios se crean en Supabase Auth

✅ **Listar empleados**
- Ver todos los usuarios del sistema
- Ver último acceso
- Filtrar por nombre o email

✅ **Eliminar empleados**
- Eliminar usuarios del sistema
- Confirmación antes de eliminar

## 🔐 Seguridad

- Los usuarios se crean en **Supabase Auth**
- Las contraseñas son hasheadas automáticamente
- Contraseña mínima de 8 caracteres
- Email auto-confirmado al crear usuario
- **Los perfiles se crean automáticamente** vía trigger de base de datos
- Sesión persistente con JWT tokens de Supabase

## 📍 Ubicación en el Sistema

**Menú Admin** → **Gestión de Empleados**

Solo visible para usuarios con rol `admin`.

## 🛠️ Archivos Creados

### Frontend
- `components/admin/empleados-page.tsx` - Componente principal
- `app/admin/empleados/page.tsx` - Ruta de la página

### Backend
- `app/api/admin/employees/route.ts` - API endpoints (GET, POST, DELETE, PUT)

### Configuración
- `components/admin/admin-layout.tsx` - Menú actualizado
- `lib/types.ts` - Tipos actualizados con permisos

## 🔄 API Endpoints

### GET `/api/admin/employees`
Obtiene lista de todos los empleados

**Response:**
```json
{
  "employees": [
    {
      "id": "uuid",
      "email": "usuario@empresa.com",
      "name": "Juan Pérez",
      "role": "operador",
      "permissions": [],
      "created_at": "2024-01-01T00:00:00Z",
      "last_sign_in_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST `/api/admin/employees`
Crea un nuevo empleado

**Request Body:**
```json
{
  "email": "nuevo@empresa.com",
  "password": "contraseña123",
  "name": "Nuevo Empleado",
  "role": "operador",
  "permissions": []
}
```

**Response:**
```json
{
  "success": true,
  "employee": {
    "id": "uuid",
    "email": "nuevo@empresa.com",
    "name": "Nuevo Empleado",
    "role": "operador",
    "permissions": []
  }
}
```

### DELETE `/api/admin/employees?id=uuid`
Elimina un empleado

**Response:**
```json
{
  "success": true,
  "message": "Empleado eliminado exitosamente"
}
```

### PUT `/api/admin/employees`
Actualiza un empleado (para futuras mejoras)

**Request Body:**
```json
{
  "userId": "uuid",
  "name": "Nombre Actualizado",
  "role": "admin",
  "permissions": ["stock:view"]
}
```

## 💡 Próximas Mejoras Sugeridas

1. **Editar empleados** - Actualizar nombre/rol de usuarios existentes
2. **Permisos granulares** - Control más fino de permisos (ej: solo ver ciertas máquinas)
3. **Resetear contraseña** - Enviar email para cambio de contraseña
4. **Historial de actividad** - Log de acciones de cada usuario
5. **Desactivar usuarios** - Suspender acceso temporalmente sin eliminar

## 🧪 Cómo Probar

1. **Acceder como admin:**
   - Ir a `/admin/empleados`

2. **Crear un operador:**
   - Click en "Crear Empleado"
   - Llenar formulario con rol "Operador"
   - Guardar

3. **Verificar permisos:**
   - Cerrar sesión
   - Iniciar sesión con el nuevo usuario
   - Verificar que solo tiene acceso a Stock

## ⚠️ Notas Importantes

- Solo usuarios con rol `admin` pueden acceder a la gestión de empleados
- Los operadores solo verán las opciones de menú permitidas
- Al eliminar un usuario, se elimina permanentemente de Supabase Auth
- Las contraseñas no se pueden recuperar (solo resetear)

## 🔧 Configuración Requerida

Asegúrate de tener estas variables de entorno configuradas:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

El `SUPABASE_SERVICE_ROLE_KEY` es necesario para usar la Admin API de Supabase Auth.

## 🔄 Cómo Funciona Internamente

### Flujo de Creación de Empleado

1. **Admin crea empleado** vía interfaz
2. **API crea usuario** en Supabase Auth con `user_metadata`
3. **Trigger automático** crea registro en tabla `profiles`
4. **Usuario puede hacer login** inmediatamente

### Flujo de Login de Empleado

1. **Empleado ingresa credenciales**
2. **Supabase Auth valida** email y contraseña
3. **Sistema carga perfil** desde tabla `profiles`
4. **Se aplican permisos** según rol (admin/operador)
5. **Redirección automática** a dashboard con menú filtrado

### Estructura de Datos

**Supabase Auth (auth.users)**
```json
{
  "id": "uuid",
  "email": "operador@empresa.com",
  "user_metadata": {
    "name": "Juan Pérez",
    "role": "operador",
    "permissions": []
  }
}
```

**Tabla profiles**
```sql
{
  "id": "uuid",
  "email": "operador@empresa.com",
  "role": "operador",
  "display_name": "Juan Pérez"
}
```

### Trigger Automático

El trigger `on_auth_user_created` se ejecuta automáticamente:
- Cuando se crea un usuario en `auth.users`
- Lee `user_metadata.role` y `user_metadata.name`
- Inserta registro en `profiles`
- Si falla, el login también fallará

**Migración:** Ver `supabase/migrations/20260429_add_operador_role.sql`

## 🐛 Solución de Problemas

### Error: "Usuario no tiene perfil configurado"

**Causa:** El perfil no se creó en la tabla `profiles`

**Solución:**
```sql
-- Crear perfil manualmente
INSERT INTO profiles (id, email, role, display_name)
SELECT 
  id, 
  email, 
  (raw_user_meta_data->>'role')::user_role,
  raw_user_meta_data->>'name'
FROM auth.users
WHERE id = 'UUID_DEL_USUARIO';
```

### Error: "role operador does not exist"

**Causa:** La migración no se aplicó

**Solución:**
```sql
-- Agregar 'operador' al enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'operador';
```

### Operador ve opciones de administrador

**Causa:** El rol en la base de datos es incorrecto

**Solución:**
```sql
-- Verificar rol
SELECT id, email, role FROM profiles WHERE email = 'operador@empresa.com';

-- Corregir rol
UPDATE profiles SET role = 'operador' WHERE email = 'operador@empresa.com';
```

## 📚 Archivos Relacionados

- `supabase/migrations/20260429_add_operador_role.sql` - Migración del rol operador
- `contexts/auth-context.tsx` - Context de autenticación con Supabase
- `app/login/page.tsx` - Página de login con manejo de roles
- `app/api/admin/employees/route.ts` - API de gestión de empleados
- `components/admin/admin-layout.tsx` - Layout con permisos por rol
- `CORRECCION_AUTH_OPERADORES.md` - Guía detallada de implementación
