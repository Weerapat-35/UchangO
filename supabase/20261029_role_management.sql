-- จัดการบทบาทผู้ใช้ (ลูกค้า / ช่าง / ผู้ดูแล) จากหน้าแอดมิน
-- รันใน Supabase SQL Editor (รันซ้ำได้)
--
-- 1) กันผู้ใช้ทั่วไปตั้ง role ให้ตัวเอง — policy "Users can update own profile"
--    อนุญาตให้แก้แถวของตัวเองทั้งแถว จึงต้องล็อกคอลัมน์ role ด้วย trigger
-- 2) RPC admin_set_user_role ให้ผู้ดูแลเปลี่ยนบทบาทคนอื่นได้

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() เป็น null = SQL Editor / service role → ปล่อยผ่าน
  if auth.uid() is null or public.current_user_is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'customer';
  elsif new.role is distinct from old.role then
    raise exception 'ไม่มีสิทธิ์เปลี่ยนบทบาทผู้ใช้';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before insert or update on public.profiles
for each row
execute function public.protect_profile_role();

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.current_user_is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้น';
  end if;

  if p_role not in ('customer', 'technician', 'admin') then
    raise exception 'บทบาทไม่ถูกต้อง';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'ไม่สามารถเปลี่ยนบทบาทของบัญชีตัวเองได้';
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;

  if not found then
    raise exception 'ไม่พบผู้ใช้';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
