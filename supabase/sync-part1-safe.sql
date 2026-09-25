-- =========================================================================
-- BCare: Sync to reference schema — PART 1 (ปลอดภัย รันได้เลย)
-- =========================================================================
-- รวม 7 ไฟล์จากระบบอ้างอิงที่ฐานข้อมูลของคุณยังไม่มี ทุกคำสั่ง additive/
-- idempotent (มี if not exists / create or replace ครบ) รันซ้ำได้ไม่พัง
-- รันทั้งไฟล์นี้รวดเดียวใน Supabase SQL Editor ได้เลย
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1) profile-avatar-schema.sql — รูปโปรไฟล์ผู้ใช้
-- -------------------------------------------------------------------------
alter table public.profiles
add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read profile images"
on storage.objects;
create policy "Anyone can read profile images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'profile-images');

drop policy if exists "Users can upload own profile images"
on storage.objects;
create policy "Users can upload own profile images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own profile images"
on storage.objects;
create policy "Users can update own profile images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own profile images"
on storage.objects;
create policy "Users can delete own profile images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- -------------------------------------------------------------------------
-- 2) vehicle-image-upload.sql — รูปรถของลูกค้า
-- -------------------------------------------------------------------------
alter table public.vehicles
add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-images',
  'vehicle-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read vehicle images"
on storage.objects;
create policy "Anyone can read vehicle images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'vehicle-images');

drop policy if exists "Users can upload own vehicle images"
on storage.objects;
create policy "Users can upload own vehicle images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own vehicle images"
on storage.objects;
create policy "Users can update own vehicle images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own vehicle images"
on storage.objects;
create policy "Users can delete own vehicle images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- -------------------------------------------------------------------------
-- 3) service-image-upload.sql — รูปบริการ (ใช้ bucket product-images ร่วมกับสินค้า)
-- -------------------------------------------------------------------------
alter table public.services
add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read service images"
on storage.objects;
create policy "Anyone can read service images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'product-images'
  and name like 'services/%'
);

drop policy if exists "Admins can upload service images"
on storage.objects;
create policy "Admins can upload service images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and name like 'services/%'
  and public.current_user_is_admin()
);

drop policy if exists "Admins can update service images"
on storage.objects;
create policy "Admins can update service images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and name like 'services/%'
  and public.current_user_is_admin()
)
with check (
  bucket_id = 'product-images'
  and name like 'services/%'
  and public.current_user_is_admin()
);

drop policy if exists "Admins can delete service images"
on storage.objects;
create policy "Admins can delete service images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and name like 'services/%'
  and public.current_user_is_admin()
);


-- -------------------------------------------------------------------------
-- 4) homepage-slides-schema.sql — สไลด์โชว์หน้าแรก + Footer
-- -------------------------------------------------------------------------
create table if not exists public.homepage_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  description text,
  image_url text,
  link_url text,
  display_order integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint homepage_slides_status_check check (status in ('active', 'inactive'))
);

alter table public.homepage_slides enable row level security;

create or replace function public.set_homepage_slides_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists homepage_slides_set_updated_at on public.homepage_slides;
create trigger homepage_slides_set_updated_at
before update on public.homepage_slides
for each row
execute function public.set_homepage_slides_updated_at();

drop policy if exists "Anyone can read active homepage slides"
on public.homepage_slides;
create policy "Anyone can read active homepage slides"
on public.homepage_slides
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage homepage slides"
on public.homepage_slides;
create policy "Admins can manage homepage slides"
on public.homepage_slides
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create table if not exists public.homepage_footer_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique default 'default',
  status text not null default 'active',
  background_color text not null default '#0a0d0b',
  shop_name text,
  address text,
  phone_number text,
  email text,
  facebook_url text,
  line_url text,
  operating_hours_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint homepage_footer_settings_status_check check (status in ('active', 'inactive'))
);

alter table public.homepage_footer_settings enable row level security;

create or replace function public.set_homepage_footer_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists homepage_footer_settings_set_updated_at
on public.homepage_footer_settings;
create trigger homepage_footer_settings_set_updated_at
before update on public.homepage_footer_settings
for each row
execute function public.set_homepage_footer_settings_updated_at();

drop policy if exists "Anyone can read homepage footer settings"
on public.homepage_footer_settings;
create policy "Anyone can read homepage footer settings"
on public.homepage_footer_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert homepage footer settings"
on public.homepage_footer_settings;
create policy "Admins can insert homepage footer settings"
on public.homepage_footer_settings
for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update homepage footer settings"
on public.homepage_footer_settings;
create policy "Admins can update homepage footer settings"
on public.homepage_footer_settings
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

insert into public.homepage_footer_settings (setting_key)
values ('default')
on conflict (setting_key) do nothing;


-- -------------------------------------------------------------------------
-- 5) homepage-appearance-schema.sql — สีพื้นหลัง/โลโก้หน้าแรก
-- -------------------------------------------------------------------------
create table if not exists public.homepage_appearance_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique default 'default',
  background_color text not null default '#0a0d0b',
  background_image_url text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.homepage_appearance_settings
  add column if not exists background_image_url text;
alter table public.homepage_appearance_settings
  add column if not exists logo_url text;

alter table public.homepage_appearance_settings enable row level security;

create or replace function public.set_homepage_appearance_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists homepage_appearance_settings_set_updated_at
on public.homepage_appearance_settings;
create trigger homepage_appearance_settings_set_updated_at
before update on public.homepage_appearance_settings
for each row
execute function public.set_homepage_appearance_settings_updated_at();

drop policy if exists "Anyone can read homepage appearance settings"
on public.homepage_appearance_settings;
create policy "Anyone can read homepage appearance settings"
on public.homepage_appearance_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert homepage appearance settings"
on public.homepage_appearance_settings;
create policy "Admins can insert homepage appearance settings"
on public.homepage_appearance_settings
for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update homepage appearance settings"
on public.homepage_appearance_settings;
create policy "Admins can update homepage appearance settings"
on public.homepage_appearance_settings
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

insert into public.homepage_appearance_settings (setting_key, background_color)
values ('default', '#0a0d0b')
on conflict (setting_key) do nothing;


-- -------------------------------------------------------------------------
-- 6) product-order-delivery-location.sql — ปักหมุดที่อยู่จัดส่งบนแผนที่
-- -------------------------------------------------------------------------
alter table public.product_orders
  add column if not exists delivery_latitude numeric(10, 7);
alter table public.product_orders
  add column if not exists delivery_longitude numeric(10, 7);

alter table public.product_orders
  drop constraint if exists product_orders_delivery_location_check;
alter table public.product_orders
  add constraint product_orders_delivery_location_check
  check (
    (delivery_latitude is null and delivery_longitude is null)
    or (
      delivery_latitude is not null
      and delivery_longitude is not null
      and delivery_latitude between -90 and 90
      and delivery_longitude between -180 and 180
    )
  );


-- -------------------------------------------------------------------------
-- 7) product-order-customer-cancellation.sql — ลูกค้ายกเลิกออเดอร์ตัวเองได้
-- -------------------------------------------------------------------------
create unique index if not exists inventory_movements_product_order_return_key
on public.inventory_movements(reference_id, product_id)
where reference_type = 'product_order'
  and movement_type = 'return'
  and reference_id is not null;

create or replace function public.cancel_own_product_order_with_inventory_return(
  target_order_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  order_record public.product_orders%rowtype;
  sale_movement_count integer;
  existing_return_count integer;
  inserted_return_count integer := 0;
  order_item record;
begin
  if auth.uid() is null then
    raise exception 'BCare product order cancellation requires an authenticated user.';
  end if;

  select *
  into order_record
  from public.product_orders
  where id = target_order_id
  for update;

  if order_record.id is null then
    raise exception 'BCare product order was not found.';
  end if;

  if order_record.customer_id <> auth.uid() then
    raise exception 'BCare product order does not belong to this account.';
  end if;

  if order_record.status <> 'pending' then
    raise exception 'BCare product order can only be cancelled while it is still pending.';
  end if;

  if order_record.payment_status = 'paid' then
    raise exception 'BCare product order has already been paid and cannot be self-cancelled.';
  end if;

  select count(*)::integer
  into existing_return_count
  from public.inventory_movements
  where movement_type = 'return'
    and reference_type = 'product_order'
    and reference_id = target_order_id;

  if existing_return_count > 0 then
    update public.product_orders
    set status = 'cancelled'
    where id = target_order_id;

    return existing_return_count;
  end if;

  if not exists (
    select 1
    from public.product_order_items
    where product_order_id = target_order_id
  ) then
    raise exception 'BCare product order has no items.';
  end if;

  select count(*)::integer
  into sale_movement_count
  from public.inventory_movements
  where movement_type = 'sale'
    and reference_type = 'product_order'
    and reference_id = target_order_id;

  if sale_movement_count > 0 then
    for order_item in
      select
        product_order_items.product_id,
        sum(product_order_items.quantity)::integer as quantity
      from public.product_order_items
      where product_order_items.product_order_id = target_order_id
      group by product_order_items.product_id
      order by product_order_items.product_id
    loop
      insert into public.inventory_movements (
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        note,
        created_by
      )
      values (
        order_item.product_id,
        'return',
        order_item.quantity,
        'product_order',
        target_order_id,
        'Customer cancelled order: ' || order_record.order_number,
        auth.uid()
      );

      inserted_return_count := inserted_return_count + 1;
    end loop;
  end if;

  update public.product_orders
  set status = 'cancelled'
  where id = target_order_id;

  return inserted_return_count;
end;
$$;

grant execute on function public.cancel_own_product_order_with_inventory_return(uuid)
to authenticated;

-- =========================================================================
-- จบ PART 1 — ต่อไปให้รัน PART 2 (เรื่องความสมบูรณ์ของการจ่ายเงิน)
-- แต่อ่านคำแนะนำก่อนรันนะครับ มีขั้นตอนตรวจสอบก่อน 1 ขั้น
-- =========================================================================
