-- =====================================================
-- AGREGAR CAMPO: commission_payment_percent
-- =====================================================

-- Agregar columna para el porcentaje de comisión informativo
-- (el que el cliente recibirá en el pago, no afecta cálculos)
ALTER TABLE client_settings 
ADD COLUMN IF NOT EXISTS commission_payment_percent NUMERIC(5,2) DEFAULT 0 
CHECK (commission_payment_percent >= 0 AND commission_payment_percent <= 100);

-- Comentario explicativo
COMMENT ON COLUMN client_settings.commission_hide_percent IS 
    'Porcentaje que se RESTA de la recaudación bruta para calcular la neta que ve el cliente (usado en cálculos)';

COMMENT ON COLUMN client_settings.commission_payment_percent IS 
    'Porcentaje de comisión que el cliente recibirá en el pago (solo informativo, NO afecta cálculos del dashboard)';
