-- Campos internos para cierres mensuales generados por sistema.
-- Los clientes solo leen amount_total desde la API; estos campos son para auditoria/admin.

alter table if exists public.client_revenue_history_adjustments
  add column if not exists gross_amount_internal numeric(12,2),
  add column if not exists hidden_percent_applied numeric(5,2),
  add column if not exists payment_percent_applied numeric(5,2),
  add column if not exists commission_amount numeric(12,2),
  add column if not exists source_provider text,
  add column if not exists source_range_start timestamptz,
  add column if not exists source_range_end timestamptz,
  add column if not exists status text not null default 'published',
  add column if not exists generated_by text,
  add column if not exists generated_at timestamptz,
  add column if not exists published_at timestamptz;

create index if not exists idx_client_revenue_history_adjustments_status
  on public.client_revenue_history_adjustments (status);

create index if not exists idx_client_revenue_history_adjustments_generated_at
  on public.client_revenue_history_adjustments (generated_at desc);
