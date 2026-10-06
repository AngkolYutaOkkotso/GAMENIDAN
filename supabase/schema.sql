-- Run once in Supabase -> SQL Editor
create table if not exists public.player_saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,   -- the whole save (progress, inventory, gacha pity + history)
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

-- each player can only touch their own row
create policy "read own save"   on public.player_saves for select using (auth.uid() = user_id);
create policy "insert own save" on public.player_saves for insert with check (auth.uid() = user_id);
create policy "update own save" on public.player_saves for update using (auth.uid() = user_id);
