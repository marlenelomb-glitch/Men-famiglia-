-- ============================================================
-- Menu Famiglia · FIX tabella profili
-- Incolla tutto in Supabase → SQL Editor → Run
--
-- Problema: la tabella "profiles" era stata creata con una struttura
-- vecchia (senza la colonna profile_id), quindi l'app non riusciva a
-- salvare i profili sul cloud (errore: column profiles.profile_id does not exist).
--
-- Questa query ricrea "profiles" con la struttura giusta.
-- I profili sul telefono NON si perdono: dopo il Run basta premere
-- "Sincronizza tutto sul cloud" e ripartono da soli.
-- ============================================================

-- Ricrea la tabella con lo schema corretto
drop table if exists public.profiles cascade;

create table public.profiles (
  family_id   uuid not null,
  profile_id  text not null,
  dati        jsonb,
  updated_at  timestamptz default now(),
  primary key (family_id, profile_id)
);

-- Sicurezza (RLS): solo i membri della famiglia scrivono; il link pubblico legge
alter table public.profiles enable row level security;

drop policy if exists "profiles_membri" on public.profiles;
create policy "profiles_membri" on public.profiles for all to authenticated
  using (family_id in (select public.mie_famiglie()))
  with check (family_id in (select public.mie_famiglie()));

drop policy if exists "profiles_anon_read" on public.profiles;
create policy "profiles_anon_read" on public.profiles for select to anon using (true);
