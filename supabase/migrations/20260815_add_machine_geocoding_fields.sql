alter table public.machines
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists geocoded_at timestamptz,
  add column if not exists geocode_source text,
  add column if not exists geocode_confidence double precision;

create index if not exists idx_machines_coordinates
  on public.machines (latitude, longitude)
  where latitude is not null and longitude is not null;
