-- อะไหล่ที่ใช้ในงานซ่อม + ตัด/คืน Stock แบบทำงานใน transaction เดียว
create table if not exists public.repair_job_parts (
  id uuid primary key default gen_random_uuid(),
  repair_job_id uuid not null references public.repair_jobs(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repair_job_id, product_id)
);

create index if not exists repair_job_parts_job_idx
  on public.repair_job_parts(repair_job_id, created_at desc);

alter table public.repair_job_parts enable row level security;

-- ช่างดู/เพิ่ม/แก้ไข/ลบได้เฉพาะอะไหล่ในงานที่ถูกมอบหมายให้ตัวเอง
create policy "Technicians can view assigned repair parts"
on public.repair_job_parts for select
to authenticated
using (
  exists (
    select 1 from public.repair_jobs r
    where r.id = repair_job_parts.repair_job_id
      and r.mechanic_id = auth.uid()
  )
);

create policy "Technicians can insert assigned repair parts"
on public.repair_job_parts for insert
to authenticated
with check (
  exists (
    select 1 from public.repair_jobs r
    where r.id = repair_job_parts.repair_job_id
      and r.mechanic_id = auth.uid()
  )
);

create policy "Technicians can update assigned repair parts"
on public.repair_job_parts for update
to authenticated
using (
  exists (
    select 1 from public.repair_jobs r
    where r.id = repair_job_parts.repair_job_id
      and r.mechanic_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.repair_jobs r
    where r.id = repair_job_parts.repair_job_id
      and r.mechanic_id = auth.uid()
  )
);

create policy "Technicians can delete assigned repair parts"
on public.repair_job_parts for delete
to authenticated
using (
  exists (
    select 1 from public.repair_jobs r
    where r.id = repair_job_parts.repair_job_id
      and r.mechanic_id = auth.uid()
  )
);

create or replace function public.add_repair_job_part(
  p_repair_job_id uuid,
  p_product_id uuid,
  p_quantity integer
)
returns public.repair_job_parts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.repair_jobs%rowtype;
  v_product public.products%rowtype;
  v_part public.repair_job_parts%rowtype;
  v_existing_qty integer := 0;
  v_delta integer;
  v_stock_after integer;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'จำนวนอะไหล่ต้องมากกว่า 0';
  end if;

  select * into v_job
  from public.repair_jobs
  where id = p_repair_job_id
  for update;

  if not found then
    raise exception 'ไม่พบงานซ่อม';
  end if;

  if v_job.mechanic_id <> auth.uid() then
    raise exception 'คุณไม่ได้รับมอบหมายงานนี้';
  end if;

  if v_job.status in ('completed', 'cancelled') then
    raise exception 'งานนี้ปิดแล้ว ไม่สามารถเพิ่มอะไหล่ได้';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'ไม่พบสินค้าที่ใช้งานอยู่';
  end if;

  select quantity into v_existing_qty
  from public.repair_job_parts
  where repair_job_id = p_repair_job_id
    and product_id = p_product_id
  for update;

  v_existing_qty := coalesce(v_existing_qty, 0);
  v_delta := p_quantity;

  if v_product.stock_quantity < v_delta then
    raise exception 'สต็อกไม่พอ: เหลือ % ชิ้น', v_product.stock_quantity;
  end if;

  if v_existing_qty > 0 then
    update public.repair_job_parts
    set quantity = quantity + v_delta,
        updated_at = now()
    where repair_job_id = p_repair_job_id
      and product_id = p_product_id
    returning * into v_part;
  else
    insert into public.repair_job_parts (
      repair_job_id, product_id, quantity, unit_price
    ) values (
      p_repair_job_id, p_product_id, v_delta, v_product.unit_price
    )
    returning * into v_part;
  end if;

  -- ใช้ movement เดิมของระบบ เพื่อเก็บประวัติ Stock
  insert into public.inventory_movements (
    product_id, movement_type, quantity, reference_type, reference_id, note, created_by
  ) values (
    p_product_id,
    'repair_usage',
    v_delta,
    'repair_job',
    p_repair_job_id,
    'เบิกอะไหล่สำหรับงานซ่อม',
    auth.uid()
  );

  -- ถ้าฐานข้อมูลเดิมมี trigger ลด stock อยู่แล้ว จะไม่ลดซ้ำ
  select stock_quantity into v_stock_after from public.products where id = p_product_id;
  if v_stock_after = v_product.stock_quantity then
    update public.products
    set stock_quantity = stock_quantity - v_delta,
        updated_at = now()
    where id = p_product_id;
  elsif v_stock_after <> v_product.stock_quantity - v_delta then
    raise exception 'ไม่สามารถปรับ Stock ได้อย่างถูกต้อง';
  end if;

  return v_part;
end;
$$;

create or replace function public.remove_repair_job_part(p_part_id uuid)
returns public.repair_job_parts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_part public.repair_job_parts%rowtype;
  v_job public.repair_jobs%rowtype;
  v_product public.products%rowtype;
  v_stock_after integer;
begin
  select * into v_part
  from public.repair_job_parts
  where id = p_part_id
  for update;

  if not found then
    raise exception 'ไม่พบรายการอะไหล่';
  end if;

  select * into v_job from public.repair_jobs where id = v_part.repair_job_id;
  if v_job.mechanic_id <> auth.uid() then
    raise exception 'คุณไม่ได้รับมอบหมายงานนี้';
  end if;

  if v_job.status in ('completed', 'cancelled') then
    raise exception 'งานนี้ปิดแล้ว ไม่สามารถคืนอะไหล่ได้';
  end if;

  select * into v_product from public.products where id = v_part.product_id for update;

  insert into public.inventory_movements (
    product_id, movement_type, quantity, reference_type, reference_id, note, created_by
  ) values (
    v_part.product_id,
    'return',
    v_part.quantity,
    'repair_job',
    v_part.repair_job_id,
    'คืนอะไหล่จากงานซ่อม',
    auth.uid()
  );

  select stock_quantity into v_stock_after from public.products where id = v_part.product_id;
  if v_stock_after = v_product.stock_quantity then
    update public.products
    set stock_quantity = stock_quantity + v_part.quantity,
        updated_at = now()
    where id = v_part.product_id;
  elsif v_stock_after <> v_product.stock_quantity + v_part.quantity then
    raise exception 'ไม่สามารถคืน Stock ได้อย่างถูกต้อง';
  end if;

  delete from public.repair_job_parts where id = p_part_id;
  return v_part;
end;
$$;

grant execute on function public.add_repair_job_part(uuid, uuid, integer) to authenticated;
grant execute on function public.remove_repair_job_part(uuid) to authenticated;
