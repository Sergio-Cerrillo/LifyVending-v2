-- =====================================================
-- AGREGAR COLUMNAS DE RECAUDACIÓN A MACHINES
-- =====================================================

-- Agregar columnas para guardar la última recaudación de cada periodo
-- Esto evita tener que crear snapshots constantes

-- RECAUDACIÓN DIARIA
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS daily_total NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_card NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_cash NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_updated_at TIMESTAMPTZ;

-- RECAUDACIÓN SEMANAL
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS weekly_total NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_card NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_cash NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_updated_at TIMESTAMPTZ;

-- RECAUDACIÓN MENSUAL
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS monthly_total NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_card NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_cash NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_updated_at TIMESTAMPTZ;

-- Comentarios explicativos
COMMENT ON COLUMN machines.daily_total IS 'Recaudación total del día actual (actualizada cada hora por scraping)';
COMMENT ON COLUMN machines.weekly_total IS 'Recaudación total de la semana actual (actualizada cada hora por scraping)';
COMMENT ON COLUMN machines.monthly_total IS 'Recaudación total del mes actual (actualizada cada hora por scraping)';

COMMENT ON COLUMN machines.daily_updated_at IS 'Última actualización de datos diarios';
COMMENT ON COLUMN machines.weekly_updated_at IS 'Última actualización de datos semanales';
COMMENT ON COLUMN machines.monthly_updated_at IS 'Última actualización de datos mensuales';
