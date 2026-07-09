-- Community per patologia: ricette e consigli condivisi tra le famiglie.
-- Post pubblici = visibili a tutti. Post privati (pubblica=false) = solo l'autore.

create extension if not exists "pgcrypto";

create table if not exists community (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid(),
  family_id  uuid,
  patologia  text not null,
  tipo       text not null default 'consiglio',   -- 'ricetta' | 'consiglio'
  titolo     text not null,
  testo      text default '',
  autore     text default '',
  pubblica   boolean default true,
  created_at timestamptz default now()
);

alter table community enable row level security;

drop policy if exists community_select on community;
create policy community_select on community
  for select to authenticated
  using (pubblica = true or user_id = auth.uid());

drop policy if exists community_insert on community;
create policy community_insert on community
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists community_delete on community;
create policy community_delete on community
  for delete to authenticated
  using (user_id = auth.uid());
