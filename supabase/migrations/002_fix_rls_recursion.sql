-- =====================================================
-- FIX: Eliminar políticas RLS con recursión infinita
-- =====================================================

-- Eliminar todas las políticas existentes en profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Clients can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "admin_can_view_profiles" ON profiles;
DROP POLICY IF EXISTS "employer_can_view_profiles" ON profiles;

-- Eliminar políticas problemáticas en otras tablas
DROP POLICY IF EXISTS "Admins can manage all client settings" ON client_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON client_settings;
DROP POLICY IF EXISTS "Admins can manage all machines" ON machines;
DROP POLICY IF EXISTS "Clients can view assigned machines" ON machines;
DROP POLICY IF EXISTS "Users can view assigned machines" ON machines;
DROP POLICY IF EXISTS "Admins can manage all assignments" ON client_machine_assignments;
DROP POLICY IF EXISTS "Clients can view own assignments" ON client_machine_assignments;
DROP POLICY IF EXISTS "Users can view own assignments" ON client_machine_assignments;
DROP POLICY IF EXISTS "Admins can manage all revenue snapshots" ON machine_revenue_snapshots;
DROP POLICY IF EXISTS "Clients can view revenue of assigned machines" ON machine_revenue_snapshots;
DROP POLICY IF EXISTS "Users can view revenue of assigned machines" ON machine_revenue_snapshots;
DROP POLICY IF EXISTS "Admins can view all scrape runs" ON scrape_runs;
DROP POLICY IF EXISTS "Clients can view own scrape runs" ON scrape_runs;
DROP POLICY IF EXISTS "Users can view own scrape runs" ON scrape_runs;
DROP POLICY IF EXISTS "Authenticated users can insert scrape runs" ON scrape_runs;
DROP POLICY IF EXISTS "Users can insert scrape runs" ON scrape_runs;

-- =====================================================
-- NUEVA POLÍTICA SIMPLE PARA PROFILES (SIN RECURSIÓN)
-- =====================================================

-- Todos los usuarios autenticados pueden ver y actualizar SU PROPIO perfil
-- NO verificamos el rol aquí para evitar recursión
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Service role bypasses RLS, así que los admins usarán ese rol
-- para gestionar perfiles de otros usuarios desde el backend

-- =====================================================
-- POLÍTICAS SIMPLIFICADAS PARA OTRAS TABLAS
-- =====================================================

-- client_settings: Usuario puede ver solo sus propios settings
CREATE POLICY "Users can view own settings" ON client_settings
    FOR SELECT
    TO authenticated
    USING (client_id = auth.uid());

-- machines: Usuario puede ver máquinas asignadas a él
CREATE POLICY "Users can view assigned machines" ON machines
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM client_machine_assignments
            WHERE client_id = auth.uid() AND machine_id = machines.id
        )
    );

-- client_machine_assignments: Usuario puede ver sus propias asignaciones
CREATE POLICY "Users can view own assignments" ON client_machine_assignments
    FOR SELECT
    TO authenticated
    USING (client_id = auth.uid());

-- machine_revenue_snapshots: Usuario puede ver revenue de máquinas asignadas
CREATE POLICY "Users can view revenue of assigned machines" ON machine_revenue_snapshots
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM client_machine_assignments cma
            WHERE cma.client_id = auth.uid()
            AND cma.machine_id = machine_revenue_snapshots.machine_id
        )
    );

-- scrape_runs: Usuario puede ver y crear sus propios runs
CREATE POLICY "Users can view own scrape runs" ON scrape_runs
    FOR SELECT
    TO authenticated
    USING (triggered_by_user_id = auth.uid());

CREATE POLICY "Users can insert scrape runs" ON scrape_runs
    FOR INSERT
    TO authenticated
    WITH CHECK (triggered_by_user_id = auth.uid());

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON POLICY "Users can view own profile" ON profiles IS 
    'Simplificada: usuarios pueden ver su propio perfil sin verificar rol (evita recursión)';

COMMENT ON POLICY "Users can view assigned machines" ON machines IS 
    'Usuarios ven solo máquinas asignadas a ellos. Admins usan service_role para bypass.';
