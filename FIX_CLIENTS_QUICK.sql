-- =====================================================
-- SCRIPT RÁPIDO: Reparar Clientes Sin Perfil
-- =====================================================
-- Copia y pega estas queries EN ORDEN en Supabase SQL Editor
-- IMPORTANTE: Usa el modo "RLS disabled" (service_role)

-- =====================================================
-- PASO 1: ¿Cuántos usuarios sin perfil hay?
-- =====================================================
SELECT COUNT(*) as usuarios_sin_perfil FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Si el resultado es > 0, continúa con el siguiente paso


-- =====================================================
-- PASO 2: Ver detalles de usuarios sin perfil
-- =====================================================
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'NO TIENE') as rol_metadata,
  COALESCE(au.raw_user_meta_data->>'name', au.email) as nombre_metadata
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Revisa la columna "rol_metadata":
-- - Si dice 'client', 'admin', 'operador' → El usuario se creó correctamente
-- - Si dice 'NO TIENE' → El usuario se creó sin metadata (problema)


-- =====================================================
-- PASO 3: Crear perfiles faltantes
-- =====================================================
-- Esta query respeta el rol del user_metadata
INSERT INTO public.profiles (id, email, role, display_name)
SELECT 
  au.id,
  au.email,
  COALESCE((au.raw_user_meta_data->>'role')::user_role, 'client'::user_role),
  COALESCE(au.raw_user_meta_data->>'name', au.email)
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Resultado esperado: "INSERT 0 X" donde X es el número de perfiles creados


-- =====================================================
-- PASO 4: Crear settings para clientes
-- =====================================================
-- Solo crea settings para usuarios con rol 'client'
INSERT INTO public.client_settings (client_id, commission_hide_percent, commission_payment_percent)
SELECT 
  p.id,
  0,
  0
FROM public.profiles p
LEFT JOIN public.client_settings cs ON cs.client_id = p.id
WHERE p.role = 'client' AND cs.id IS NULL
ON CONFLICT (client_id) DO NOTHING;

-- Resultado esperado: "INSERT 0 X" donde X es el número de settings creados


-- =====================================================
-- PASO 5: Verificar que todo está OK
-- =====================================================

-- 5.1 - Verificar que NO hay usuarios sin perfil
SELECT COUNT(*) as usuarios_sin_perfil FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;
-- Resultado esperado: 0

-- 5.2 - Verificar que todos los clientes tienen settings
SELECT 
  p.email,
  CASE 
    WHEN cs.id IS NULL THEN '❌ SIN SETTINGS'
    ELSE '✅ OK'
  END as estado,
  cs.commission_hide_percent,
  cs.commission_payment_percent
FROM public.profiles p
LEFT JOIN public.client_settings cs ON cs.client_id = p.id
WHERE p.role = 'client';
-- Todos deberían mostrar "✅ OK"

-- 5.3 - Ver resumen por rol
SELECT 
  role,
  COUNT(*) as cantidad
FROM public.profiles
GROUP BY role;


-- =====================================================
-- SOLUCIÓN DE PROBLEMAS
-- =====================================================

-- ERROR: "permission denied for table auth.users"
-- CAUSA: Estás usando el anon key en lugar del service role
-- SOLUCIÓN: En Supabase SQL Editor, activa el modo "RLS disabled"

-- ERROR: "type 'user_role' does not exist"
-- CAUSA: El enum no está creado en la base de datos
-- SOLUCIÓN: Ejecuta la migración 20260429_add_operador_role.sql

-- ERROR: Los perfiles se crean pero no aparecen en la lista
-- CAUSA: Problema de cache o la query GET no usa supabaseAdmin
-- SOLUCIÓN: Recarga la página del admin o verifica la API

-- ERROR: "duplicate key value violates unique constraint"
-- CAUSA: El perfil ya existe
-- SOLUCIÓN: No es un error real, significa que ya se había creado antes
