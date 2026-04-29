-- =====================================================
-- DIAGNÓSTICO DE MÁQUINAS DUPLICADAS
-- =====================================================
-- Ejecuta estas queries para identificar duplicados
-- ANTES de ejecutar CLEAN_MACHINES_AND_RESET.sql
-- =====================================================

-- 1. Ver todas las máquinas duplicadas por nombre y plataforma
SELECT 
  name,
  platform,
  COUNT(*) as count,
  STRING_AGG(id::TEXT, ', ') as machine_ids
FROM machines 
GROUP BY name, platform 
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 2. Ver duplicados solo de Frekuent
SELECT 
  name,
  frekuent_machine_id,
  COUNT(*) as count,
  STRING_AGG(id::TEXT, ', ') as machine_ids,
  STRING_AGG(created_at::TEXT, ', ') as created_dates
FROM machines 
WHERE platform = 'frekuent'
GROUP BY name, frekuent_machine_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 3. Ver duplicados solo de Televend
SELECT 
  name,
  televend_machine_id,
  COUNT(*) as count,
  STRING_AGG(id::TEXT, ', ') as machine_ids,
  STRING_AGG(created_at::TEXT, ', ') as created_dates
FROM machines 
WHERE platform = 'televend'
GROUP BY name, televend_machine_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 4. Ver el total de máquinas por plataforma
SELECT 
  platform,
  COUNT(*) as total_machines
FROM machines
GROUP BY platform
ORDER BY platform;

-- 5. Ver máquinas con datos incompletos (posibles errores)
SELECT 
  id,
  name,
  platform,
  location,
  frekuent_machine_id,
  televend_machine_id,
  created_at
FROM machines
WHERE 
  (platform = 'frekuent' AND frekuent_machine_id IS NULL)
  OR
  (platform = 'televend' AND televend_machine_id IS NULL)
ORDER BY created_at DESC;

-- 6. Ver últimas máquinas creadas (para verificar scraping reciente)
SELECT 
  id,
  name,
  platform,
  location,
  created_at,
  updated_at
FROM machines
ORDER BY created_at DESC
LIMIT 20;

-- 7. BORRADO SELECTIVO: Mantener solo la más reciente de cada duplicado
-- (NO EJECUTAR SIN REVISAR PRIMERO)
/*
WITH ranked_machines AS (
  SELECT 
    id,
    name,
    platform,
    ROW_NUMBER() OVER (
      PARTITION BY name, platform 
      ORDER BY created_at DESC
    ) as rn
  FROM machines
)
DELETE FROM machines
WHERE id IN (
  SELECT id 
  FROM ranked_machines 
  WHERE rn > 1
);
*/
