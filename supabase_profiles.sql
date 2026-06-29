-- ============================================================
-- Tabella "profiles" per Menu Famiglia
-- Struttura usata dall'app: una riga per ogni familiare,
-- con i dati del profilo salvati nel campo JSON "dati".
-- Esegui questo script nel SQL Editor di Supabase.
-- ============================================================

create table if not exists profiles (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid references families(id) on delete cascade,
  profile_id  text not null,
  dati        jsonb not null,
  updated_at  timestamptz default now(),
  unique (family_id, profile_id)
);

-- Attiva la sicurezza a livello di riga
alter table profiles enable row level security;

-- Permette agli utenti autenticati di leggere/scrivere
-- (l'app filtra gia per family_id). Politica permissiva,
-- coerente con le altre tabelle dell'app.
drop policy if exists "profiles_all" on profiles;
create policy "profiles_all" on profiles
  for all
  to authenticated
  using (true)
  with check (true);
