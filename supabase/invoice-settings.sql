create table if not exists public.invoice_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique default 'default',
  shop_name text not null default 'อู่ช่างโอ',
  address text,
  phone_number text,
  email text,
  tax_id text,
  branch_name text,
  branch_number text,
  vat_registered boolean not null default false,
  vat_rate numeric(5,2) not null default 7.00,
  prices_include_vat boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint invoice_settings_vat_rate_ck check (vat_rate >= 0 and vat_rate <= 100)
);

alter table public.invoice_settings enable row level security;

drop policy if exists "Authenticated users can read invoice settings" on public.invoice_settings;
create policy "Authenticated users can read invoice settings"
on public.invoice_settings
for select
to authenticated
using (setting_key = 'default');

drop policy if exists "Admins can insert invoice settings" on public.invoice_settings;
create policy "Admins can insert invoice settings"
on public.invoice_settings
for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update invoice settings" on public.invoice_settings;
create policy "Admins can update invoice settings"
on public.invoice_settings
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create or replace function public.touch_invoice_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists invoice_settings_set_updated_at on public.invoice_settings;
create trigger invoice_settings_set_updated_at
before update on public.invoice_settings
for each row
execute function public.touch_invoice_settings_updated_at();

insert into public.invoice_settings (setting_key, shop_name)
values ('default', 'อู่ช่างโอ')
on conflict (setting_key) do nothing;
