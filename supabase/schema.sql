-- Tee Game Multiplayer MVP Schema
-- Run this in Supabase SQL Editor, then REFRESH the Table Editor.
-- Casual MVP security: RLS prevents basic abuse but is NOT cheat-proof.

-- ============================================================
-- TABLE: tee_rooms
-- ============================================================
create table if not exists public.tee_rooms (
  room_code       text primary key,
  status          text not null default 'lobby',
  host_id         uuid not null,
  guest_id        uuid,
  host_name       text not null default 'Host',
  guest_name      text,
  course_version  text not null default 'tee-v1',
  hole_index      integer not null default 0,
  active_player_id uuid,
  turn_number     integer not null default 0,
  state           jsonb not null default '{}'::jsonb,
  live_aim        jsonb,
  latest_shot     jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '24 hours')
);

-- Add check constraint separately (safer to re-run)
alter table public.tee_rooms
  drop constraint if exists tee_rooms_status_check;

alter table public.tee_rooms
  add constraint tee_rooms_status_check
  check (status in ('lobby','coin_toss','playing','finished','expired'));

-- ============================================================
-- RLS: Enable
-- ============================================================
alter table public.tee_rooms enable row level security;

-- ============================================================
-- RLS: Policies
-- ============================================================

-- Anyone authenticated can read non-expired rooms (for joining via code)
drop policy if exists "read_non_expired" on public.tee_rooms;
create policy "read_non_expired"
  on public.tee_rooms for select
  to authenticated
  using (expires_at > now());

-- Authenticated users can insert rooms where they are host
drop policy if exists "insert_as_host" on public.tee_rooms;
create policy "insert_as_host"
  on public.tee_rooms for insert
  to authenticated
  with check (host_id = auth.uid());

-- Host or guest can update rooms they belong to
drop policy if exists "update_as_member" on public.tee_rooms;
create policy "update_as_member"
  on public.tee_rooms for update
  to authenticated
  using (auth.uid() = host_id or auth.uid() = guest_id)
  with check (auth.uid() = host_id or auth.uid() = guest_id);

-- Anyone authenticated can join an open room (set guest_id if null)
drop policy if exists "join_open_room" on public.tee_rooms;
create policy "join_open_room"
  on public.tee_rooms for update
  to authenticated
  using (guest_id is null and status = 'lobby' and auth.uid() != host_id)
  with check (guest_id = auth.uid() and status in ('lobby', 'coin_toss'));

-- Host can delete their own rooms
drop policy if exists "delete_as_host" on public.tee_rooms;
create policy "delete_as_host"
  on public.tee_rooms for delete
  to authenticated
  using (host_id = auth.uid());

-- ============================================================
-- Grants
-- ============================================================
grant select, insert, update, delete on public.tee_rooms to authenticated;

-- ============================================================
-- Trigger: auto-update updated_at
-- ============================================================
create or replace function public.update_tee_rooms_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tee_rooms_updated_at on public.tee_rooms;
create trigger tee_rooms_updated_at
  before update on public.tee_rooms
  for each row
  execute function public.update_tee_rooms_updated_at();

-- ============================================================
-- Realtime: Add table to publication
-- ============================================================
-- Run this separately if the table doesn't appear in Realtime:
-- alter publication supabase_realtime add table public.tee_rooms;

-- ============================================================
-- Cleanup (run manually if needed):
-- ============================================================
-- delete from public.tee_rooms where expires_at < now();
