# Corrección Sistema de Autenticación para Operadores

## 🎯 Problema Resuelto

Los operadores creados con el sistema de gestión de empleados no podían iniciar sesión porque:

1. ❌ El rol `operador` no existía en el ENUM `user_role` de la base de datos
2. ❌ Los usuarios creados en Supabase Auth no tenían registro en la tabla `profiles`
3. ❌ El login page no manejaba el rol `operador`
4. ❌ El auth context usaba mock data en lugar de Supabase Auth real

## ✅ Soluciones Implementadas

### 1. **Migración de Base de Datos** 
📁 `supabase/migrations/20260429_add_operador_role.sql`

**Cambios:**
- ✅ Agregado `operador` al ENUM `user_role`
- ✅ Creada función trigger para crear perfil automáticamente desde `user_metadata`
- ✅ Actualizada política RLS para permitir acceso a operadores

**Qué hace el trigger:**
- Cuando se crea un usuario en Supabase Auth
- Automáticamente crea su registro en `profiles`
- Lee el rol y nombre desde `user_metadata`
- Si no especifica rol, asigna `client` por defecto

### 2. **Login Page Actualizado**
📁 `app/login/page.tsx`

**Cambios:**
- ✅ Maneja el rol `operador` correctamente
- ✅ Si no encuentra perfil, lo crea desde `user_metadata` (fallback)
- ✅ Redirige operadores a `/admin/dashboard` con permisos limitados

**Flujo mejorado:**
```
Login → Auth en Supabase → Buscar perfil
  ↓
  ├─ Perfil existe → Redirigir según rol
  └─ No existe → Crear desde user_metadata → Redirigir
```

### 3. **Auth Context Reescrito**
📁 `contexts/auth-context.tsx`

**Cambios:**
- ✅ Usa Supabase Auth real (no más mock data)
- ✅ Carga sesión automáticamente al iniciar
- ✅ Escucha cambios de autenticación (SIGNED_IN, SIGNED_OUT)
- ✅ Estado de loading para evitar parpadeos
- ✅ Cierra sesión correctamente con Supabase

**Beneficios:**
- Autenticación real con JWT tokens
- Sesión persistente entre recargas
- Sincronización automática entre tabs
- Logout completo con limpieza de sesión

### 4. **Admin Layout Mejorado**
📁 `components/admin/admin-layout.tsx`

**Cambios:**
- ✅ Muestra loader mientras carga la sesión
- ✅ Solo muestra "Acceso denegado" después de cargar
- ✅ Permisos por rol funcionan correctamente

## 🚀 Cómo Aplicar los Cambios

### Paso 1: Aplicar Migración en Supabase

Tienes dos opciones:

#### Opción A: Desde el Dashboard de Supabase (Recomendado)

1. Ve a tu proyecto en [supabase.com](https://supabase.com/dashboard)
2. Ve a **SQL Editor**
3. Copia y pega el contenido de `supabase/migrations/20260429_add_operador_role.sql`
4. Ejecuta la query
5. Verifica que no haya errores

#### Opción B: Desde CLI (si tienes Supabase CLI)

```bash
cd /Users/sergiocerrillo/Desktop/www-Proyectos/NewLifyVending
supabase db push
```

### Paso 2: Verificar que la Migración Funcionó

Ejecuta esta query en SQL Editor:

```sql
-- Verificar que 'operador' está en el enum
SELECT enum_range(NULL::user_role);

-- Debería mostrar: {admin,client,operador}
```

```sql
-- Verificar que el trigger existe
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Debería mostrar: on_auth_user_created | users
```

### Paso 3: Deployar Cambios de Código

Los cambios ya están en tu código local. Solo necesitas:

```bash
# Si usas Vercel
vercel --prod

# O tu método de deployment habitual
```

### Paso 4: Probar el Sistema

1. **Crear un operador:**
   - Login como admin
   - Ve a "Gestión de Empleados"
   - Crea un usuario con rol "Operador"

2. **Login como operador:**
   - Cierra sesión
   - Inicia sesión con el email y contraseña del operador
   - Deberías ver solo Dashboard y Stock en el menú
   - No deberías ver el mensaje "no tiene perfil configurado"

3. **Verificar permisos:**
   - Como operador, intenta acceder a `/admin/clients-management`
   - No deberías poder ver esa opción en el menú
   - Stock debería funcionar correctamente

## 🔍 Para Usuarios Existentes

Si ya creaste operadores antes de aplicar estos cambios:

### Crear perfiles manualmente:

```sql
-- Obtener IDs de usuarios sin perfil
SELECT id, email, raw_user_meta_data->>'name' as name, raw_user_meta_data->>'role' as role
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);

-- Crear perfiles para esos usuarios
INSERT INTO profiles (id, email, role, display_name)
SELECT 
  id, 
  email, 
  COALESCE((raw_user_meta_data->>'role')::user_role, 'operador'),
  COALESCE(raw_user_meta_data->>'name', email)
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);
```

## 📋 Resumen de Cambios por Archivo

| Archivo | Cambios |
|---------|---------|
| `supabase/migrations/20260429_add_operador_role.sql` | **NUEVO** - Migración para agregar rol operador y trigger |
| `contexts/auth-context.tsx` | **REESCRITO** - Usa Supabase Auth real, carga sesión, escucha cambios |
| `app/login/page.tsx` | Maneja rol operador, crea perfil desde user_metadata si falta |
| `components/admin/admin-layout.tsx` | Agrega estado de loading, muestra loader mientras carga sesión |
| `EMPLEADOS_SISTEMA.md` | Actualizado con información sobre perfiles automáticos |

## ⚠️ Notas Importantes

1. **El trigger solo funciona para usuarios NUEVOS**
   - Usuarios creados después de aplicar la migración: ✅ Automático
   - Usuarios creados antes: ⚠️ Necesitan perfil manual (ver script arriba)

2. **Sesión actual se cerrará**
   - Al deployar, los usuarios deberán volver a iniciar sesión
   - Esto es normal cuando cambiamos el sistema de autenticación

3. **Mock data ya no se usa**
   - El archivo `lib/mock-data.ts` ya no afecta la autenticación
   - Todos los usuarios vienen de Supabase Auth ahora

4. **Testing importante**
   - Prueba login como admin ✓
   - Prueba crear operador ✓
   - Prueba login como operador ✓
   - Verifica permisos de menú ✓

## 🎉 Beneficios

- ✅ Sistema de autenticación real y seguro
- ✅ Operadores pueden acceder sin errores
- ✅ Perfiles se crean automáticamente
- ✅ Permisos por rol funcionan correctamente
- ✅ No más "usuario no tiene perfil configurado"
- ✅ Sesión persistente entre recargas
- ✅ Autenticación sincronizada entre tabs

## 🆘 Troubleshooting

### Problema: Sigue diciendo "no tiene perfil configurado"

**Solución:**
1. Verifica que la migración se aplicó correctamente
2. Ejecuta el script SQL para crear perfiles manualmente
3. Borra cookies y cache del navegador
4. Intenta login nuevamente

### Problema: "role operador does not exist"

**Solución:**
La migración no se aplicó. Ejecuta:
```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'operador';
```

### Problema: Usuarios quedan sin sesión

**Solución:**
Esto es esperado. Todos deben hacer login nuevamente después del deploy.

### Problema: Admin no puede ver opciones de administrador

**Solución:**
Verifica el rol en la base de datos:
```sql
SELECT id, email, role FROM profiles WHERE email = 'tu@email.com';
```

Si el rol es incorrecto:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'tu@email.com';
```
