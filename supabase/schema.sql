-- Run in Supabase SQL Editor. Then register your ONE owner's UUID (SETUP.md).
begin;
create table if not exists public.app_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id)
);
alter table public.app_owner enable row level security;
create policy "Owner can read own identity" on public.app_owner for select to authenticated using (user_id = auth.uid());
grant select on public.app_owner to authenticated;
revoke insert, update, delete on public.app_owner from anon, authenticated;
create table if not exists public.drawings (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  title text not null check (char_length(title) between 1 and 120),
  scene jsonb not null,
  thumbnail text not null default '',
  deleted boolean not null default false,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
create index if not exists drawings_owner_idx on public.drawings(owner_id);
alter table public.drawings enable row level security;
create policy "Only the configured owner" on public.drawings for all to authenticated
using (owner_id = auth.uid() and exists (select 1 from public.app_owner where user_id = auth.uid()))
with check (owner_id = auth.uid() and exists (select 1 from public.app_owner where user_id = auth.uid()));
grant select, insert, update on public.drawings to authenticated;
revoke all on public.drawings from anon;
-- Compare-and-swap makes a stale save return NULL instead of overwriting it.
create or replace function public.save_drawing(
  drawing_id uuid, drawing_title text, drawing_scene jsonb,
  drawing_thumbnail text, drawing_deleted boolean, expected_version integer
) returns integer language plpgsql security invoker set search_path = public as $$
declare saved_version integer;
begin
  if not exists (select 1 from public.app_owner where user_id = auth.uid()) then
    raise exception 'This account is not the sketchbook owner.';
  end if;
  if expected_version = 0 then
    insert into public.drawings (id, owner_id, title, scene, thumbnail, deleted)
    values (drawing_id, auth.uid(), drawing_title, drawing_scene, drawing_thumbnail, drawing_deleted)
    on conflict (id) do nothing returning version into saved_version;
  else
    update public.drawings set title = drawing_title, scene = drawing_scene,
      thumbnail = drawing_thumbnail, deleted = drawing_deleted, version = version + 1, updated_at = now()
    where id = drawing_id and owner_id = auth.uid() and version = expected_version
    returning version into saved_version;
  end if;
  return saved_version;
end;
$$;
revoke all on function public.save_drawing(uuid,text,jsonb,text,boolean,integer) from public;
grant execute on function public.save_drawing(uuid,text,jsonb,text,boolean,integer) to authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drawing-images', 'drawing-images', false, 10485760, array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','image/avif'])
on conflict (id) do nothing;
create policy "Owner reads images" on storage.objects for select to authenticated using (
  bucket_id = 'drawing-images' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.app_owner where user_id = auth.uid())
);
create policy "Owner uploads images" on storage.objects for insert to authenticated with check (
  bucket_id = 'drawing-images' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.app_owner where user_id = auth.uid())
);
create policy "Owner updates images" on storage.objects for update to authenticated using (
  bucket_id = 'drawing-images' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.app_owner where user_id = auth.uid())
) with check (
  bucket_id = 'drawing-images' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.app_owner where user_id = auth.uid())
);
commit;
