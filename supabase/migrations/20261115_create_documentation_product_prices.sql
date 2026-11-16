-- Catálogo interno compartido entre administradores, persistente entre sesiones.
create table if not exists public.documentation_product_prices (
  product_key text primary key check (length(product_key) between 1 and 200),
  price_with_vat numeric(12,2) not null check (price_with_vat >= 0),
  sale_without_vat numeric(12,2) not null check (sale_without_vat >= 0),
  purchase_without_vat numeric(12,2) not null check (purchase_without_vat >= 0),
  fixed_per_bottle numeric(12,2) check (fixed_per_bottle >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.documentation_product_prices enable row level security;
drop policy if exists documentation_prices_admin on public.documentation_product_prices;
create policy documentation_prices_admin on public.documentation_product_prices for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
notify pgrst, 'reload schema';
