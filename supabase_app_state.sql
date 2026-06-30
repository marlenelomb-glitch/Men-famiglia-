-- ============================================================
-- Tabella "app_state" per Menu Famiglia
-- Sincronizza su Supabase i dati che prima vivevano solo nel
-- browser: dispensa, lista spesa, meal prep, giorni fuori,
-- override del menu. Una riga per (famiglia, chiave) con JSON.
-- Esegui nel SQL Editor di Supabase.
-- ============================================================

create table if not exists app_state (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid references families(id) on delete cascade,
  chiave      text not null,
  dati        jsonb,
  updated_at  timestamptz default now(),
  unique (family_id, chiave)
);

alter table app_state enable row level security;

drop policy if exists "app_state_all" on app_state;
create policy "app_state_all" on app_state
  for all
  to authenticated
  using (true)
  with check (true);
