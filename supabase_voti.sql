-- ============================================================
-- Tabella "voti" per la condivisione partner (Priorita 3)
-- L'utente principale salva 3 opzioni cena; il partner (anche
-- senza login) legge e salva la sua scelta.
-- Esegui nel SQL Editor di Supabase.
-- ============================================================

create table if not exists voti (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid references families(id) on delete cascade,
  giorno      text not null,
  opzioni     jsonb,
  scelta      text,
  updated_at  timestamptz default now(),
  unique (family_id, giorno)
);

alter table voti enable row level security;

-- Il partner apre il link senza login (ruolo anon): deve poter
-- leggere le opzioni e salvare la scelta. Politica permissiva.
drop policy if exists "voti_all" on voti;
create policy "voti_all" on voti
  for all
  to anon, authenticated
  using (true)
  with check (true);
