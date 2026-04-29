-- Tabla para histórico de comisiones mensuales
CREATE TABLE IF NOT EXISTS commission_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,  -- Mes (1-12)
  year INTEGER NOT NULL,   -- Año (2024, 2025, etc.)
  
  -- Datos de recaudación
  total_revenue DECIMAL(10, 2) NOT NULL DEFAULT 0,
  commission_percent DECIMAL(5, 2) NOT NULL,  -- Porcentaje de comisión oculta
  commission_amount DECIMAL(10, 2) NOT NULL,  -- Monto de comisión calculado
  
  -- Desglose por tipo de pago
  card_revenue DECIMAL(10, 2) DEFAULT 0,
  cash_revenue DECIMAL(10, 2) DEFAULT 0,
  
  -- Metadatos
  machines_count INTEGER NOT NULL DEFAULT 0,  -- Número de máquinas asignadas ese mes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Índices para búsqueda rápida
  CONSTRAINT unique_client_month_year UNIQUE (client_id, month, year)
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_commission_snapshots_client_id ON commission_snapshots(client_id);
CREATE INDEX IF NOT EXISTS idx_commission_snapshots_year_month ON commission_snapshots(year, month);
CREATE INDEX IF NOT EXISTS idx_commission_snapshots_created_at ON commission_snapshots(created_at);

-- Comentarios para documentación
COMMENT ON TABLE commission_snapshots IS 'Histórico mensual de comisiones por cliente';
COMMENT ON COLUMN commission_snapshots.commission_percent IS 'Porcentaje de comisión oculta que se aplica';
COMMENT ON COLUMN commission_snapshots.commission_amount IS 'Monto calculado: total_revenue * (commission_percent / 100)';

-- RLS (Row Level Security)
ALTER TABLE commission_snapshots ENABLE ROW LEVEL SECURITY;

-- Política: Los admins pueden ver todo
CREATE POLICY "Admins can view all commission snapshots" ON commission_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Los clientes solo pueden ver sus propios snapshots
CREATE POLICY "Clients can view own commission snapshots" ON commission_snapshots
  FOR SELECT
  USING (client_id = auth.uid());

-- Política: Solo admins pueden insertar
CREATE POLICY "Admins can insert commission snapshots" ON commission_snapshots
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Política: Solo admins pueden actualizar
CREATE POLICY "Admins can update commission snapshots" ON commission_snapshots
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
