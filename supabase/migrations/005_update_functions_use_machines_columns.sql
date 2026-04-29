-- =====================================================
-- ACTUALIZAR FUNCIONES SQL: Leer de machines en lugar de snapshots
-- =====================================================

-- Esta migración actualiza las funciones SQL para que lean los datos de recaudación
-- directamente de las columnas en la tabla machines, evitando el uso de snapshots

-- =====================================================
-- FUNCIÓN: get_client_net_revenue (VERSION ACTUALIZADA)
-- =====================================================

CREATE OR REPLACE FUNCTION get_client_net_revenue(
    p_client_id UUID,
    p_period revenue_period,
    p_machine_id UUID DEFAULT NULL
)
RETURNS TABLE (
    machine_id UUID,
    machine_name TEXT,
    location TEXT,
    period revenue_period,
    amount_net NUMERIC,
    scraped_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id AS machine_id,
        m.name AS machine_name,
        m.location,
        p_period AS period,
        CASE p_period
            WHEN 'daily' THEN ROUND(COALESCE(m.daily_total, 0) * (1 - COALESCE(cs.commission_hide_percent, 0) / 100.0), 2)
            WHEN 'weekly' THEN ROUND(COALESCE(m.weekly_total, 0) * (1 - COALESCE(cs.commission_hide_percent, 0) / 100.0), 2)
            WHEN 'monthly' THEN ROUND(COALESCE(m.monthly_total, 0) * (1 - COALESCE(cs.commission_hide_percent, 0) / 100.0), 2)
        END AS amount_net,
        CASE p_period
            WHEN 'daily' THEN m.daily_updated_at
            WHEN 'weekly' THEN m.weekly_updated_at
            WHEN 'monthly' THEN m.monthly_updated_at
        END AS scraped_at
    FROM machines m
    JOIN client_machine_assignments cma ON cma.machine_id = m.id
    LEFT JOIN client_settings cs ON cs.client_id = cma.client_id
    WHERE cma.client_id = p_client_id
      AND (p_machine_id IS NULL OR m.id = p_machine_id)
    ORDER BY m.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCIÓN: get_admin_client_overview (VERSION ACTUALIZADA)
-- =====================================================

CREATE OR REPLACE FUNCTION get_admin_client_overview(
    p_client_id UUID
)
RETURNS TABLE (
    period revenue_period,
    total_gross NUMERIC,
    total_net NUMERIC,
    commission_percent NUMERIC,
    machine_count INTEGER,
    last_update TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    -- Recaudación DIARIA
    SELECT 
        'daily'::revenue_period AS period,
        ROUND(SUM(COALESCE(m.daily_total, 0)), 2) AS total_gross,
        ROUND(SUM(COALESCE(m.daily_total, 0) * (1 - COALESCE(cs.commission_hide_percent, 0) / 100.0)), 2) AS total_net,
        COALESCE(cs.commission_hide_percent, 0) AS commission_percent,
        COUNT(DISTINCT m.id)::INTEGER AS machine_count,
        MAX(m.daily_updated_at) AS last_update
    FROM machines m
    JOIN client_machine_assignments cma ON cma.machine_id = m.id
    LEFT JOIN client_settings cs ON cs.client_id = p_client_id
    WHERE cma.client_id = p_client_id
    GROUP BY cs.commission_hide_percent
    
    UNION ALL
    
    -- Recaudación SEMANAL
    SELECT 
        'weekly'::revenue_period AS period,
        ROUND(SUM(COALESCE(m.weekly_total, 0)), 2) AS total_gross,
        ROUND(SUM(COALESCE(m.weekly_total, 0) * (1 - COALESCE(cs.commission_hide_percent, 0) / 100.0)), 2) AS total_net,
        COALESCE(cs.commission_hide_percent, 0) AS commission_percent,
        COUNT(DISTINCT m.id)::INTEGER AS machine_count,
        MAX(m.weekly_updated_at) AS last_update
    FROM machines m
    JOIN client_machine_assignments cma ON cma.machine_id = m.id
    LEFT JOIN client_settings cs ON cs.client_id = p_client_id
    WHERE cma.client_id = p_client_id
    GROUP BY cs.commission_hide_percent
    
    UNION ALL
    
    -- Recaudación MENSUAL
    SELECT 
        'monthly'::revenue_period AS period,
        ROUND(SUM(COALESCE(m.monthly_total, 0)), 2) AS total_gross,
        ROUND(SUM(COALESCE(m.monthly_total, 0) * (1 - COALESCE(cs.commission_hide_percent, 0) / 100.0)), 2) AS total_net,
        COALESCE(cs.commission_hide_percent, 0) AS commission_percent,
        COUNT(DISTINCT m.id)::INTEGER AS machine_count,
        MAX(m.monthly_updated_at) AS last_update
    FROM machines m
    JOIN client_machine_assignments cma ON cma.machine_id = m.id
    LEFT JOIN client_settings cs ON cs.client_id = p_client_id
    WHERE cma.client_id = p_client_id
    GROUP BY cs.commission_hide_percent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMENTARIOS
-- =====================================================

COMMENT ON FUNCTION get_client_net_revenue IS 
    'Calcula recaudación NETA para cliente aplicando comisión - lee directamente de columnas en machines';

COMMENT ON FUNCTION get_admin_client_overview IS 
    'Vista global admin con bruto vs neto por periodo - lee directamente de columnas en machines';
