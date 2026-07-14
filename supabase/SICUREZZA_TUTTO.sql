-- ============================================================
-- Menu Famiglia · SICUREZZA COMPLETA (un solo colpo)
-- ------------------------------------------------------------
-- COSA FA: accende la protezione (Row-Level Security) su TUTTE
-- le tabelle e mette le regole giuste, cosi' spariscono gli
-- avvisi "Table publicly accessible" di Supabase.
--
-- E' SICURO:
--  - Non cancella nessun dato.
--  - Si puo' incollare e premere Run anche piu' volte (idempotente).
--  - I tuoi dati (pesi, diario, medicine, dispensa) restano PRIVATI.
--  - Il link pubblico del menu resta in SOLA LETTURA.
--  - I link di voto del partner continuano a funzionare.
--
-- COME SI USA:
--  1) Apri Supabase → progetto Menu famiglia → SQL Editor
--  2) Nuovo foglio → incolla TUTTO questo testo
--  3) Premi Run
--
-- Se qualcosa si rompe, in fondo c'e' lo snippet di RIPRISTINO.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 0) Tabelle (create solo se mancano: se esistono, non le tocca)
-- ------------------------------------------------------------
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  nome text,
  created_at timestamptz default now()
);

create table if not exists public.membri_famiglia (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ruolo text not null default 'membro',
  created_at timestamptz default now(),
  primary key (family_id, user_id)
);

create table if not exists public.famiglia_inviti (
  family_id uuid primary key references public.families(id) on delete cascade,
  codice text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  family_id uuid not null,
  profile_id text not null,
  dati jsonb,
  updated_at timestamptz default now(),
  primary key (family_id, profile_id)
);

create table if not exists public.builder_scelte (
  family_id uuid not null,
  settimana int not null default 0,
  giorno text not null,
  pasto text not null,
  dati jsonb,
  updated_at timestamptz default now(),
  primary key (family_id, settimana, giorno, pasto)
);

create table if not exists public.peso_log (
  family_id uuid not null,
  profile_nome text not null,
  data text not null,
  valore numeric,
  updated_at timestamptz default now(),
  primary key (family_id, profile_nome, data)
);

create table if not exists public.app_state (
  family_id uuid not null,
  chiave text not null,
  dati jsonb,
  updated_at timestamptz default now(),
  primary key (family_id, chiave)
);

create table if not exists public.voti (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  giorno text not null,
  opzioni jsonb,
  scelta text,
  updated_at timestamptz default now(),
  unique (family_id, giorno)
);

create table if not exists public.community (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  family_id uuid,
  patologia text not null,
  tipo text not null default 'consiglio',
  titolo text not null,
  testo text default '',
  autore text default '',
  pubblica boolean default true,
  foto text,
  proteine text,
  dove text,
  created_at timestamptz default now()
);

create table if not exists public.utenti (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  nome text,
  family_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.amicizie (
  id uuid primary key default gen_random_uuid(),
  richiedente uuid not null references auth.users(id) on delete cascade,
  destinatario uuid not null references auth.users(id) on delete cascade,
  stato text not null default 'in_attesa',
  created_at timestamptz default now(),
  unique (richiedente, destinatario)
);

create table if not exists public.iscritti (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 1) Helper: le famiglie a cui l'utente ha accesso (proprietario o membro)
-- ------------------------------------------------------------
create or replace function public.mie_famiglie()
returns setof uuid language sql stable security definer as $$
  select id from public.families where owner_id = auth.uid()
  union
  select family_id from public.membri_famiglia where user_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- 2) Accendi RLS su tutte le tabelle
-- ------------------------------------------------------------
alter table public.families enable row level security;
alter table public.membri_famiglia enable row level security;
alter table public.famiglia_inviti enable row level security;
alter table public.profiles enable row level security;
alter table public.builder_scelte enable row level security;
alter table public.peso_log enable row level security;
alter table public.app_state enable row level security;
alter table public.voti enable row level security;
alter table public.community enable row level security;
alter table public.utenti enable row level security;
alter table public.amicizie enable row level security;
alter table public.iscritti enable row level security;

-- ------------------------------------------------------------
-- 3) Regole (policy)
-- ------------------------------------------------------------

-- FAMILIES: il proprietario gestisce la sua; i membri la leggono
drop policy if exists "families_owner" on public.families;
create policy "families_owner" on public.families for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "families_membri" on public.families;
create policy "families_membri" on public.families for select to authenticated
  using (id in (select public.mie_famiglie()));

-- MEMBRI_FAMIGLIA
drop policy if exists "mf_select" on public.membri_famiglia;
create policy "mf_select" on public.membri_famiglia for select to authenticated
  using (user_id = auth.uid()
         or family_id in (select id from public.families where owner_id = auth.uid()));
drop policy if exists "mf_insert_self" on public.membri_famiglia;
create policy "mf_insert_self" on public.membri_famiglia for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "mf_delete" on public.membri_famiglia;
create policy "mf_delete" on public.membri_famiglia for delete to authenticated
  using (user_id = auth.uid()
         or family_id in (select id from public.families where owner_id = auth.uid()));

-- FAMIGLIA_INVITI
drop policy if exists "inv_select" on public.famiglia_inviti;
create policy "inv_select" on public.famiglia_inviti for select to authenticated using (true);
drop policy if exists "inv_insert_owner" on public.famiglia_inviti;
create policy "inv_insert_owner" on public.famiglia_inviti for insert to authenticated
  with check (family_id in (select id from public.families where owner_id = auth.uid()));
drop policy if exists "inv_update_owner" on public.famiglia_inviti;
create policy "inv_update_owner" on public.famiglia_inviti for update to authenticated
  using (family_id in (select id from public.families where owner_id = auth.uid()));

-- PROFILES: membri scrivono; il link pubblico legge soltanto
drop policy if exists "profiles_membri" on public.profiles;
create policy "profiles_membri" on public.profiles for all to authenticated
  using (family_id in (select public.mie_famiglie()))
  with check (family_id in (select public.mie_famiglie()));
drop policy if exists "profiles_anon_read" on public.profiles;
create policy "profiles_anon_read" on public.profiles for select to anon using (true);

-- BUILDER_SCELTE (menu): membri scrivono; il link pubblico legge soltanto
drop policy if exists "builder_membri" on public.builder_scelte;
create policy "builder_membri" on public.builder_scelte for all to authenticated
  using (family_id in (select public.mie_famiglie()))
  with check (family_id in (select public.mie_famiglie()));
drop policy if exists "builder_anon_read" on public.builder_scelte;
create policy "builder_anon_read" on public.builder_scelte for select to anon using (true);

-- PESO_LOG: solo membri (privato)
drop policy if exists "peso_membri" on public.peso_log;
create policy "peso_membri" on public.peso_log for all to authenticated
  using (family_id in (select public.mie_famiglie()))
  with check (family_id in (select public.mie_famiglie()));

-- APP_STATE (diario, medicine, dispensa, spesa, feedback, ospiti, menu):
--  membri: tutto. Link pubblico: legge solo menu/feedback/ospiti; il resto PRIVATO.
drop policy if exists "appstate_membri" on public.app_state;
create policy "appstate_membri" on public.app_state for all to authenticated
  using (family_id in (select public.mie_famiglie()))
  with check (family_id in (select public.mie_famiglie()));
drop policy if exists "appstate_anon_read" on public.app_state;
create policy "appstate_anon_read" on public.app_state for select to anon
  using (chiave in ('feedbackPasti','ospiti','menuOverride'));
drop policy if exists "appstate_anon_insert" on public.app_state;
create policy "appstate_anon_insert" on public.app_state for insert to anon
  with check (chiave in ('feedbackPasti','ospiti'));
drop policy if exists "appstate_anon_update" on public.app_state;
create policy "appstate_anon_update" on public.app_state for update to anon
  using (chiave in ('feedbackPasti','ospiti'))
  with check (chiave in ('feedbackPasti','ospiti'));

-- VOTI: il partner apre il link senza login e vota (permissivo per disegno)
drop policy if exists "voti_all" on public.voti;
create policy "voti_all" on public.voti for all to anon, authenticated
  using (true) with check (true);

-- COMMUNITY: post pubblici visibili a tutti i loggati; i privati solo all'autore
drop policy if exists community_select on public.community;
create policy community_select on public.community for select to authenticated
  using (pubblica = true or user_id = auth.uid());
drop policy if exists community_insert on public.community;
create policy community_insert on public.community for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists community_delete on public.community;
create policy community_delete on public.community for delete to authenticated
  using (user_id = auth.uid());

-- UTENTI (nome utente cercabile)
drop policy if exists "utenti_select_auth" on public.utenti;
create policy "utenti_select_auth" on public.utenti for select to authenticated using (true);
drop policy if exists "utenti_insert_own" on public.utenti;
create policy "utenti_insert_own" on public.utenti for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "utenti_update_own" on public.utenti;
create policy "utenti_update_own" on public.utenti for update to authenticated
  using (user_id = auth.uid());

-- AMICIZIE
drop policy if exists "amicizie_select_mine" on public.amicizie;
create policy "amicizie_select_mine" on public.amicizie for select to authenticated
  using (richiedente = auth.uid() or destinatario = auth.uid());
drop policy if exists "amicizie_insert_mine" on public.amicizie;
create policy "amicizie_insert_mine" on public.amicizie for insert to authenticated
  with check (richiedente = auth.uid());
drop policy if exists "amicizie_update_mine" on public.amicizie;
create policy "amicizie_update_mine" on public.amicizie for update to authenticated
  using (richiedente = auth.uid() or destinatario = auth.uid());
drop policy if exists "amicizie_delete_mine" on public.amicizie;
create policy "amicizie_delete_mine" on public.amicizie for delete to authenticated
  using (richiedente = auth.uid() or destinatario = auth.uid());

-- ISCRITTI: registrazione (anche non ancora confermata) puo' inserire; legge solo loggato
drop policy if exists "iscritti_insert" on public.iscritti;
create policy "iscritti_insert" on public.iscritti for insert to anon, authenticated
  with check (true);
drop policy if exists "iscritti_select" on public.iscritti;
create policy "iscritti_select" on public.iscritti for select to authenticated using (true);


-- ============================================================
-- RIPRISTINO (SOLO se qualcosa si rompe): spegne di nuovo RLS.
-- Copia le righe qui sotto (togli il -- davanti) in un nuovo foglio e Run.
-- ------------------------------------------------------------
-- alter table public.families disable row level security;
-- alter table public.membri_famiglia disable row level security;
-- alter table public.famiglia_inviti disable row level security;
-- alter table public.profiles disable row level security;
-- alter table public.builder_scelte disable row level security;
-- alter table public.peso_log disable row level security;
-- alter table public.app_state disable row level security;
-- alter table public.voti disable row level security;
-- alter table public.community disable row level security;
-- alter table public.utenti disable row level security;
-- alter table public.amicizie disable row level security;
-- alter table public.iscritti disable row level security;
-- ============================================================
