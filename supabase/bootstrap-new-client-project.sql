-- =====================================================
-- Lify Vending - Bootstrap completo para un proyecto Supabase nuevo
-- =====================================================
-- Uso:
-- 1. Crea el proyecto Supabase nuevo en la cuenta/usuario del cliente.
-- 2. Abre Supabase Dashboard > SQL Editor.
-- 3. Ejecuta este archivo completo.
-- 4. Crea el usuario admin/cliente desde Auth o desde la app.
--
-- Este script crea estructura vacia. No migra datos.
-- =====================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'client', 'operador');
  end if;

  if not exists (select 1 from pg_type where typname = 'revenue_period') then
    create type public.revenue_period as enum ('daily', 'weekly', 'monthly');
  end if;

  if not exists (select 1 from pg_type where typname = 'scrape_status') then
    create type public.scrape_status as enum ('pending', 'running', 'completed', 'error');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'client',
  email text not null unique,
  display_name text,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_settings (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  commission_hide_percent numeric(5,2) not null default 0 check (commission_hide_percent >= 0 and commission_hide_percent <= 100),
  commission_payment_percent numeric(5,2) default 0 check (commission_payment_percent >= 0 and commission_payment_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id)
);

create table if not exists public.machines (
  id uuid primary key default uuid_generate_v4(),
  orain_machine_id text unique,
  frekuent_machine_id text,
  televend_machine_id text,
  name text not null,
  location text,
  status text default 'active-war',
  last_scraped_at timestamptz,
  daily_total numeric(12,2) default 0,
  daily_card numeric(12,2) default 0,
  daily_cash numeric(12,2) default 0,
  daily_updated_at timestamptz,
  weekly_total numeric(12,2) default 0,
  weekly_card numeric(12,2) default 0,
  weekly_cash numeric(12,2) default 0,
  weekly_updated_at timestamptz,
  monthly_total numeric(12,2) default 0,
  monthly_card numeric(12,2) default 0,
  monthly_cash numeric(12,2) default 0,
  monthly_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machines_has_at_least_one_id check (
    orain_machine_id is not null
    or frekuent_machine_id is not null
    or televend_machine_id is not null
  )
);

create index if not exists idx_machines_orain_id on public.machines(orain_machine_id);
create index if not exists idx_machines_frekuent_machine_id on public.machines(frekuent_machine_id);
create unique index if not exists idx_machines_televend_id on public.machines(televend_machine_id) where televend_machine_id is not null;
create index if not exists idx_machines_status on public.machines(status);

create table if not exists public.client_machine_assignments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique(client_id, machine_id)
);

create index if not exists idx_assignments_client on public.client_machine_assignments(client_id);
create index if not exists idx_assignments_machine on public.client_machine_assignments(machine_id);

create table if not exists public.machine_revenue_snapshots (
  id uuid primary key default uuid_generate_v4(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  scraped_at timestamptz not null,
  period public.revenue_period not null,
  amount_gross numeric(10,2) not null default 0,
  anonymous_total numeric(10,2) default 0,
  anonymous_card numeric(10,2) default 0,
  anonymous_cash numeric(10,2) default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_revenue_machine on public.machine_revenue_snapshots(machine_id);
create index if not exists idx_revenue_period on public.machine_revenue_snapshots(period);
create index if not exists idx_revenue_scraped_at on public.machine_revenue_snapshots(scraped_at desc);
create index if not exists idx_revenue_machine_period on public.machine_revenue_snapshots(machine_id, period, scraped_at desc);

create table if not exists public.scrape_runs (
  id uuid primary key default uuid_generate_v4(),
  triggered_by_user_id uuid references public.profiles(id) on delete set null,
  triggered_role public.user_role,
  status public.scrape_status not null default 'pending',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  machines_scraped integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_scrape_runs_status on public.scrape_runs(status);
create index if not exists idx_scrape_runs_started on public.scrape_runs(started_at desc);
create index if not exists idx_scrape_runs_user on public.scrape_runs(triggered_by_user_id);

create table if not exists public.machine_stock_current (
  id uuid primary key default uuid_generate_v4(),
  machine_id uuid not null unique references public.machines(id) on delete cascade,
  machine_name text not null,
  machine_location text,
  scraped_at timestamptz not null,
  total_products integer not null default 0,
  total_capacity integer not null default 0,
  total_available integer not null default 0,
  total_to_replenish integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stock_current_machine on public.machine_stock_current(machine_id);
create index if not exists idx_stock_current_to_replenish on public.machine_stock_current(total_to_replenish) where total_to_replenish > 0;
create index if not exists idx_stock_current_scraped_at on public.machine_stock_current(scraped_at desc);

create table if not exists public.stock_products_current (
  id uuid primary key default uuid_generate_v4(),
  stock_id uuid not null references public.machine_stock_current(id) on delete cascade,
  product_name text not null,
  category text,
  line text,
  total_capacity integer not null default 0,
  available_units integer not null default 0,
  units_to_replenish integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_products_current_stock on public.stock_products_current(stock_id);
create index if not exists idx_stock_products_current_name on public.stock_products_current(product_name);
create index if not exists idx_stock_products_current_to_replenish on public.stock_products_current(units_to_replenish) where units_to_replenish > 0;
create index if not exists idx_stock_products_current_category on public.stock_products_current(category) where category is not null;

create table if not exists public.commission_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  month integer not null,
  year integer not null,
  total_revenue decimal(10,2) not null default 0,
  commission_percent decimal(5,2) not null,
  commission_amount decimal(10,2) not null,
  card_revenue decimal(10,2) default 0,
  cash_revenue decimal(10,2) default 0,
  machines_count integer not null default 0,
  created_at timestamptz default now(),
  constraint unique_client_month_year unique (client_id, month, year)
);

create index if not exists idx_commission_snapshots_client_id on public.commission_snapshots(client_id);
create index if not exists idx_commission_snapshots_year_month on public.commission_snapshots(year, month);
create index if not exists idx_commission_snapshots_created_at on public.commission_snapshots(created_at);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text default 'LifyVending',
  admin_panel_name text default 'Panel Administrativo',
  client_portal_name text default 'Portal Cliente',
  support_email text default 'info@lifyvending.com',
  support_phone text default '',
  timezone text default 'Europe/Madrid',
  currency text default 'EUR',
  date_format text default 'DD/MM/YYYY',
  default_language text default 'es',
  legal_footer text default '',
  scraping_config jsonb default '{
    "enabled": true,
    "auto_enabled": true,
    "manual_enabled": true,
    "interval_hours": 24,
    "timeout_seconds": 300,
    "max_retries": 3,
    "stock_enabled": true,
    "revenue_enabled": true
  }'::jsonb,
  clients_config jsonb default '{
    "default_percentage": 0,
    "force_password_change": false,
    "allow_manual_refresh": true,
    "max_refreshes_per_day": 5,
    "min_refresh_interval_minutes": 30,
    "show_machine_breakdown": true,
    "show_daily_card": true,
    "show_weekly_card": true,
    "show_monthly_card": true,
    "allow_export": false
  }'::jsonb,
  security_config jsonb default '{
    "min_password_length": 8,
    "require_uppercase": true,
    "require_number": true,
    "require_symbol": false,
    "session_duration_hours": 24,
    "max_login_attempts": 5,
    "enable_2fa": false,
    "require_confirmation_sensitive": true,
    "log_critical_actions": true
  }'::jsonb,
  notifications_config jsonb default '{
    "alert_email": "info@lifyvending.com",
    "notify_scraping_failure": true,
    "notify_update_failure": true,
    "notify_client_created": false,
    "notify_password_reset": true,
    "notify_excess_refreshes": true,
    "email_subject_template": "[LifyVending] {{event}}"
  }'::jsonb,
  appearance_config jsonb default '{
    "brand_name": "LifyVending",
    "login_welcome_text": "Bienvenido al Panel de Gestion",
    "primary_color": "#3b82f6",
    "secondary_color": "#8b5cf6",
    "logo_url": "",
    "client_dashboard_name": "Mi Dashboard",
    "login_image_url": ""
  }'::jsonb,
  maintenance_config jsonb default '{
    "enabled": false,
    "message": "Sistema en mantenimiento. Volveremos pronto.",
    "log_retention_days": 90
  }'::jsonb,
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id),
  constraint single_settings_row check (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

create index if not exists idx_app_settings_updated_at on public.app_settings(updated_at desc);

create table if not exists public.revenue_scrape_jobs (
  id uuid primary key default uuid_generate_v4(),
  action text not null check (action in ('frekuent', 'frekuent_daily', 'frekuent_monthly', 'televend', 'all_queue')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'error', 'canceled')),
  phase text not null default 'queued',
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  requested_by_user_id uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  attempts integer not null default 0,
  error_message text,
  result_json jsonb,
  lock_token text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_revenue_jobs_status_requested on public.revenue_scrape_jobs(status, requested_at);
create index if not exists idx_revenue_jobs_requested_by on public.revenue_scrape_jobs(requested_by_user_id, requested_at desc);
create index if not exists idx_revenue_jobs_created_at on public.revenue_scrape_jobs(created_at desc);
create unique index if not exists uq_revenue_jobs_action_active on public.revenue_scrape_jobs(action) where status in ('queued', 'running');

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
  constraint client_revenue_history_adjustments_client_machine_period_key unique (client_id, machine_id, year, month)
);

create index if not exists idx_client_revenue_history_adjustments_client on public.client_revenue_history_adjustments(client_id);
create index if not exists idx_client_revenue_history_adjustments_machine on public.client_revenue_history_adjustments(machine_id);
create index if not exists idx_client_revenue_history_adjustments_period on public.client_revenue_history_adjustments(year desc, month desc);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, display_name)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'client'),
    coalesce(new.raw_user_meta_data->>'name', new.email)
  );
  return new;
exception
  when unique_violation then
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_profile_for_user()
returns json as $$
declare
  current_user_id uuid;
  user_email text;
  user_metadata jsonb;
  profile_role public.user_role;
  profile_name text;
  result json;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    return json_build_object('success', false, 'error', 'No authenticated user');
  end if;

  if exists (select 1 from public.profiles where id = current_user_id) then
    return json_build_object('success', false, 'error', 'Profile already exists');
  end if;

  select email, raw_user_meta_data into user_email, user_metadata
  from auth.users
  where id = current_user_id;

  profile_role := coalesce((user_metadata->>'role')::public.user_role, 'operador');
  profile_name := coalesce(user_metadata->>'name', user_email);

  insert into public.profiles (id, email, role, display_name)
  values (current_user_id, user_email, profile_role, profile_name);

  select json_build_object(
    'success', true,
    'profile', json_build_object(
      'id', id,
      'email', email,
      'role', role,
      'display_name', display_name
    )
  ) into result
  from public.profiles
  where id = current_user_id;

  return result;
exception
  when others then
    return json_build_object('success', false, 'error', sqlerrm, 'detail', sqlstate);
end;
$$ language plpgsql security definer;

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

create or replace function public.get_admin_client_overview(p_client_id uuid)
returns table (
  period public.revenue_period,
  total_gross numeric,
  total_net numeric,
  commission_percent numeric,
  machine_count integer,
  last_update timestamptz
) as $$
begin
  return query
  select
    'daily'::public.revenue_period,
    round(sum(coalesce(m.daily_total, 0)), 2),
    round(sum(coalesce(m.daily_total, 0) * (1 - coalesce(cs.commission_hide_percent, 0) / 100.0)), 2),
    coalesce(cs.commission_hide_percent, 0),
    count(distinct m.id)::integer,
    max(m.daily_updated_at)
  from public.machines m
  join public.client_machine_assignments cma on cma.machine_id = m.id
  left join public.client_settings cs on cs.client_id = p_client_id
  where cma.client_id = p_client_id
  group by cs.commission_hide_percent

  union all

  select
    'weekly'::public.revenue_period,
    round(sum(coalesce(m.weekly_total, 0)), 2),
    round(sum(coalesce(m.weekly_total, 0) * (1 - coalesce(cs.commission_hide_percent, 0) / 100.0)), 2),
    coalesce(cs.commission_hide_percent, 0),
    count(distinct m.id)::integer,
    max(m.weekly_updated_at)
  from public.machines m
  join public.client_machine_assignments cma on cma.machine_id = m.id
  left join public.client_settings cs on cs.client_id = p_client_id
  where cma.client_id = p_client_id
  group by cs.commission_hide_percent

  union all

  select
    'monthly'::public.revenue_period,
    round(sum(coalesce(m.monthly_total, 0)), 2),
    round(sum(coalesce(m.monthly_total, 0) * (1 - coalesce(cs.commission_hide_percent, 0) / 100.0)), 2),
    coalesce(cs.commission_hide_percent, 0),
    count(distinct m.id)::integer,
    max(m.monthly_updated_at)
  from public.machines m
  join public.client_machine_assignments cma on cma.machine_id = m.id
  left join public.client_settings cs on cs.client_id = p_client_id
  where cma.client_id = p_client_id
  group by cs.commission_hide_percent;
end;
$$ language plpgsql security definer;

create or replace function public.update_app_settings_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql security definer;

create or replace function public.touch_client_revenue_history_adjustments_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_client_settings_updated_at on public.client_settings;
create trigger update_client_settings_updated_at before update on public.client_settings
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_machines_updated_at on public.machines;
create trigger update_machines_updated_at before update on public.machines
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_stock_current_updated_at on public.machine_stock_current;
create trigger update_stock_current_updated_at before update on public.machine_stock_current
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_revenue_scrape_jobs_updated_at on public.revenue_scrape_jobs;
create trigger update_revenue_scrape_jobs_updated_at before update on public.revenue_scrape_jobs
  for each row execute function public.update_updated_at_column();

drop trigger if exists trigger_update_app_settings_timestamp on public.app_settings;
create trigger trigger_update_app_settings_timestamp before update on public.app_settings
  for each row execute function public.update_app_settings_timestamp();

drop trigger if exists trg_touch_client_revenue_history_adjustments_updated_at on public.client_revenue_history_adjustments;
create trigger trg_touch_client_revenue_history_adjustments_updated_at before update on public.client_revenue_history_adjustments
  for each row execute function public.touch_client_revenue_history_adjustments_updated_at();

insert into public.app_settings (id)
values ('00000000-0000-0000-0000-000000000001'::uuid)
on conflict (id) do nothing;

create or replace view public.settings_audit as
select
  s.id,
  s.company_name,
  s.updated_at,
  s.updated_by,
  p.display_name as updated_by_name,
  p.email as updated_by_email
from public.app_settings s
left join public.profiles p on s.updated_by = p.id;

alter view public.settings_audit set (security_barrier = true);

alter table public.profiles enable row level security;
alter table public.client_settings enable row level security;
alter table public.machines enable row level security;
alter table public.client_machine_assignments enable row level security;
alter table public.machine_revenue_snapshots enable row level security;
alter table public.scrape_runs enable row level security;
alter table public.machine_stock_current enable row level security;
alter table public.stock_products_current enable row level security;
alter table public.commission_snapshots enable row level security;
alter table public.app_settings enable row level security;
alter table public.revenue_scrape_jobs enable row level security;
alter table public.client_revenue_history_adjustments enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Users can view own settings" on public.client_settings;
create policy "Users can view own settings" on public.client_settings
  for select to authenticated
  using (client_id = auth.uid());

drop policy if exists "Users can view assigned machines" on public.machines;
create policy "Users can view assigned machines" on public.machines
  for select to authenticated
  using (
    exists (
      select 1 from public.client_machine_assignments
      where client_id = auth.uid() and machine_id = machines.id
    )
  );

drop policy if exists "Users can view own assignments" on public.client_machine_assignments;
create policy "Users can view own assignments" on public.client_machine_assignments
  for select to authenticated
  using (client_id = auth.uid());

drop policy if exists "Users can view revenue of assigned machines" on public.machine_revenue_snapshots;
create policy "Users can view revenue of assigned machines" on public.machine_revenue_snapshots
  for select to authenticated
  using (
    exists (
      select 1 from public.client_machine_assignments cma
      where cma.client_id = auth.uid()
        and cma.machine_id = machine_revenue_snapshots.machine_id
    )
  );

drop policy if exists "Users can view own scrape runs" on public.scrape_runs;
create policy "Users can view own scrape runs" on public.scrape_runs
  for select to authenticated
  using (triggered_by_user_id = auth.uid());

drop policy if exists "Users can insert scrape runs" on public.scrape_runs;
create policy "Users can insert scrape runs" on public.scrape_runs
  for insert to authenticated
  with check (triggered_by_user_id = auth.uid());

drop policy if exists "Clients can view own commission snapshots" on public.commission_snapshots;
create policy "Clients can view own commission snapshots" on public.commission_snapshots
  for select to authenticated
  using (client_id = auth.uid());

drop policy if exists "Admins can view all commission snapshots" on public.commission_snapshots;
create policy "Admins can view all commission snapshots" on public.commission_snapshots
  for select to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can insert commission snapshots" on public.commission_snapshots;
create policy "Admins can insert commission snapshots" on public.commission_snapshots
  for insert to authenticated
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can update commission snapshots" on public.commission_snapshots;
create policy "Admins can update commission snapshots" on public.commission_snapshots
  for update to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can read settings" on public.app_settings;
create policy "Admins can read settings" on public.app_settings
  for select to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can update settings" on public.app_settings;
create policy "Admins can update settings" on public.app_settings
  for update to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can read revenue scrape jobs" on public.revenue_scrape_jobs;
create policy "Admins can read revenue scrape jobs" on public.revenue_scrape_jobs
  for select to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can insert revenue scrape jobs" on public.revenue_scrape_jobs;
create policy "Admins can insert revenue scrape jobs" on public.revenue_scrape_jobs
  for insert to authenticated
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists client_history_select_own on public.client_revenue_history_adjustments;
create policy client_history_select_own on public.client_revenue_history_adjustments
  for select to authenticated
  using (auth.uid() = client_id);

drop policy if exists admin_history_select_all on public.client_revenue_history_adjustments;
create policy admin_history_select_all on public.client_revenue_history_adjustments
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists admin_history_insert on public.client_revenue_history_adjustments;
create policy admin_history_insert on public.client_revenue_history_adjustments
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists admin_history_update on public.client_revenue_history_adjustments;
create policy admin_history_update on public.client_revenue_history_adjustments
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists admin_history_delete on public.client_revenue_history_adjustments;
create policy admin_history_delete on public.client_revenue_history_adjustments
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

comment on table public.profiles is 'Perfiles de usuario extendiendo auth.users con roles';
comment on table public.client_settings is 'Configuracion por cliente, especialmente porcentaje de comision oculta';
comment on table public.machines is 'Maquinas de vending de Frekuent/Orain/Televend';
comment on table public.client_machine_assignments is 'Relacion entre clientes y maquinas';
comment on table public.machine_revenue_snapshots is 'Snapshots historicos de recaudacion bruta por maquina y periodo';
comment on table public.scrape_runs is 'Auditoria de ejecuciones de scraping';
comment on table public.machine_stock_current is 'Stock actual de cada maquina';
comment on table public.stock_products_current is 'Detalle actual de productos por maquina';
comment on table public.app_settings is 'Configuracion global del sistema';
comment on table public.revenue_scrape_jobs is 'Cola persistente para scrapings manuales de recaudacion';
comment on table public.client_revenue_history_adjustments is 'Historico mensual manual por cliente y maquina';
