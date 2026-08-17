alter type public.user_role add value if not exists 'reponedor';

create table if not exists public.replenishment_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scheduled_date date not null,
  replenisher_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.replenishment_route_machines (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.replenishment_routes(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  position integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'done')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(route_id, machine_id)
);

create table if not exists public.replenishment_route_events (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.replenishment_routes(id) on delete cascade,
  route_machine_id uuid references public.replenishment_route_machines(id) on delete cascade,
  machine_id uuid references public.machines(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_replenishment_routes_date on public.replenishment_routes(scheduled_date desc);
create index if not exists idx_replenishment_routes_replenisher on public.replenishment_routes(replenisher_id);
create index if not exists idx_replenishment_route_machines_route on public.replenishment_route_machines(route_id, position);
create index if not exists idx_replenishment_route_machines_status on public.replenishment_route_machines(status);

drop trigger if exists update_replenishment_routes_updated_at on public.replenishment_routes;
create trigger update_replenishment_routes_updated_at
  before update on public.replenishment_routes
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_replenishment_route_machines_updated_at on public.replenishment_route_machines;
create trigger update_replenishment_route_machines_updated_at
  before update on public.replenishment_route_machines
  for each row execute function public.update_updated_at_column();

alter table public.replenishment_routes enable row level security;
alter table public.replenishment_route_machines enable row level security;
alter table public.replenishment_route_events enable row level security;

drop policy if exists "Admins can manage replenishment routes" on public.replenishment_routes;
create policy "Admins can manage replenishment routes" on public.replenishment_routes
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Replenishers can view own routes" on public.replenishment_routes;
create policy "Replenishers can view own routes" on public.replenishment_routes
  for select using (replenisher_id = auth.uid());

drop policy if exists "Admins can manage replenishment route machines" on public.replenishment_route_machines;
create policy "Admins can manage replenishment route machines" on public.replenishment_route_machines
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Replenishers can view own route machines" on public.replenishment_route_machines;
create policy "Replenishers can view own route machines" on public.replenishment_route_machines
  for select using (
    exists (
      select 1 from public.replenishment_routes
      where replenishment_routes.id = replenishment_route_machines.route_id
        and replenishment_routes.replenisher_id = auth.uid()
    )
  );

drop policy if exists "Replenishers can update own route machines" on public.replenishment_route_machines;
create policy "Replenishers can update own route machines" on public.replenishment_route_machines
  for update using (
    exists (
      select 1 from public.replenishment_routes
      where replenishment_routes.id = replenishment_route_machines.route_id
        and replenishment_routes.replenisher_id = auth.uid()
    )
  );

drop policy if exists "Admins can view route events" on public.replenishment_route_events;
create policy "Admins can view route events" on public.replenishment_route_events
  for select using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "Replenishers can view own route events" on public.replenishment_route_events;
create policy "Replenishers can view own route events" on public.replenishment_route_events
  for select using (
    exists (
      select 1 from public.replenishment_routes
      where replenishment_routes.id = replenishment_route_events.route_id
        and replenishment_routes.replenisher_id = auth.uid()
    )
  );
