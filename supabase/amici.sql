-- ============================================================
-- Menu Famiglia · Amici (Passo 1: nome utente + amicizie)
-- Incolla tutto questo in Supabase → SQL Editor → Run
-- ============================================================

-- 1) Tabella UTENTI: nome utente cercabile legato all'account
create table if not exists public.utenti (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  nome        text,
  family_id   uuid,
  created_at  timestamptz default now()
);

-- indice per ricerca veloce e case-insensitive
create index if not exists utenti_username_idx on public.utenti (lower(username));

alter table public.utenti enable row level security;

-- chiunque sia autenticato può cercare gli utenti (serve per trovarsi)
drop policy if exists "utenti_select_auth" on public.utenti;
create policy "utenti_select_auth" on public.utenti
  for select to authenticated using (true);

-- ognuno può creare/aggiornare solo la propria riga
drop policy if exists "utenti_insert_own" on public.utenti;
create policy "utenti_insert_own" on public.utenti
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "utenti_update_own" on public.utenti;
create policy "utenti_update_own" on public.utenti
  for update to authenticated using (user_id = auth.uid());


-- 2) Tabella AMICIZIE: richieste e amici accettati
create table if not exists public.amicizie (
  id            uuid primary key default gen_random_uuid(),
  richiedente   uuid not null references auth.users(id) on delete cascade,
  destinatario  uuid not null references auth.users(id) on delete cascade,
  stato         text not null default 'in_attesa',   -- 'in_attesa' | 'accettata'
  created_at    timestamptz default now(),
  unique (richiedente, destinatario)
);

alter table public.amicizie enable row level security;

-- vedo solo le amicizie che mi riguardano
drop policy if exists "amicizie_select_mine" on public.amicizie;
create policy "amicizie_select_mine" on public.amicizie
  for select to authenticated using (richiedente = auth.uid() or destinatario = auth.uid());

-- posso creare una richiesta solo a nome mio
drop policy if exists "amicizie_insert_mine" on public.amicizie;
create policy "amicizie_insert_mine" on public.amicizie
  for insert to authenticated with check (richiedente = auth.uid());

-- posso accettare/aggiornare solo se sono coinvolto
drop policy if exists "amicizie_update_mine" on public.amicizie;
create policy "amicizie_update_mine" on public.amicizie
  for update to authenticated using (richiedente = auth.uid() or destinatario = auth.uid());

-- posso cancellare (rifiutare/rimuovere) solo se sono coinvolto
drop policy if exists "amicizie_delete_mine" on public.amicizie;
create policy "amicizie_delete_mine" on public.amicizie
  for delete to authenticated using (richiedente = auth.uid() or destinatario = auth.uid());
