-- =====================================================================
-- Move-Chilld — Seed data for a smoke test.
-- Pré-rempli pour le projet actuel :
--   driver : Ronen   → fde25e43-8f03-43b9-8451-68e7bc0e3958
--   parent : Jeremy  → 81d84bae-580d-4330-9761-1bba9eb19bf8
-- Re-runnable: nettoie les anciennes données de test avant de recréer.
-- =====================================================================

-- Nettoyage idempotent (supprime la route de test précédente et son contenu)
delete from public.children
 where parent_id = '81d84bae-580d-4330-9761-1bba9eb19bf8';

delete from public.routes
 where name = 'Route matin – Secteur Centre';

-- 1) Promote Ronen as driver
update public.profiles
set role = 'driver', full_name = 'Ronen (Chauffeur)'
where id = 'fde25e43-8f03-43b9-8451-68e7bc0e3958';

-- 2) Create the route + its stops + link Jeremy's child to stop #2
with new_route as (
  insert into public.routes (name, driver_id)
  values ('Route matin – Secteur Centre', 'fde25e43-8f03-43b9-8451-68e7bc0e3958')
  returning id
),
new_stops as (
  insert into public.stops (route_id, name, lat, lng, stop_order)
  select id, name, lat, lng, stop_order
  from new_route, (values
    ('Place de la République', 48.8671, 2.3630, 1),
    ('Gare du Nord',           48.8809, 2.3553, 2),
    ('Place de Clichy',        48.8836, 2.3272, 3),
    ('École Jules Ferry',      48.8905, 2.3180, 4)
  ) as s(name, lat, lng, stop_order)
  returning id, route_id, stop_order
)
insert into public.children (parent_id, route_id, stop_id, full_name)
select '81d84bae-580d-4330-9761-1bba9eb19bf8',
       s.route_id,
       s.id,
       'Enfant de Jeremy'
from new_stops s
where s.stop_order = 2;
