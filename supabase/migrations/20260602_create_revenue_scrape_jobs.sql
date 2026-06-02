-- Queue persistente para scrapings manuales de recaudacion

CREATE TABLE IF NOT EXISTS revenue_scrape_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL CHECK (action IN ('frekuent_daily', 'frekuent_monthly', 'televend', 'all_queue')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'error', 'canceled')),
  phase TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  requested_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  result_json JSONB,
  lock_token TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_jobs_status_requested
  ON revenue_scrape_jobs(status, requested_at);

CREATE INDEX IF NOT EXISTS idx_revenue_jobs_requested_by
  ON revenue_scrape_jobs(requested_by_user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_jobs_created_at
  ON revenue_scrape_jobs(created_at DESC);

-- Evita duplicar exactamente la misma accion activa a la vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_revenue_jobs_action_active
  ON revenue_scrape_jobs(action)
  WHERE status IN ('queued', 'running');

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_revenue_scrape_jobs_updated_at ON revenue_scrape_jobs;
CREATE TRIGGER update_revenue_scrape_jobs_updated_at
  BEFORE UPDATE ON revenue_scrape_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE revenue_scrape_jobs ENABLE ROW LEVEL SECURITY;

-- Solo admin autenticado puede leer y crear jobs desde app
DROP POLICY IF EXISTS "Admins can read revenue scrape jobs" ON revenue_scrape_jobs;
CREATE POLICY "Admins can read revenue scrape jobs"
  ON revenue_scrape_jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert revenue scrape jobs" ON revenue_scrape_jobs;
CREATE POLICY "Admins can insert revenue scrape jobs"
  ON revenue_scrape_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Updates los hace el backend con service role
