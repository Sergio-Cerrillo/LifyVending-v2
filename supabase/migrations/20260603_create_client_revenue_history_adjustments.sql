-- Histórico manual mensual por cliente (opción 2)
-- Permite crear/editar/eliminar meses con importe total para mostrar al cliente.

create table if not exists public.client_revenue_history_adjustments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  year integer not null check (year >= 2000 and year <= 2100),
  month integer not null check (month >= 1 and month <= 12),
  amount_total numeric(12,2) not null default 0,
  notes text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, machine_id, year, month)
);

create index if not exists idx_client_revenue_history_adjustments_client
  on public.client_revenue_history_adjustments (client_id);

create index if not exists idx_client_revenue_history_adjustments_machine
  on public.client_revenue_history_adjustments (machine_id);

create index if not exists idx_client_revenue_history_adjustments_period
  on public.client_revenue_history_adjustments (year desc, month desc);

create or replace function public.touch_client_revenue_history_adjustments_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_client_revenue_history_adjustments_updated_at
  on public.client_revenue_history_adjustments;

create trigger trg_touch_client_revenue_history_adjustments_updated_at
before update on public.client_revenue_history_adjustments
for each row
execute function public.touch_client_revenue_history_adjustments_updated_at();

alter table public.client_revenue_history_adjustments enable row level security;

-- Clientes: solo lectura de su propio histórico.
drop policy if exists client_history_select_own on public.client_revenue_history_adjustments;
create policy client_history_select_own
  on public.client_revenue_history_adjustments
  for select
  to authenticated
  using (auth.uid() = client_id);

-- Admin: control total del histórico.
drop policy if exists admin_history_select_all on public.client_revenue_history_adjustments;
create policy admin_history_select_all
  on public.client_revenue_history_adjustments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists admin_history_insert on public.client_revenue_history_adjustments;
create policy admin_history_insert
  on public.client_revenue_history_adjustments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists admin_history_update on public.client_revenue_history_adjustments;
create policy admin_history_update
  on public.client_revenue_history_adjustments
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists admin_history_delete on public.client_revenue_history_adjustments;
create policy admin_history_delete
  on public.client_revenue_history_adjustments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
