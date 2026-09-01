-- Cierra accesos directos de clientes a tablas que contienen importes brutos
-- o porcentajes internos. El cliente debe consumir solo /api/client/dashboard,
-- que devuelve importes netos ya ajustados.

drop policy if exists "Users can view own settings" on public.client_settings;

drop policy if exists "Users can view assigned machines" on public.machines;
drop policy if exists "Clients can view assigned machines" on public.machines;

drop policy if exists "Users can view revenue of assigned machines" on public.machine_revenue_snapshots;
drop policy if exists "Clients can view revenue of assigned machines" on public.machine_revenue_snapshots;

drop policy if exists client_history_select_own on public.client_revenue_history_adjustments;
drop policy if exists "Clients can view own commission snapshots" on public.commission_snapshots;

create or replace function public.get_client_net_revenue(
  p_client_id uuid,
  p_period public.revenue_period,
  p_machine_id uuid default null
)
returns table (
  machine_id uuid,
  machine_name text,
  location text,
  period public.revenue_period,
  amount_net numeric,
  scraped_at timestamptz
) as $$
begin
  if p_client_id <> auth.uid() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Access denied';
  end if;

  return query
  select
    m.id as machine_id,
    m.name as machine_name,
    m.location,
    p_period as period,
    case p_period
      when 'daily' then round(coalesce(m.daily_total, 0) * (1 - coalesce(cs.commission_hide_percent, 0) / 100.0), 2)
      when 'weekly' then round(coalesce(m.weekly_total, 0) * (1 - coalesce(cs.commission_hide_percent, 0) / 100.0), 2)
      when 'monthly' then round(coalesce(m.monthly_total, 0) * (1 - coalesce(cs.commission_hide_percent, 0) / 100.0), 2)
    end as amount_net,
    case p_period
      when 'daily' then m.daily_updated_at
      when 'weekly' then m.weekly_updated_at
      when 'monthly' then m.monthly_updated_at
    end as scraped_at
  from public.machines m
  join public.client_machine_assignments cma on cma.machine_id = m.id
  left join public.client_settings cs on cs.client_id = cma.client_id
  where cma.client_id = p_client_id
    and (p_machine_id is null or m.id = p_machine_id)
  order by m.name;
end;
$$ language plpgsql security definer;

comment on function public.get_client_net_revenue(uuid, public.revenue_period, uuid) is
  'Devuelve solo recaudacion neta del cliente autenticado. Nunca expone bruto ni porcentaje oculto.';
