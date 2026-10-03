-- Customer vehicle photos
alter table public.vehicles
  add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Vehicle images are publicly readable" on storage.objects;
create policy "Vehicle images are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'vehicle-images');

drop policy if exists "Customers can upload own vehicle images" on storage.objects;
create policy "Customers can upload own vehicle images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Customers can update own vehicle images" on storage.objects;
create policy "Customers can update own vehicle images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Customers can delete own vehicle images" on storage.objects;
create policy "Customers can delete own vehicle images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
