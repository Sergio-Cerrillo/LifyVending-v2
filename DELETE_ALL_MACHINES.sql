-- =====================================================
-- SCRIPT PARA ELIMINAR TODAS LAS MÁQUINAS
-- =====================================================
-- Este script elimina todas las máquinas y sus datos relacionados
-- ADVERTENCIA: Esta acción NO se puede deshacer

-- 1. Eliminar asignaciones cliente-máquina
DELETE FROM client_machine_assignments;

-- 2. Eliminar todas las máquinas
DELETE FROM machines;

-- 3. Verificar que se eliminaron
SELECT 
  (SELECT COUNT(*) FROM machines) as maquinas_restantes,
  (SELECT COUNT(*) FROM client_machine_assignments) as asignaciones_restantes;

-- =====================================================
-- RESULTADO ESPERADO:
-- maquinas_restantes = 0
-- asignaciones_restantes = 0
-- =====================================================
