-- =====================================================
-- MIGRACIÓN: Sistema de Stock sin Histórico
-- =====================================================
-- Fecha: 2026-04-30
-- Descripción: Tablas para almacenar stock actual de máquinas
-- Sin histórico: cada scraping REEMPLAZA los datos anteriores
-- =====================================================

-- =====================================================
-- TABLA: machine_stock_current
-- Stock ACTUAL por máquina (sin histórico)
-- =====================================================

CREATE TABLE IF NOT EXISTS machine_stock_current (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Solo 1 registro por máquina (UNIQUE constraint)
    machine_id UUID NOT NULL UNIQUE REFERENCES machines(id) ON DELETE CASCADE,
    
    -- Info de la máquina (para queries rápidas sin JOIN)
    machine_name TEXT NOT NULL,
    machine_location TEXT,
    
    -- Timestamp del ÚLTIMO scraping
    scraped_at TIMESTAMPTZ NOT NULL,
    
    -- Estadísticas agregadas (para queries rápidas)
    total_products INTEGER NOT NULL DEFAULT 0,
    total_capacity INTEGER NOT NULL DEFAULT 0,
    total_available INTEGER NOT NULL DEFAULT 0,
    total_to_replenish INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para optimizar queries
CREATE INDEX IF NOT EXISTS idx_stock_current_machine ON machine_stock_current(machine_id);
CREATE INDEX IF NOT EXISTS idx_stock_current_to_replenish ON machine_stock_current(total_to_replenish) WHERE total_to_replenish > 0;
CREATE INDEX IF NOT EXISTS idx_stock_current_scraped_at ON machine_stock_current(scraped_at DESC);

-- Trigger para updated_at
CREATE TRIGGER update_stock_current_updated_at 
BEFORE UPDATE ON machine_stock_current
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: stock_products_current
-- Productos del stock ACTUAL (sin histórico)
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_products_current (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Referencia al stock actual (con DELETE CASCADE)
    stock_id UUID NOT NULL REFERENCES machine_stock_current(id) ON DELETE CASCADE,
    
    -- Datos del producto
    product_name TEXT NOT NULL,
    category TEXT,
    line TEXT, -- Línea/espiral de la máquina (ej: "A1", "B3")
    
    -- Cantidades
    total_capacity INTEGER NOT NULL DEFAULT 0,
    available_units INTEGER NOT NULL DEFAULT 0,
    units_to_replenish INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stock_products_current_stock ON stock_products_current(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_products_current_name ON stock_products_current(product_name);
CREATE INDEX IF NOT EXISTS idx_stock_products_current_to_replenish ON stock_products_current(units_to_replenish) WHERE units_to_replenish > 0;
CREATE INDEX IF NOT EXISTS idx_stock_products_current_category ON stock_products_current(category) WHERE category IS NOT NULL;

-- =====================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON TABLE machine_stock_current IS 'Stock actual de cada máquina. Solo existe 1 registro por máquina, se actualiza en cada scraping.';
COMMENT ON COLUMN machine_stock_current.machine_id IS 'ID de la máquina (UNIQUE). Solo puede haber 1 snapshot por máquina.';
COMMENT ON COLUMN machine_stock_current.scraped_at IS 'Timestamp del último scraping exitoso';
COMMENT ON COLUMN machine_stock_current.total_to_replenish IS 'Total de unidades que faltan en la máquina (calculado)';

COMMENT ON TABLE stock_products_current IS 'Detalle de productos en cada máquina. Se borran y recrean en cada scraping.';
COMMENT ON COLUMN stock_products_current.stock_id IS 'Referencia al stock de la máquina (CASCADE delete)';
COMMENT ON COLUMN stock_products_current.line IS 'Línea o espiral donde está el producto (ej: A1, B3, Col 5)';
COMMENT ON COLUMN stock_products_current.units_to_replenish IS 'Unidades que faltan = total_capacity - available_units';
