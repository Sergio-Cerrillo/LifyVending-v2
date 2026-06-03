-- Compatibilidad: ajustar tabla si ya se creó sin machine_id.

alter table if exists public.client_revenue_history_adjustments
  add column if not exists machine_id uuid;

-- Asigna una máquina válida del cliente en filas antiguas sin machine_id.
update public.client_revenue_history_adjustments h
set machine_id = fallback.machine_id
from (
  select distinct on (a.client_id) a.client_id, a.machine_id
  from public.client_machine_assignments a
  order by a.client_id, a.machine_id asc
) as fallback
where h.client_id = fallback.client_id
  and h.machine_id is null;

-- Si aún quedan nulos (cliente sin máquinas), se eliminarán para mantener integridad.
delete from public.client_revenue_history_adjustments
where machine_id is null;

alter table if exists public.client_revenue_history_adjustments
  alter column machine_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'client_revenue_history_adjustments_machine_fk'
  ) then
    alter table public.client_revenue_history_adjustments
      add constraint client_revenue_history_adjustments_machine_fk
      foreign key (machine_id) references public.machines(id) on delete cascade;
  end if;
end
$$;

drop index if exists idx_client_revenue_history_adjustments_machine;
create index if not exists idx_client_revenue_history_adjustments_machine
  on public.client_revenue_history_adjustments (machine_id);

alter table public.client_revenue_history_adjustments
  drop constraint if exists client_revenue_history_adjustments_client_id_year_month_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'client_revenue_history_adjustments_client_machine_period_key'
  ) then
    alter table public.client_revenue_history_adjustments
      add constraint client_revenue_history_adjustments_client_machine_period_key
      unique (client_id, machine_id, year, month);
  end if;
end
$$;
