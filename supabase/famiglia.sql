-- ============================================================
-- Menu Famiglia · Famiglia condivisa tra account
-- Incolla tutto in Supabase → SQL Editor → Run
-- (fa entrare piu account, es. moglie + marito, nella stessa famiglia)
-- ============================================================

-- 1) MEMBRI della famiglia (oltre al proprietario)
create table if not exists public.membri_famiglia (
  family_id   uuid not null references public.families(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  ruolo       text not null default 'membro',
  created_at  timestamptz default now(),
  primary key (family_id, user_id)
);
alter table public.membri_famiglia enable row level security;

-- vedo le mie appartenenze; il proprietario vede i membri della sua famiglia
drop policy if exists "mf_select" on public.membri_famiglia;
create policy "mf_select" on public.membri_famiglia
  for select to authenticated
  using (user_id = auth.uid()
         or family_id in (select id from public.families where owner_id = auth.uid()));

-- posso aggiungere solo me stesso (quando inserisco il codice)
drop policy if exists "mf_insert_self" on public.membri_famiglia;
create policy "mf_insert_self" on public.membri_famiglia
  for insert to authenticated with check (user_id = auth.uid());

-- posso togliere me stesso; il proprietario puo togliere i membri
drop policy if exists "mf_delete" on public.membri_famiglia;
create policy "mf_delete" on public.membri_famiglia
  for delete to authenticated
  using (user_id = auth.uid()
         or family_id in (select id from public.families where owner_id = auth.uid()));


-- 2) CODICI INVITO (uno per famiglia)
create table if not exists public.famiglia_inviti (
  family_id   uuid primary key references public.families(id) on delete cascade,
  codice      text unique not null,
  created_at  timestamptz default now()
);
alter table public.famiglia_inviti enable row level security;

-- chiunque sia autenticato puo risolvere un codice ricevuto (i codici sono casuali)
drop policy if exists "inv_select" on public.famiglia_inviti;
create policy "inv_select" on public.famiglia_inviti
  for select to authenticated using (true);

-- solo il proprietario crea/aggiorna il codice della sua famiglia
drop policy if exists "inv_insert_owner" on public.famiglia_inviti;
create policy "inv_insert_owner" on public.famiglia_inviti
  for insert to authenticated
  with check (family_id in (select id from public.families where owner_id = auth.uid()));

drop policy if exists "inv_update_owner" on public.famiglia_inviti;
create policy "inv_update_owner" on public.famiglia_inviti
  for update to authenticated
  using (family_id in (select id from public.families where owner_id = auth.uid()));


-- 3) ACCESSO DEI MEMBRI AI DATI DELLA FAMIGLIA
-- Queste policy sono ADDITIVE: concedono l'accesso a proprietario + membri.
-- Se sulle tabelle RLS e' spento, sono inerti (non rompono nulla).
-- Se RLS e' acceso, fanno vedere/modificare i dati della famiglia condivisa.
-- La condizione include SEMPRE il proprietario, quindi non ti blocca mai fuori.

-- funzione helper: le famiglie a cui l'utente ha accesso (proprietario o membro)
create or replace function public.mie_famiglie()
returns setof uuid language sql stable security definer as $$
  select id from public.families where owner_id = auth.uid()
  union
  select family_id from public.membri_famiglia where user_id = auth.uid()
$$;

-- profiles
drop policy if exists "profiles_membri" on public.profiles;
create policy "profiles_membri" on public.profiles for all to authenticated
  using (family_id in (select public.mie_famiglie()))
  with check (family_id in (select public.mie_famiglie()));

-- builder_scelte
drop policy if exists "builder_membri" on public.builder_scelte;
create policy "builder_membri" on public.builder_scelte for all to authenticated
  using (family_id in (select public.mie_famiglie()))
  with check (family_id in (select public.mie_famiglie()));

-- app_state
drop policy if exists "appstate_membri" on public.app_state;
create policy "appstate_membri" on public.app_state for all to authenticated
  using (family_id in (select public.mie_famiglie()))
  with check (family_id in (select public.mie_famiglie()));

-- peso_log
drop policy if exists "peso_membri" on public.peso_log;
create policy "peso_membri" on public.peso_log for all to authenticated
  using (family_id in (select public.mie_famiglie()))
  with check (family_id in (select public.mie_famiglie()));

-- families (il membro deve poter leggere la riga della famiglia condivisa)
drop policy if exists "families_membri" on public.families;
create policy "families_membri" on public.families for select to authenticated
  using (id in (select public.mie_famiglie()));
