-- =====================================================
-- SCRIPT DE LIMPIEZA COMPLETA DE MÁQUINAS
-- =====================================================
-- 
-- Este script elimina TODAS las máquinas y datos relacionados
-- para poder volver a hacer el scraping desde cero
-- y evitar duplicados
--
-- IMPORTANTE: Ejecutar ANTES de volver a lanzar el scraping
-- =====================================================

BEGIN;

-- 1. Eliminar todos los machine_revenues (recaudaciones)
DELETE FROM machine_revenues;
COMMENT ON TABLE machine_revenues IS 'LIMPIADAS - Recaudaciones eliminadas';

-- 2. Eliminar todos los products_inventory (stock de productos)
DELETE FROM products_inventory;
COMMENT ON TABLE products_inventory IS 'LIMPIADOS - Inventario de productos eliminado';

-- 3. Eliminar todas las machines (máquinas)
DELETE FROM machines;
COMMENT ON TABLE machines IS 'LIMPIADAS - Todas las máquinas eliminadas';

-- 4. Resetear las secuencias (opcional, si usas SERIAL/BIGSERIAL)
-- Esto hace que los nuevos IDs empiecen desde 1 de nuevo
ALTER SEQUENCE IF EXISTS machines_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS products_inventory_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS machine_revenues_id_seq RESTART WITH 1;

-- 5. Verificar que todo está limpio
DO $$
DECLARE
  machines_count INTEGER;
  products_count INTEGER;
  revenues_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO machines_count FROM machines;
  SELECT COUNT(*) INTO products_count FROM products_inventory;
  SELECT COUNT(*) INTO revenues_count FROM machine_revenues;
  
  RAISE NOTICE '✅ Limpieza completada:';
  RAISE NOTICE '   - Máquinas: % (debería ser 0)', machines_count;
  RAISE NOTICE '   - Productos: % (debería ser 0)', products_count;
  RAISE NOTICE '   - Recaudaciones: % (debería ser 0)', revenues_count;
  
  IF machines_count = 0 AND products_count = 0 AND revenues_count = 0 THEN
    RAISE NOTICE '🎉 Base de datos limpia. Lista para nuevo scraping.';
  ELSE
    RAISE WARNING '⚠️ Aún quedan datos. Revisa manualmente.';
  END IF;
END $$;

COMMIT;

-- =====================================================
-- OPCIONAL: Si quieres mantener algunas máquinas
-- =====================================================
-- En lugar de DELETE, puedes hacer un borrado selectivo:
-- 
-- DELETE FROM machines WHERE platform = 'frekuent';  -- Solo Frekuent
-- DELETE FROM machines WHERE platform = 'televend';  -- Solo Televend
-- DELETE FROM machines WHERE created_at > '2026-04-01';  -- Creadas después de fecha
-- 
-- Para ver duplicados ANTES de borrar:
-- SELECT name, platform, COUNT(*) 
-- FROM machines 
-- GROUP BY name, platform 
-- HAVING COUNT(*) > 1;
-- =====================================================
