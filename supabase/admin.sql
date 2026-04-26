-- =====================================================================
-- Move-Chilld — Admin layer
-- Idempotent: tu peux re-run sans risque.
--
-- 'admin' est un rôle à part entière (pas parent, pas chauffeur).
-- =====================================================================

-- ---------- 1. Étendre le rôle pour accepter 'admin' ----------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('parent', 'driver', 'admin'));

-- ---------- 2. Migrer l'ancien flag booléen vers le rôle ------------
-- (si tu avais déjà lancé la v1 de ce script avec is_admin)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name  = 'profiles'
      and column_name = 'is_admin'
  ) then
    update public.profiles set role = 'admin' where is_admin = true;
    alter table public.profiles drop column is_admin;
  end if;
end $$;

-- ---------- 3. Helper is_admin() ------------------------------------
-- SECURITY DEFINER pour éviter la récursion RLS quand une policy
-- interroge `profiles` pour savoir si l'appelant est admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------- 4. Admin bypass policies --------------------------------
-- RLS est permissive: une row passe si AU MOINS UNE policy l'autorise.
-- On s'empile donc par-dessus les policies existantes.

drop policy if exists "admin all profiles"          on public.profiles;
drop policy if exists "admin all routes"            on public.routes;
drop policy if exists "admin all stops"             on public.stops;
drop policy if exists "admin all children"          on public.children;
drop policy if exists "admin all trip_sessions"     on public.trip_sessions;
drop policy if exists "admin all vehicle_locations" on public.vehicle_locations;
drop policy if exists "admin all stop_events"       on public.stop_events;

create policy "admin all profiles"          on public.profiles          for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all routes"            on public.routes            for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all stops"             on public.stops             for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all children"          on public.children          for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all trip_sessions"     on public.trip_sessions     for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all vehicle_locations" on public.vehicle_locations for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all stop_events"       on public.stop_events       for all using (public.is_admin()) with check (public.is_admin());

-- ---------- 5. RPC: liste des users avec email ----------------------
-- Les clients ne peuvent pas lire auth.users. On expose une fonction
-- réservée aux admins qui joint profiles + auth.users.

drop function if exists public.admin_list_users();

create or replace function public.admin_list_users()
returns table (
  id        uuid,
  email     text,
  role      text,
  full_name text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id, u.email, p.role, p.full_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.full_name nulls last;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- =====================================================================
-- Bootstrap: se promouvoir admin (à lancer une seule fois)
-- Remplace l'UUID par le tien.
-- =====================================================================

-- update public.profiles set role = 'admin'
--   where id = '81d84bae-580d-4330-9761-1bba9eb19bf8';
