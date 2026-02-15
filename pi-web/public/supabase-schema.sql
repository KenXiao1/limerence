-- ============================================================
-- Limerence Supabase Schema
-- 用户需在 Supabase SQL Editor 中执行此文件
-- ============================================================

-- ── 1. user_profiles ────────────────────────────────────────

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

-- ── 2. sync_sessions (完整会话数据) ─────────────────────────

create table if not exists public.sync_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.sync_sessions enable row level security;

create policy "Users can manage own sessions"
  on public.sync_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 3. sync_sessions_metadata (轻量元数据) ──────────────────

create table if not exists public.sync_sessions_metadata (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null default '',
  created_at timestamptz not null default now(),
  model text not null default '',
  message_count int not null default 0,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.sync_sessions_metadata enable row level security;

create policy "Users can manage own session metadata"
  on public.sync_sessions_metadata for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 4. sync_memory ──────────────────────────────────────────

create table if not exists public.sync_memory (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  session_id text not null default '',
  role text not null default '',
  content text not null default '',
  timestamp text not null default '',
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.sync_memory enable row level security;

create policy "Users can manage own memory"
  on public.sync_memory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 5. sync_notes ───────────────────────────────────────────

create table if not exists public.sync_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, key)
);

alter table public.sync_notes enable row level security;

create policy "Users can manage own notes"
  on public.sync_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 6. sync_files ───────────────────────────────────────────

create table if not exists public.sync_files (
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, path)
);

alter table public.sync_files enable row level security;

create policy "Users can manage own files"
  on public.sync_files for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 7. sync_characters ──────────────────────────────────────

create table if not exists public.sync_characters (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.sync_characters enable row level security;

create policy "Users can manage own characters"
  on public.sync_characters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 8. sync_lorebook ────────────────────────────────────────

create table if not exists public.sync_lorebook (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.sync_lorebook enable row level security;

create policy "Users can manage own lorebook"
  on public.sync_lorebook for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Auto-update updated_at trigger ──────────────────────────

create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'sync_sessions', 'sync_sessions_metadata', 'sync_memory',
    'sync_notes', 'sync_files', 'sync_characters', 'sync_lorebook'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.update_updated_at()',
      tbl
    );
  end loop;
end;
$$;

-- ── Auto-create user_profiles on signup ─────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── touch_active RPC ────────────────────────────────────────

create or replace function public.touch_active()
returns void as $$
begin
  update public.user_profiles
  set last_active_at = now()
  where id = auth.uid();
end;
$$ language plpgsql security definer;

-- ── pg_cron: 每天 03:00 UTC 删除 15 天不活跃用户 ────────────
-- 注意：需要先在 Supabase Dashboard 中启用 pg_cron 扩展

 select cron.schedule(
   'delete-inactive-users',
   '0 3 * * *',
   $$
     delete from auth.users
     where id in (
       select id from public.user_profiles
       where last_active_at < now() - interval '15 days'
     );
   $$
);

-- ── Realtime publication ────────────────────────────────────

alter publication supabase_realtime add table public.sync_sessions;
alter publication supabase_realtime add table public.sync_sessions_metadata;
alter publication supabase_realtime add table public.sync_memory;
alter publication supabase_realtime add table public.sync_notes;
alter publication supabase_realtime add table public.sync_files;
alter publication supabase_realtime add table public.sync_characters;
alter publication supabase_realtime add table public.sync_lorebook;
