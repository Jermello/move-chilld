-- =====================================================================
-- Move-Chilld — Migration: profile.email + name at signup
-- Run once in the Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- =====================================================================

-- 1. Ajouter la colonne email sur profiles (nullable)
alter table public.profiles add column if not exists email text;

-- 2. Backfill : recopier les emails existants depuis auth.users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- 3. Nouveau trigger : lit intended_role + full_name + email depuis auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'intended_role', 'parent');
  if v_role not in ('parent', 'driver') then
    v_role := 'parent';
  end if;

  insert into public.profiles (id, role, email, full_name)
  values (
    new.id,
    v_role,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- =====================================================================
-- Cleanup : supprimer tous les users SAUF les admins
-- ATTENTION : cascade sur profiles (FK on delete cascade) → children, etc.
-- À ne lancer qu'après avoir vérifié qu'au moins un admin existe.
-- =====================================================================

-- Sécurité : refuse si aucun admin n'est défini
do $$
declare
  admin_count int;
begin
  select count(*) into admin_count
  from public.profiles
  where role = 'admin';

  if admin_count = 0 then
    raise exception 'Aucun admin trouvé — refus de tout supprimer. Promote ton compte admin avant.';
  end if;
end $$;

-- Supprime les users non-admin (cascade sur profiles, children, push tokens…)
delete from auth.users
where id not in (
  select id from public.profiles where role = 'admin'
);

-- Vérification
select id, email, role, full_name from public.profiles order by role;
