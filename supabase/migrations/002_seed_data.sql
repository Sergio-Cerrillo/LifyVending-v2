-- =====================================================
-- SEED DATA PARA DESARROLLO Y TESTING
-- =====================================================
-- Este archivo está intencionalmente vacío.
--
-- FLUJO DEL SISTEMA:
-- 
-- 1. USUARIOS:
--    - Se crean manualmente desde la interfaz de administración
--    - Admin crea clientes y les asigna contraseñas
--
-- 2. MÁQUINAS:
--    - Se crean AUTOMÁTICAMENTE por el scraper
--    - Cuando el scraper (cron cada hora) encuentra una máquina nueva,
--      la crea en la base de datos
--    - Si ya existe, solo actualiza los datos de recaudación
--
-- 3. ASIGNACIÓN DE MÁQUINAS:
--    - Admin accede a /admin/clients/[id] (configurar cliente)
--    - Asigna máquinas que YA EXISTEN en la base de datos
--    - El cliente solo ve las máquinas que se le asignaron
--
-- NO SE REQUIERE SEED DATA.
-- =====================================================

-- Este script se mantiene para compatibilidad con el orden de migraciones,
-- pero no inserta ningún dato.

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'SEED DATA: No se inserta ningún dato';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Las máquinas se crearán automáticamente al ejecutar el scraping';
    RAISE NOTICE 'Los usuarios se crean desde la interfaz de administración';
    RAISE NOTICE '==============================================';
END $$;
