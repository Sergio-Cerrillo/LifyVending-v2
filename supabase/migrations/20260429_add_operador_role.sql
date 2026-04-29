-- =====================================================
-- PASO 1: Agregar 'operador' al enum user_role
-- =====================================================
-- IMPORTANTE: Ejecutar este bloque PRIMERO y SOLO, luego ejecutar el Paso 2

DO $$ 
BEGIN
  -- Verificar si 'operador' ya existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'operador' 
    AND enumtypid = 'user_role'::regtype
  ) THEN
    ALTER TYPE user_role ADD VALUE 'operador';
    RAISE NOTICE '✓ Rol operador agregado exitosamente';
  ELSE
    RAISE NOTICE '⚠ Rol operador ya existe, omitiendo...';
  END IF;
END $$;


-- =====================================================
-- PASO 2: Crear trigger para perfiles automáticos
-- =====================================================
-- IMPORTANTE: Ejecutar DESPUÉS del Paso 1

-- Crear función para crear perfil automáticamente desde user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client'),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
EXCEPTION 
  WHEN unique_violation THEN
    -- Si el perfil ya existe, no hacer nada
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para ejecutar la función automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Actualizar políticas RLS - SIMPLIFICADA para evitar recursión
DROP POLICY IF EXISTS "Usuarios pueden ver su propio perfil" ON profiles;

CREATE POLICY "Usuarios pueden ver su propio perfil" ON profiles
FOR SELECT
USING (auth.uid() = id);

-- Política para permitir INSERTS desde el trigger (SECURITY DEFINER lo ejecuta como owner)
-- Esta política es para operaciones UPDATE si fuera necesario
CREATE POLICY "Permitir actualizaciones propias" ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Comentarios
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 
'Crea automáticamente un perfil cuando se crea un usuario en Auth. Lee el rol y nombre del user_metadata.';

COMMENT ON FUNCTION public.handle_new_user() IS
'Función trigger que crea perfiles automáticamente al registrar usuarios en Supabase Auth';

-- Crear función RPC para crear perfil manualmente (fallback)
CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS json AS $$
DECLARE
  current_user_id uuid;
  user_email text;
  user_metadata jsonb;
  profile_role user_role;
  profile_name text;
  result json;
BEGIN
  -- Obtener ID del usuario actual
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No authenticated user');
  END IF;
  
  -- Verificar si ya tiene perfil
  IF EXISTS (SELECT 1 FROM profiles WHERE id = current_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Profile already exists');
  END IF;
  
  -- Obtener datos del usuario desde auth.users
  SELECT email, raw_user_meta_data INTO user_email, user_metadata
  FROM auth.users
  WHERE id = current_user_id;
  
  -- Extraer rol y nombre del metadata
  profile_role := COALESCE((user_metadata->>'role')::user_role, 'operador');
  profile_name := COALESCE(user_metadata->>'name', user_email);
  
  -- Insertar perfil
  INSERT INTO profiles (id, email, role, display_name)
  VALUES (current_user_id, user_email, profile_role, profile_name);
  
  -- Retornar resultado
  SELECT json_build_object(
    'success', true,
    'profile', json_build_object(
      'id', id,
      'email', email,
      'role', role,
      'display_name', display_name
    )
  ) INTO result
  FROM profiles
  WHERE id = current_user_id;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_profile_for_user() IS
'Crea un perfil para el usuario autenticado actual si no existe. Usado como fallback en el login.';


-- =====================================================
-- PASO 3 (OPCIONAL): Crear perfiles para usuarios existentes
-- =====================================================
-- Solo ejecutar si ya tienes usuarios sin perfil

-- INSERT INTO profiles (id, email, role, display_name)
-- SELECT 
--   id, 
--   email, 
--   COALESCE((raw_user_meta_data->>'role')::user_role, 'operador'),
--   COALESCE(raw_user_meta_data->>'name', email)
-- FROM auth.users
-- WHERE id NOT IN (SELECT id FROM profiles)
-- ON CONFLICT (id) DO NOTHING;
