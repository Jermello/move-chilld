-- =====================================================================
-- Move-Chilld — Supabase schema (MVP)
-- Run this in the Supabase SQL editor.
-- =====================================================================

-- ---------- profiles ------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('parent', 'driver')),
  full_name   text,
  push_token  text,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row on signup (default role = 'parent').
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'parent',
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- routes --------------------------------------------------
create table if not exists public.routes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  driver_id  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- stops ---------------------------------------------------
create table if not exists public.stops (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes (id) on delete cascade,
  name       text not null,
  lat        double precision not null,
  lng        double precision not null,
  stop_order integer not null,
  unique (route_id, stop_order)
);

-- ---------- children ------------------------------------------------
create table if not exists public.children (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references public.profiles (id) on delete cascade,
  route_id   uuid not null references public.routes (id) on delete cascade,
  stop_id    uuid not null references public.stops (id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now()
);

-- ---------- trip_sessions -------------------------------------------
create table if not exists public.trip_sessions (
  id         uuid primary key default gen_random_uuid(),
  route_id   uuid not null references public.routes (id) on delete cascade,
  driver_id  uuid not null references public.profiles (id) on delete cascade,
  status     text not null check (status in ('pending', 'active', 'completed'))
                              default 'pending',
  started_at timestamptz,
  ended_at   timestamptz,
  created_at timestamptz not null default now()
);

-- Only one active trip per route.
create unique index if not exists trip_sessions_one_active_per_route
  on public.trip_sessions (route_id)
  where status = 'active';

-- ---------- vehicle_locations ---------------------------------------
create table if not exists public.vehicle_locations (
  id              bigserial primary key,
  trip_session_id uuid not null references public.trip_sessions (id) on delete cascade,
  lat             double precision not null,
  lng             double precision not null,
  created_at      timestamptz not null default now()
);

create index if not exists vehicle_locations_trip_idx
  on public.vehicle_locations (trip_session_id, created_at desc);

-- ---------- stop_events ---------------------------------------------
create table if not exists public.stop_events (
  id              uuid primary key default gen_random_uuid(),
  trip_session_id uuid not null references public.trip_sessions (id) on delete cascade,
  stop_id         uuid not null references public.stops (id) on delete cascade,
  status          text not null check (status in ('pending', 'arrived'))
                                    default 'pending',
  arrived_at      timestamptz,
  unique (trip_session_id, stop_id)
);

-- =====================================================================
-- Row Level Security
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.routes            enable row level security;
alter table public.stops             enable row level security;
alter table public.children          enable row level security;
alter table public.trip_sessions     enable row level security;
alter table public.vehicle_locations enable row level security;
alter table public.stop_events       enable row level security;

-- profiles: each user reads/updates their own row
drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

-- routes: any authenticated user can read; driver can update their route
drop policy if exists "routes read"    on public.routes;
drop policy if exists "routes driver"  on public.routes;
create policy "routes read"   on public.routes for select to authenticated using (true);
create policy "routes driver" on public.routes for update using (auth.uid() = driver_id);

-- stops: any authenticated user can read
drop policy if exists "stops read" on public.stops;
create policy "stops read" on public.stops for select to authenticated using (true);

-- children: parents manage their own children
drop policy if exists "children read"   on public.children;
drop policy if exists "children write"  on public.children;
create policy "children read"  on public.children for select using (auth.uid() = parent_id);
create policy "children write" on public.children for all    using (auth.uid() = parent_id)
                                                    with check (auth.uid() = parent_id);

-- trip_sessions: all authenticated read; driver manages their own sessions
drop policy if exists "trips read"   on public.trip_sessions;
drop policy if exists "trips driver" on public.trip_sessions;
create policy "trips read"   on public.trip_sessions for select to authenticated using (true);
create policy "trips driver" on public.trip_sessions for all    using (auth.uid() = driver_id)
                                                        with check (auth.uid() = driver_id);

-- vehicle_locations: all authenticated read; only the trip's driver writes
drop policy if exists "locations read"  on public.vehicle_locations;
drop policy if exists "locations write" on public.vehicle_locations;
create policy "locations read" on public.vehicle_locations for select to authenticated using (true);
create policy "locations write" on public.vehicle_locations for insert with check (
  exists (
    select 1 from public.trip_sessions t
    where t.id = trip_session_id and t.driver_id = auth.uid()
  )
);

-- stop_events: all authenticated read; driver manages events for their trips
drop policy if exists "stop_events read"  on public.stop_events;
drop policy if exists "stop_events write" on public.stop_events;
create policy "stop_events read" on public.stop_events for select to authenticated using (true);
create policy "stop_events write" on public.stop_events for all using (
  exists (
    select 1 from public.trip_sessions t
    where t.id = trip_session_id and t.driver_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.trip_sessions t
    where t.id = trip_session_id and t.driver_id = auth.uid()
  )
);

-- =====================================================================
-- Realtime: publish the tables parents need to watch
-- =====================================================================
alter publication supabase_realtime add table public.vehicle_locations;
alter publication supabase_realtime add table public.trip_sessions;
alter publication supabase_realtime add table public.stop_events;
