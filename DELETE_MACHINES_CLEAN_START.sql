-- =====================================================
-- LIMPIAR TODAS LAS MÁQUINAS Y EMPEZAR DE CERO
-- =====================================================
-- Ejecutar esto en el SQL Editor de Supabase
-- para borrar todas las máquinas y sus datos relacionados
-- =====================================================

-- 1. Desactivar temporalmente el check constraint
ALTER TABLE machines DROP CONSTRAINT IF EXISTS machines_has_at_least_one_id;

-- 2. Borrar asignaciones de máquinas a clientes
DELETE FROM client_machine_assignments;

-- 3. Borrar snapshots de recaudación
DELETE FROM machine_revenue_snapshots;

-- 4. Borrar máquinas
DELETE FROM machines;

-- 5. Reactivar el check constraint
ALTER TABLE machines 
  ADD CONSTRAINT machines_has_at_least_one_id 
  CHECK (orain_machine_id IS NOT NULL OR televend_machine_id IS NOT NULL);

-- 6. Opcional: Resetear secuencias si es necesario
-- (No aplica en este caso porque usamos UUIDs)

-- =====================================================
-- Verificar que todo esté limpio
-- =====================================================
SELECT COUNT(*) as total_machines FROM machines;
SELECT COUNT(*) as total_assignments FROM client_machine_assignments;
SELECT COUNT(*) as total_snapshots FROM machine_revenue_snapshots;

-- Resultado esperado: 0 en todos
