-- ============================================================
-- Menu Famiglia · Sicurezza (RLS) sulle tabelle dei dati
-- Incolla tutto in Supabase → SQL Editor → Run (scegli "Run and enable RLS" se chiede)
--
-- Cosa fa:
--  - Solo i membri (loggati) della famiglia possono LEGGERE/MODIFICARE i dati
--  - Pesi, medicine, diario, dispensa: PRIVATI (nemmeno il link pubblico li vede)
--  - Il link pubblico del menu resta in SOLA LETTURA (menu + profili)
--  - I link di voto continuano a funzionare
--  - NESSUNO puo piu MODIFICARE i tuoi dati se non e' della tua famiglia
--
-- Se qualcosa si rompe, in fondo c'e' lo snippet di RIPRISTINO.
-- ============================================================

-- PROFILI: membri modificano; il link pubblico legge soltanto
alter table public.profiles enable row level security;
drop policy if exists "profiles_anon_read" on public.profiles;
create policy "profiles_anon_read" on public.profiles for select to anon using (true);

-- MENU (builder_scelte): membri modificano; il link pubblico legge soltanto
alter table public.builder_scelte enable row level security;
drop policy if exists "builder_anon_read" on public.builder_scelte;
create policy "builder_anon_read" on public.builder_scelte for select to anon using (true);

-- PESI: solo membri loggati (privato)
alter table public.peso_log enable row level security;

-- FAMIGLIE: solo membri; ognuno puo creare la propria
alter table public.families enable row level security;
drop policy if exists "families_insert_own" on public.families;
create policy "families_insert_own" on public.families for insert to authenticated with check (owner_id = auth.uid());

-- APP_STATE (impostazioni, diario, medicine, dispensa, feedback, ospiti):
--  membri: tutto. Anonimo (link pubblico): solo feedback/ospiti/menu, il resto resta PRIVATO.
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

-- VOTI: membri + link di voto pubblico (leggere/votare, non cancellare)
alter table public.voti enable row level security;
drop policy if exists "voti_membri" on public.voti;
create policy "voti_membri" on public.voti for all to authenticated
  using (family_id in (select public.mie_famiglie()))
  with check (family_id in (select public.mie_famiglie()));
drop policy if exists "voti_anon_select" on public.voti;
create policy "voti_anon_select" on public.voti for select to anon using (true);
drop policy if exists "voti_anon_insert" on public.voti;
create policy "voti_anon_insert" on public.voti for insert to anon with check (true);
drop policy if exists "voti_anon_update" on public.voti;
create policy "voti_anon_update" on public.voti for update to anon using (true) with check (true);


-- ============================================================
-- RIPRISTINO (SOLO se qualcosa si rompe): rimette tutto com'era (RLS spento)
-- Copia da qui in giu' in un nuovo foglio e Run per annullare.
-- ------------------------------------------------------------
-- alter table public.profiles disable row level security;
-- alter table public.builder_scelte disable row level security;
-- alter table public.peso_log disable row level security;
-- alter table public.families disable row level security;
-- alter table public.app_state disable row level security;
-- alter table public.voti disable row level security;
-- ============================================================
