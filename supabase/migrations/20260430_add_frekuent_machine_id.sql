-- Agregar columna frekuent_machine_id a la tabla machines
-- Orain se renombró a Frekuent, pero mantenemos orain_machine_id por compatibilidad

-- 1. Agregar la nueva columna
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS frekuent_machine_id TEXT;

-- 2. Copiar los datos de orain_machine_id a frekuent_machine_id (para máquinas existentes)
UPDATE machines 
SET frekuent_machine_id = orain_machine_id 
WHERE orain_machine_id IS NOT NULL AND frekuent_machine_id IS NULL;

-- 3. Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_machines_frekuent_machine_id 
ON machines(frekuent_machine_id);

-- 4. Actualizar el CHECK CONSTRAINT para incluir frekuent_machine_id
-- Primero eliminar el constraint antiguo si existe
ALTER TABLE machines 
DROP CONSTRAINT IF EXISTS machines_has_at_least_one_id;

-- Luego crear el nuevo constraint que incluye frekuent_machine_id
ALTER TABLE machines 
ADD CONSTRAINT machines_has_at_least_one_id 
CHECK (
  orain_machine_id IS NOT NULL OR 
  frekuent_machine_id IS NOT NULL OR 
  televend_machine_id IS NOT NULL
);

-- NOTA: Por compatibilidad, mantenemos orain_machine_id
-- Las nuevas inserciones deberían usar frekuent_machine_id
-- pero el sistema seguirá buscando en ambas columnas
