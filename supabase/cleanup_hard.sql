-- =====================================================================
-- Move-Chilld — Nettoyage forcé (hard delete + identities)
-- À utiliser quand un email reste "already registered" malgré une
-- suppression précédente.
--
-- Garde-fou : refuse si aucun admin n'est défini dans profiles.
-- =====================================================================

-- 1. Vérifier qu'au moins un admin existe (sinon on annule)
do $$
declare
  admin_count int;
begin
  select count(*) into admin_count
  from public.profiles
  where role = 'admin';

  if admin_count = 0 then
    raise exception 'Aucun admin trouvé — refus de tout supprimer.';
  end if;
end $$;

-- 2. Supprimer les identities des users non-admin
delete from auth.identities
where user_id not in (
  select id from public.profiles where role = 'admin'
);

-- 3. Hard delete des users non-admin (cascade sur profiles, children, etc.)
delete from auth.users
where id not in (
  select id from public.profiles where role = 'admin'
);

-- 4. Filet : si Supabase a soft-deleted des users (deleted_at non-null)
--    qui ne sont PAS dans profiles, on les hard delete aussi
delete from auth.users
where deleted_at is not null
  and id not in (select id from public.profiles);

-- 5. Vérification finale
select id, email, role, full_name from public.profiles order by role;
select id, email, deleted_at from auth.users order by created_at desc;
