-- =====================================================
-- Migration: Add Televend support
-- Adds televend_machine_id to machines table
-- =====================================================

-- Add televend_machine_id column to machines table
ALTER TABLE machines 
  ADD COLUMN IF NOT EXISTS televend_machine_id TEXT;

-- Create unique index for televend_machine_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_machines_televend_id 
  ON machines(televend_machine_id) 
  WHERE televend_machine_id IS NOT NULL;

-- Add check constraint to ensure at least one ID is present
ALTER TABLE machines 
  ADD CONSTRAINT machines_has_at_least_one_id 
  CHECK (orain_machine_id IS NOT NULL OR televend_machine_id IS NOT NULL);

-- Comment explaining the change
COMMENT ON COLUMN machines.televend_machine_id IS 'ID único de la máquina en el sistema Televend';
