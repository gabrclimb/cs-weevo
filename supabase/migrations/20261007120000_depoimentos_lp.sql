-- Vídeos de depoimento da landing page (página inicial pública).
-- A tabela guarda só qual arquivo do bucket cada depoimento usa; o texto fica no código da LP.

create table public.weevo_depoimentos (
  chave text primary key,
  video_path text,
  updated_at timestamptz not null default now()
);

alter table public.weevo_depoimentos enable row level security;

create trigger weevo_depoimentos_updated_at
  before update on public.weevo_depoimentos
  for each row execute function public.set_updated_at();

insert into public.weevo_depoimentos (chave) values
  ('superintendente'), ('assistencial'), ('ciclo_receita'), ('oncoclinica');

-- A LP é pública: qualquer visitante lê; só admin altera.
create policy "depoimentos_select_publico" on public.weevo_depoimentos
  for select to anon, authenticated using (true);

create policy "depoimentos_update_admin" on public.weevo_depoimentos
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Bucket público (os vídeos aparecem na LP). Limite de 50 MB por arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('depoimentos', 'depoimentos', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "depoimentos_storage_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'depoimentos' and (select public.is_admin()));

create policy "depoimentos_storage_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'depoimentos' and (select public.is_admin()));

create policy "depoimentos_storage_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'depoimentos' and (select public.is_admin()));
