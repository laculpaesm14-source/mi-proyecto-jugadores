create table if not exists public.players (
  user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  name text not null,
  photo text not null default '',
  nationality text not null,
  nationality_code text not null default '',
  team text not null,
  team_badge text not null default '',
  position text not null check (position in ('arquero', 'defensa', 'medio campo', 'delantero', 'tecnico')),
  age integer not null check (age between 15 and 50),
  is_deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.players enable row level security;
revoke all on table public.players from anon, authenticated;
grant select, insert, update on table public.players to authenticated;

drop policy if exists "Users can read their own players" on public.players;
create policy "Users can read their own players"
  on public.players for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own players" on public.players;
create policy "Users can add their own players"
  on public.players for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own players" on public.players;
create policy "Users can update their own players"
  on public.players for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.user_lineups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  formation text not null default '4-4-2'
    check (formation in ('4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2')),
  lineup jsonb not null default '{}'::jsonb,
  coach_id bigint,
  updated_at timestamptz not null default now()
);

alter table public.user_lineups enable row level security;
revoke all on table public.user_lineups from anon, authenticated;
grant select, insert, update on table public.user_lineups to authenticated;

drop policy if exists "Users can read their own lineups" on public.user_lineups;
create policy "Users can read their own lineups"
  on public.user_lineups for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own lineups" on public.user_lineups;
create policy "Users can add their own lineups"
  on public.user_lineups for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own lineups" on public.user_lineups;
create policy "Users can update their own lineups"
  on public.user_lineups for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;
end
$$;
