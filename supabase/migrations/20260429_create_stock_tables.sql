-- =====================================================
-- MIGRACIÓN: Sistema de Stock Actualizable (Sin Histórico)
-- Fecha: 2026-04-29
-- Descripción: Tablas para almacenar el stock ACTUAL de máquinas
--              Se actualiza cada 30 minutos vía CRON automático
-- =====================================================

-- =====================================================
-- TABLA: machine_stock_current
-- Stock ACTUAL por máquina (sin histórico)
-- Solo 1 registro por máquina (UNIQUE constraint)
-- =====================================================

CREATE TABLE IF NOT EXISTS machine_stock_current (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Referencia a máquina (UNIQUE = solo 1 stock por máquina)
    machine_id UUID NOT NULL UNIQUE REFERENCES machines(id) ON DELETE CASCADE,
    
    -- Info de la máquina (desnormalizado para queries rápidas)
    machine_name TEXT NOT NULL,
    machine_location TEXT,
    
    -- Timestamp del ÚLTIMO scraping exitoso
    scraped_at TIMESTAMPTZ NOT NULL,
    
    -- Estadísticas agregadas (calculadas desde productos)
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

-- Comentarios
COMMENT ON TABLE machine_stock_current IS 'Stock actual de cada máquina (sin histórico). Actualizado cada 30 min por CRON.';
COMMENT ON COLUMN machine_stock_current.machine_id IS 'ID único de máquina (UNIQUE constraint garantiza 1 registro por máquina)';
COMMENT ON COLUMN machine_stock_current.scraped_at IS 'Timestamp del último scraping exitoso de Televend';
COMMENT ON COLUMN machine_stock_current.total_to_replenish IS 'Total de unidades que necesitan reposición en esta máquina';


-- =====================================================
-- TABLA: stock_products_current
-- Productos individuales del stock ACTUAL
-- Relación 1:N con machine_stock_current
-- =====================================================

CREATE TABLE IF NOT EXISTS stock_products_current (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Referencia al stock actual de la máquina (con DELETE CASCADE)
    stock_id UUID NOT NULL REFERENCES machine_stock_current(id) ON DELETE CASCADE,
    
    -- Datos del producto
    product_name TEXT NOT NULL,
    category TEXT,
    line TEXT, -- Línea/espiral de la máquina (ej: "A1", "B3", "Canal 15")
    
    -- Cantidades
    total_capacity INTEGER NOT NULL DEFAULT 0,      -- Capacidad máxima del canal
    available_units INTEGER NOT NULL DEFAULT 0,     -- Unidades actuales disponibles
    units_to_replenish INTEGER NOT NULL DEFAULT 0,  -- Unidades que faltan para llenar
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para optimizar queries
CREATE INDEX IF NOT EXISTS idx_stock_products_current_stock ON stock_products_current(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_products_current_name ON stock_products_current(product_name);
CREATE INDEX IF NOT EXISTS idx_stock_products_current_to_replenish ON stock_products_current(units_to_replenish) WHERE units_to_replenish > 0;
CREATE INDEX IF NOT EXISTS idx_stock_products_current_category ON stock_products_current(category) WHERE category IS NOT NULL;

-- Comentarios
COMMENT ON TABLE stock_products_current IS 'Productos individuales del stock actual de cada máquina';
COMMENT ON COLUMN stock_products_current.line IS 'Canal/espiral de la máquina (ej: A1, B3, Canal 15)';
COMMENT ON COLUMN stock_products_current.units_to_replenish IS 'Calculado como: total_capacity - available_units';


-- =====================================================
-- TRIGGER: Actualizar updated_at automáticamente
-- =====================================================

CREATE TRIGGER update_stock_current_updated_at 
BEFORE UPDATE ON machine_stock_current
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en ambas tablas
ALTER TABLE machine_stock_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_products_current ENABLE ROW LEVEL SECURITY;

-- Policy: Admins y Operadores pueden ver todo el stock
CREATE POLICY "Admins y operadores pueden ver stock"
    ON machine_stock_current
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'operador')
        )
    );

CREATE POLICY "Admins y operadores pueden ver productos"
    ON stock_products_current
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'operador')
        )
    );

-- Policy: Clientes solo ven stock de sus máquinas asignadas
CREATE POLICY "Clientes ven stock de sus máquinas"
    ON machine_stock_current
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            JOIN client_machine_assignments ON client_machine_assignments.client_id = profiles.id
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'client'
            AND client_machine_assignments.machine_id = machine_stock_current.machine_id
        )
    );

CREATE POLICY "Clientes ven productos de sus máquinas"
    ON stock_products_current
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM machine_stock_current msc
            JOIN profiles p ON p.id = auth.uid()
            JOIN client_machine_assignments cma ON cma.client_id = p.id
            WHERE msc.id = stock_products_current.stock_id
            AND p.role = 'client'
            AND cma.machine_id = msc.machine_id
        )
    );


-- =====================================================
-- FUNCIÓN AUXILIAR: Obtener estadísticas de stock
-- =====================================================

CREATE OR REPLACE FUNCTION get_stock_statistics()
RETURNS TABLE (
    total_machines BIGINT,
    machines_needing_replenishment BIGINT,
    total_products BIGINT,
    total_units_to_replenish BIGINT,
    last_scrape TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT msc.machine_id)::BIGINT as total_machines,
        COUNT(DISTINCT CASE WHEN msc.total_to_replenish > 0 THEN msc.machine_id END)::BIGINT as machines_needing_replenishment,
        COALESCE(SUM(msc.total_products), 0)::BIGINT as total_products,
        COALESCE(SUM(msc.total_to_replenish), 0)::BIGINT as total_units_to_replenish,
        MAX(msc.scraped_at) as last_scrape
    FROM machine_stock_current msc
    JOIN machines m ON m.id = msc.machine_id
    WHERE m.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- ÍNDICES ADICIONALES PARA QUERIES COMUNES
-- =====================================================

-- Query: "Productos que necesitan reposición agregados por nombre"
CREATE INDEX IF NOT EXISTS idx_stock_products_for_aggregation 
ON stock_products_current(product_name, category, units_to_replenish)
WHERE units_to_replenish > 0;

-- Query: "Stock de máquinas activas (no eliminadas)"
CREATE INDEX IF NOT EXISTS idx_stock_with_active_machines
ON machine_stock_current(machine_id, scraped_at DESC)
INCLUDE (total_to_replenish);


-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

DO $$
BEGIN
    -- Verificar que las tablas se crearon correctamente
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'machine_stock_current') THEN
        RAISE EXCEPTION 'Error: Tabla machine_stock_current no se creó correctamente';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_products_current') THEN
        RAISE EXCEPTION 'Error: Tabla stock_products_current no se creó correctamente';
    END IF;
    
    RAISE NOTICE '✅ Migración completada exitosamente';
    RAISE NOTICE '✅ Tablas creadas: machine_stock_current, stock_products_current';
    RAISE NOTICE '✅ Índices creados: 8 índices para optimización de queries';
    RAISE NOTICE '✅ RLS habilitado: Políticas para admin, operador, y cliente';
    RAISE NOTICE '✅ Función auxiliar: get_stock_statistics() disponible';
    RAISE NOTICE '';
    RAISE NOTICE 'ℹ️  Siguiente paso: Ejecutar primer scraping de stock con /api/cron/scrape-stock';
END $$;
