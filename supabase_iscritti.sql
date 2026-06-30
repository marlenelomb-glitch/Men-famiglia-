-- ============================================================
-- Tabella "iscritti" per Menu Famiglia
-- Salva ogni nuovo utente che si registra (email + data).
-- Esegui nel SQL Editor di Supabase.
-- ============================================================

create table if not exists iscritti (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  user_id     uuid,
  created_at  timestamptz default now()
);

alter table iscritti enable row level security;

-- L'inserimento avviene al momento della registrazione (utente
-- non ancora confermato), quindi serve permesso per anon + authenticated.
drop policy if exists "iscritti_insert" on iscritti;
create policy "iscritti_insert" on iscritti
  for insert
  to anon, authenticated
  with check (true);

-- Solo gli utenti autenticati possono leggere l'elenco (es. te dal
-- pannello Supabase o da query). Modifica se vuoi regole diverse.
drop policy if exists "iscritti_select" on iscritti;
create policy "iscritti_select" on iscritti
  for select
  to authenticated
  using (true);
