-- =====================================================
-- SCRIPT: Identificar y limpiar clientes duplicados
-- =====================================================
-- Este script ayuda a identificar usuarios que se crearon
-- en auth.users pero tienen problemas con el perfil

-- =====================================================
-- PASO 0: Diagnóstico Completo (Ejecutar PRIMERO)
-- =====================================================

-- Ver usuarios sin perfil CON su rol esperado del metadata
SELECT 
  au.id,
  au.email,
  au.created_at,
  COALESCE(au.raw_user_meta_data->>'role', 'sin metadata') as rol_esperado,
  COALESCE(au.raw_user_meta_data->>'name', 'sin nombre') as nombre_esperado,
  'SIN PERFIL' as estado
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ORDER BY au.created_at DESC;

-- =====================================================
-- PASO 1: Identificar usuarios sin perfil (versión simple)
-- =====================================================

-- Ver todos los usuarios de auth que NO tienen perfil
SELECT 
  au.id,
  au.email,
  au.created_at,
  'SIN PERFIL' as estado
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ORDER BY au.created_at DESC;

-- =====================================================
-- PASO 2: Verificar perfiles existentes de clientes
-- =====================================================

-- Ver todos los clientes que SÍ tienen perfil
SELECT 
  p.id,
  p.email,
  p.role,
  p.display_name,
  p.company_name,
  p.created_at,
  (SELECT COUNT(*) FROM client_machine_assignments WHERE client_id = p.id) as num_maquinas,
  cs.commission_hide_percent,
  cs.commission_payment_percent
FROM public.profiles p
LEFT JOIN public.client_settings cs ON cs.client_id = p.id
WHERE p.role = 'client'
ORDER BY p.created_at DESC;

-- =====================================================
-- PASO 3: Crear perfiles faltantes manualmente
-- =====================================================
-- SOLO EJECUTAR DESPUÉS DE REVISAR LOS RESULTADOS DEL PASO 1

-- Esta query crea perfiles para usuarios que no los tienen
-- IMPORTANTE: Usa raw_user_meta_data para determinar el rol correcto
INSERT INTO public.profiles (id, email, role, display_name)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::user_role, 'client'::user_role),
  COALESCE(au.raw_user_meta_data->>'name', au.email)
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
  -- AND au.email LIKE '%@ejemplo.com%' -- Descomentar para filtrar por dominio
ON CONFLICT (id) DO NOTHING;

-- Crear settings SOLO para clientes (no para admins/operadores)
INSERT INTO public.client_settings (client_id, commission_hide_percent, commission_payment_percent)
SELECT 
  p.id,
  0,
  0
FROM public.profiles p
LEFT JOIN public.client_settings cs ON cs.client_id = p.id
WHERE p.role = 'client' AND cs.id IS NULL
ON CONFLICT (client_id) DO NOTHING;

-- =====================================================
-- PASO 4: Eliminar usuarios duplicados (CUIDADO)
-- =====================================================
-- SOLO usar si estás seguro de que quieres eliminar usuarios

-- Ver usuarios duplicados por email
SELECT 
  email,
  COUNT(*) as cantidad,
  array_agg(id) as user_ids,
  array_agg(created_at) as fechas_creacion
FROM auth.users
GROUP BY email
HAVING COUNT(*) > 1;

-- Eliminar usuario específico (reemplaza con el UUID correcto)
-- ADVERTENCIA: Esto eliminará el usuario de Auth y por CASCADE también el perfil
-- DELETE FROM auth.users WHERE id = 'uuid-del-usuario-a-eliminar';

-- =====================================================
-- PASO 5: Verificar consistencia final
-- =====================================================

-- Verificar que NO haya usuarios sin perfil
SELECT 
  COUNT(*) as usuarios_sin_perfil,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Todos tienen perfil'
    ELSE '❌ HAY USUARIOS SIN PERFIL'
  END as estado
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Verificar que todos los clientes tengan settings
SELECT 
  p.id,
  p.email,
  p.role,
  CASE 
    WHEN cs.id IS NULL THEN '❌ SIN SETTINGS'
    ELSE '✅ OK'
  END as estado_settings,
  cs.commission_hide_percent,
  cs.commission_payment_percent
FROM public.profiles p
LEFT JOIN public.client_settings cs ON cs.client_id = p.id
WHERE p.role = 'client'
ORDER BY p.created_at DESC;

-- Contar perfiles por rol
SELECT 
  role,
  COUNT(*) as cantidad
FROM public.profiles
GROUP BY role
ORDER BY role;

-- Verificar trigger está activo
SELECT 
  trigger_name,
  event_object_table,
  action_statement,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Debería mostrar:
-- trigger_name: on_auth_user_created
-- event_object_table: users
-- action_timing: AFTER
-- event_manipulation: INSERT

-- =====================================================
-- RESUMEN DE USO
-- =====================================================
-- 1. Ejecuta PASO 0 para diagnóstico completo (VER ROL ESPERADO)
-- 2. Ejecuta PASO 1 para ver usuarios sin perfil (versión simple)
-- 3. Ejecuta PASO 2 para ver clientes con perfil existentes
-- 4. Si hay usuarios sin perfil, ejecuta PASO 3 para crearlos
--    IMPORTANTE: PASO 3 ahora respeta el rol del user_metadata
-- 5. Ejecuta PASO 5 para verificar consistencia completa
-- 6. PASO 4 solo si necesitas eliminar duplicados (¡CUIDADO!)

-- =====================================================
-- ERRORES COMUNES Y SOLUCIONES
-- =====================================================

-- ERROR: "permission denied for table auth.users"
-- SOLUCIÓN: Ejecuta estas queries con el service_role key, no con anon key
-- En Supabase Dashboard: SQL Editor → usa el botón "RLS disabled" mode

-- ERROR: "type 'user_role' does not exist"
-- SOLUCIÓN: El enum no está creado. Ejecuta:
-- CREATE TYPE user_role AS ENUM ('admin', 'client', 'operador');

-- ERROR: "duplicate key value violates unique constraint"
-- SOLUCIÓN: El perfil ya existe. Ejecuta PASO 0 para verificar el estado

-- ERROR: Perfiles se crean pero con rol incorrecto
-- SOLUCIÓN: Usa PASO 0 para ver el rol esperado en user_metadata
-- Si no hay metadata, el usuario se creó sin el helper createNewClient
