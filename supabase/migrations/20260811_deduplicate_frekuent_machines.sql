-- Fusiona duplicados de Frekuent creados por refrescos concurrentes y evita que vuelvan a aparecer.

create temp table if not exists tmp_frekuent_machine_dupes on commit drop as
with grouped as (
  select
    frekuent_machine_id,
    array_agg(
      id
      order by
        (case when coalesce(monthly_total, 0) > 0 then 1 else 0 end) desc,
        (case when coalesce(daily_total, 0) > 0 then 1 else 0 end) desc,
        coalesce(updated_at, created_at) desc,
        id asc
    ) as ids
  from public.machines
  where frekuent_machine_id is not null
  group by frekuent_machine_id
  having count(*) > 1
)
select
  frekuent_machine_id,
  ids[1] as keep_id,
  unnest(ids[2:array_length(ids, 1)]) as drop_id
from grouped;

with merged as (
  select
    d.frekuent_machine_id,
    d.keep_id,
    max(m.name) filter (where m.name is not null and m.name <> '') as name,
    max(m.location) filter (where m.location is not null and m.location <> '') as location,
    max(m.status) filter (where m.status is not null and m.status <> '') as status,
    max(coalesce(m.daily_total, 0)) as daily_total,
    max(coalesce(m.daily_card, 0)) as daily_card,
    max(coalesce(m.daily_cash, 0)) as daily_cash,
    max(coalesce(m.monthly_total, 0)) as monthly_total,
    max(coalesce(m.monthly_card, 0)) as monthly_card,
    max(coalesce(m.monthly_cash, 0)) as monthly_cash,
    max(m.last_scraped_at) as last_scraped_at,
    max(m.daily_updated_at) as daily_updated_at,
    max(m.monthly_updated_at) as monthly_updated_at,
    max(m.updated_at) as updated_at
  from tmp_frekuent_machine_dupes d
  join public.machines m
    on m.id = d.keep_id
    or m.id = d.drop_id
  group by d.frekuent_machine_id, d.keep_id
)
update public.machines m
set
  name = coalesce(merged.name, m.name),
  location = coalesce(merged.location, m.location),
  status = coalesce(merged.status, m.status),
  daily_total = merged.daily_total,
  daily_card = merged.daily_card,
  daily_cash = merged.daily_cash,
  monthly_total = merged.monthly_total,
  monthly_card = merged.monthly_card,
  monthly_cash = merged.monthly_cash,
  last_scraped_at = coalesce(merged.last_scraped_at, m.last_scraped_at),
  daily_updated_at = coalesce(merged.daily_updated_at, m.daily_updated_at),
  monthly_updated_at = coalesce(merged.monthly_updated_at, m.monthly_updated_at),
  updated_at = coalesce(merged.updated_at, now())
from merged
where m.id = merged.keep_id;

delete from public.client_machine_assignments a
using tmp_frekuent_machine_dupes d
where a.machine_id = d.drop_id
  and exists (
    select 1
    from public.client_machine_assignments keep
    where keep.client_id = a.client_id
      and keep.machine_id = d.keep_id
  );

update public.client_machine_assignments a
set machine_id = d.keep_id
from tmp_frekuent_machine_dupes d
where a.machine_id = d.drop_id;

delete from public.client_revenue_history_adjustments h
using tmp_frekuent_machine_dupes d
where h.machine_id = d.drop_id
  and exists (
    select 1
    from public.client_revenue_history_adjustments keep
    where keep.client_id = h.client_id
      and keep.machine_id = d.keep_id
      and keep.year = h.year
      and keep.month = h.month
  );

update public.client_revenue_history_adjustments h
set machine_id = d.keep_id
from tmp_frekuent_machine_dupes d
where h.machine_id = d.drop_id;

update public.machine_revenue_snapshots s
set machine_id = d.keep_id
from tmp_frekuent_machine_dupes d
where s.machine_id = d.drop_id;

delete from public.machine_stock_current s
using tmp_frekuent_machine_dupes d
where s.machine_id = d.drop_id
  and exists (
    select 1
    from public.machine_stock_current keep
    where keep.machine_id = d.keep_id
  );

update public.machine_stock_current s
set machine_id = d.keep_id
from tmp_frekuent_machine_dupes d
where s.machine_id = d.drop_id;

delete from public.machines m
using tmp_frekuent_machine_dupes d
where m.id = d.drop_id;

create unique index if not exists idx_machines_frekuent_id_unique
  on public.machines (frekuent_machine_id)
  where frekuent_machine_id is not null;
