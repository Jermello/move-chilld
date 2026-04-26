# Architecture V2 — Multi-tenant SaaS

> **À lire quand** : Tu as 2-3 écoles intéressées et tu es prêt à pivoter du
> mode single-tenant actuel vers un vrai produit B2B.
>
> **À ne pas faire avant** : d'avoir validé le MVP single-tenant en prod avec
> au moins une école pilote pendant 2-4 semaines.

---

## 1. Vision

Move-Chilld passe de _"une app pour mon neveu"_ à _"une plateforme pour les
écoles qui veulent rassurer leurs parents"_.

### Acteurs

| Rôle           | Qui ?                       | Peut quoi                                    |
| -------------- | --------------------------- | -------------------------------------------- |
| `super_admin`  | Toi (la plateforme)         | Gère toutes les écoles, plans, billing       |
| `school_admin` | Le directeur / responsable  | Gère SES routes, drivers, parents            |
| `driver`       | Chauffeur d'une école       | Démarre/termine ses trajets, GPS             |
| `parent`       | Parent d'élève d'une école  | Suit le bus de son enfant                    |

### Plans tarifaires (exemple)

| Plan        | Prix/mois | max_drivers | max_routes | max_children | rétention GPS |
| ----------- | --------- | ----------- | ---------- | ------------ | ------------- |
| Starter     | 49€       | 3           | 2          | 80           | 7 jours       |
| Pro         | 149€      | 10          | 6          | 300          | 30 jours      |
| Enterprise  | sur devis | illimité    | illimité   | illimité     | 1 an          |

À ajuster au moment venu selon le marché.

---

## 2. Modèle de données

### Nouvelles tables

```sql
-- Plans tarifaires (configurés par toi)
create table plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,           -- 'Starter', 'Pro', 'Enterprise'
  max_drivers     integer not null,
  max_routes      integer not null,
  max_children    integer not null,
  retention_days  integer not null default 30,    -- pour vehicle_locations
  price_cents     integer not null default 0,
  created_at      timestamptz not null default now()
);

-- Tenants (= écoles)
create table schools (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  address             text,
  plan_id             uuid not null references plans (id),
  stripe_customer_id  text,                       -- nullable, rempli quand Stripe est branché
  created_at          timestamptz not null default now()
);

-- Codes d'invitation (parents et drivers)
create table invite_codes (
  code         text primary key,                  -- ex: 'MOSHE-2026-PARENT'
  school_id    uuid not null references schools (id) on delete cascade,
  role         text not null check (role in ('parent', 'driver', 'school_admin')),
  expires_at   timestamptz,
  used_by      uuid references auth.users (id),
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);
```

### Modifications des tables existantes

```sql
-- profiles : associe à une école + nouveau rôle
alter table profiles
  add column school_id uuid references schools (id) on delete cascade,
  drop constraint profiles_role_check,
  add constraint profiles_role_check
    check (role in ('super_admin', 'school_admin', 'driver', 'parent'));

-- super_admin a school_id = NULL ; tous les autres rôles l'ont not null
-- (impossible à exprimer en CHECK constraint, mais on peut le faire en trigger)

-- routes : appartient à une école
alter table routes
  add column school_id uuid not null references schools (id) on delete cascade;

-- stops, children : pas de school_id, héritent via leur route_id
-- vehicle_locations, trip_sessions, stop_events : idem, héritent via trip → route
```

### Diagramme simplifié

```
plans
  ↑ (plan_id)
schools ──────┬──── routes ──── stops
              │       │
              │       └── trip_sessions ──── vehicle_locations
              │       │                  └── stop_events
              │
              ├──── invite_codes
              │
              └──── profiles (school_admin / driver / parent)
                      │
                      └── children → route_id, stop_id

(super_admin = profile sans school_id)
```

---

## 3. RLS — la pierre angulaire

Le multi-tenant en Supabase tient ou tombe selon la qualité des policies.
**Aucune query d'app ne doit pouvoir cross-school sauf le super_admin.**

### Helper functions

```sql
-- Le user courant est-il super admin ?
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) = 'super_admin', false);
$$;

-- Le user courant est-il school_admin de cette école ?
create or replace function public.is_school_admin(target_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'school_admin'
      and school_id = target_school
  );
$$;

-- L'école du user courant (NULL si super_admin)
create or replace function public.user_school_id()
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from profiles where id = auth.uid();
$$;
```

### Policies par table

```sql
-- ===== schools =====
-- super_admin voit tout, school_admin voit la sienne, autres voient la leur
create policy "schools read" on schools for select using (
  is_super_admin() or id = user_school_id()
);
create policy "schools write" on schools for all using (is_super_admin())
                                          with check (is_super_admin());

-- ===== profiles =====
-- super_admin : tout
-- school_admin : tout dans sa school
-- driver/parent : seulement soi-même
create policy "profiles read" on profiles for select using (
  is_super_admin()
  or is_school_admin(school_id)
  or id = auth.uid()
);
create policy "profiles write self" on profiles for update using (id = auth.uid());
create policy "profiles write super" on profiles for all using (is_super_admin())
                                                  with check (is_super_admin());
create policy "profiles write school" on profiles for all using (
  is_school_admin(school_id) and role in ('driver', 'parent')
) with check (
  is_school_admin(school_id) and role in ('driver', 'parent')
);

-- ===== routes =====
create policy "routes read" on routes for select using (
  is_super_admin() or school_id = user_school_id()
);
create policy "routes write" on routes for all using (
  is_super_admin() or is_school_admin(school_id)
) with check (
  is_super_admin() or is_school_admin(school_id)
);

-- ===== stops, children =====
-- pas de school_id direct → on join via route
create policy "stops read" on stops for select using (
  is_super_admin() or exists (
    select 1 from routes r where r.id = route_id and r.school_id = user_school_id()
  )
);
create policy "stops write" on stops for all using (
  is_super_admin() or exists (
    select 1 from routes r
    where r.id = route_id and is_school_admin(r.school_id)
  )
);

create policy "children read" on children for select using (
  is_super_admin()
  or auth.uid() = parent_id            -- le parent voit le sien
  or exists (
    select 1 from routes r where r.id = route_id and is_school_admin(r.school_id)
  )
);
-- (write idem)

-- ===== trip_sessions, vehicle_locations, stop_events =====
-- Read : super_admin OR school_id matches via route
-- Write : driver propriétaire OR school_admin de la school
```

### Ce qui devient simple

Plus besoin de la pile de policies "admin all *" actuelle. Les nouveaux helpers
remplacent toute la logique. La policy super-admin existante (`is_admin()`)
devient simplement `is_super_admin()`.

---

## 4. Quotas — comment limiter les drivers

### En base (le filet de sécurité)

```sql
create or replace function public.enforce_driver_quota()
returns trigger language plpgsql as $$
declare
  v_max int;
  v_count int;
begin
  if new.role <> 'driver' then return new; end if;

  select p.max_drivers into v_max
  from schools s join plans p on p.id = s.plan_id
  where s.id = new.school_id;

  select count(*) into v_count from profiles
  where school_id = new.school_id and role = 'driver';

  if v_count >= v_max then
    raise exception 'Quota atteint : % chauffeurs max sur ce plan', v_max;
  end if;

  return new;
end;
$$;

create trigger trg_driver_quota
  before insert on profiles
  for each row execute function enforce_driver_quota();
```

Pareil pour `routes` (`enforce_route_quota`) et `children` (`enforce_children_quota`).

### Dans l'UI (la bonne UX)

Sur l'écran school admin :

```
Chauffeurs   [5/10 utilisés]
[+ Inviter un chauffeur]    ← désactivé à 10/10, tooltip "Quota atteint, upgrade Pro"
```

L'API expose un endpoint ou une view `school_usage` qui retourne :

```sql
create view school_usage as
select
  s.id, s.name,
  p.max_drivers, p.max_routes, p.max_children,
  (select count(*) from profiles where school_id = s.id and role = 'driver') as drivers_used,
  (select count(*) from routes   where school_id = s.id) as routes_used,
  (select count(*) from children c
     join routes r on r.id = c.route_id
     where r.school_id = s.id) as children_used
from schools s join plans p on p.id = s.plan_id;
```

---

## 5. Onboarding — le vrai défi

### Création d'une nouvelle école

1. **Toi (super_admin)** crées une école dans l'écran "Plateforme" :
   - Nom, adresse, plan choisi
2. Tu génères un **code d'invitation school_admin** (ex: `LYCEE-PASCAL-ADMIN-2026`)
3. Tu l'envoies au directeur par email
4. Le directeur s'inscrit avec son email → entre le code → devient `school_admin`
5. Il configure ses routes, drivers, etc.

### Onboarding driver

Le school_admin :
1. Génère un code d'invitation driver depuis son écran admin
2. Envoie le code au chauffeur (SMS, email, papier)
3. Le chauffeur s'inscrit + entre le code → role = `driver`, school_id auto-link
4. School_admin l'assigne à une route

### Onboarding parent (le plus délicat)

Trois options du plus simple au plus auto :

**Option A — Code par école (recommandé MVP)**

Une école a 1 code parent réutilisable affiché dans son espace : `MOSHE-PARENTS-2026`.
Distribué par email aux familles à la rentrée. Parent s'inscrit + entre le code →
role = `parent`, school_id auto-link. Puis le school_admin associe ses enfants
à des arrêts depuis son écran admin.

**Option B — Codes nominatifs**

L'école importe un CSV avec `[email, prénom_enfant, nom_enfant, arrêt]`.
L'app génère un code unique par parent et envoie un email. Plus contrôlé,
plus de boulot.

**Option C — Self-service avec approbation**

Parent saisit son école dans une liste publique, son inscription est en
"pending", le school_admin valide. Risqué (faux parents) mais zéro friction.

→ **Pars sur Option A**. C'est ce que font la plupart des apps scolaires.

---

## 6. Changements UI

### Nouveaux écrans

```
/super-admin                  ← TON ÉCRAN (super admin uniquement)
  - Liste des écoles
  - Créer école + assigner plan
  - Voir usage / facturation par école
  - Gérer les plans

/admin                        ← L'EXISTANT, devient school_admin
  - Limité à SA school
  - Header montre "École : Lycée Pascal — Plan Pro (5/10 drivers)"
  - Onglet "Inviter" : génère codes pour drivers/parents

/onboarding-code              ← NOUVEAU pour signup
  - Affiché après login si profile.school_id IS NULL
  - "Entre ton code d'invitation"
  - Validation → school_id assigné, role mis à jour
```

### Routage

```
Login
  └─ profile.role
       ├── super_admin → /super-admin
       ├── school_admin (avec school_id) → /admin
       ├── driver  (avec school_id) → /driver
       ├── parent  (avec school_id) → /home
       └── ANY (sans school_id sauf super_admin) → /onboarding-code
```

### Modifications mineures

- `/admin/index.tsx` : afficher `school.name` + usage en haut
- `/admin/route/[id].tsx` : ne montrer que les drivers/parents de SA school
  (le filtre RLS s'en charge automatiquement, mais bien le scope dans l'UI)
- L'écran user list ne montre plus les super_admins (filtre `role <> 'super_admin'`)

---

## 7. Migration depuis l'état actuel

À exécuter le jour J, dans cet ordre. **Take a backup before.**

```sql
-- 1. Créer les tables nouvelles
create table plans (...);
create table schools (...);
create table invite_codes (...);

-- 2. Insérer les plans
insert into plans (name, max_drivers, max_routes, max_children, retention_days, price_cents)
values
  ('Starter', 3, 2, 80, 7, 4900),
  ('Pro', 10, 6, 300, 30, 14900),
  ('Enterprise', 9999, 9999, 99999, 365, 0);

-- 3. Créer une école "Default" et assigner tout le legacy à elle
insert into schools (id, name, plan_id)
  select gen_random_uuid(), 'Default', (select id from plans where name = 'Pro');
-- récupère l'id en variable…

-- 4. Étendre profiles + routes
alter table profiles add column school_id uuid references schools (id);
alter table routes   add column school_id uuid references schools (id);

-- 5. Backfill : tout le legacy va dans la school Default,
--    sauf toi qui restes super_admin
update routes   set school_id = '<default-school-id>';
update profiles set school_id = '<default-school-id>'
  where id <> '<ton-uuid-super-admin>';

-- 6. Lock les NOT NULL
alter table routes alter column school_id set not null;
-- profiles : reste nullable (super_admin peut être NULL)

-- 7. Élargir le check role et migrer
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('super_admin', 'school_admin', 'driver', 'parent'));

-- L'ancien role='admin' devient 'school_admin', sauf toi qui passes super_admin
update profiles set role = 'super_admin' where id = '<ton-uuid>';
update profiles set role = 'school_admin' where role = 'admin';

-- 8. Drop les anciennes policies "admin all *" et créer les nouvelles
--    (voir section 3)

-- 9. Créer les triggers de quota
--    (voir section 4)

-- 10. Tester en mode lecture sur compte parent / driver / school_admin
--     pour vérifier qu'ils ne voient bien que leur school
```

**Estimation** : 1h de SQL + 1 jour de re-test fonctionnel + 0.5j de fixes UI. Total : ~2 jours.

---

## 8. Phasage recommandé

### Phase A — Multi-tenant fondamentaux (3-4 jours)

- Schemas `schools`, `plans`, `invite_codes`
- Migration des données existantes
- Nouveaux rôles + RLS scopés
- Onboarding par code
- Refacto de `/admin` pour qu'il soit "school-scoped"

**Pas de Stripe, pas d'écran super-admin sophistiqué**. Juste le minimum
pour avoir 2-3 écoles isolées et facturées à la main.

### Phase B — Super admin + quotas (1-2 jours)

- Écran `/super-admin` : liste écoles, créer école, assigner plan
- Triggers de quota en base
- Indicateurs `5/10 drivers` dans l'UI school admin
- View `school_usage`

### Phase C — Stripe (3 jours)

- `stripe_customer_id` sur `schools`
- Écran "Abonnement" pour le school_admin (lien vers portail client Stripe)
- Webhook : `customer.subscription.updated` → met à jour `plan_id`
- Edge Function Supabase pour créer l'abonnement à la création d'école

À faire **uniquement** quand tu as ≥3 écoles qui paient en facture manuelle
et que tu en as marre de relancer.

### Phase D — Optimisation coûts (1-2 jours, à terme)

- Job nocturne de purge des `vehicle_locations` plus vieux que `plan.retention_days`
- Index sur `school_id` partout pour les RLS performants
- Dashboard d'usage par école (toi seulement)

---

## 9. Questions ouvertes — à trancher quand tu y arriveras

1. **Un driver peut-il bosser pour plusieurs écoles ?**
   Pour le MVP : non (1 driver = 1 school). Si demande forte → table `driver_school_assignments`.

2. **Un parent peut-il avoir des enfants dans 2 écoles ?**
   Cas réel (frères/sœurs dans 2 établissements). Si oui : `children.school_id` séparé,
   et un parent peut être dans plusieurs schools via `profile_school_assignments`.
   Pour le MVP : un compte parent par école, c'est plus simple.

3. **Que faire d'un school_admin qui quitte l'école ?**
   Soft delete ? Transfert à un autre admin ? Probablement : interdiction de
   supprimer le dernier school_admin d'une école.

4. **Self-service signup pour le super_admin ?**
   Non, JAMAIS. Le rôle super_admin se promeut uniquement via SQL direct.

5. **Suppression de compte parent par RGPD ?**
   Une école doit pouvoir le faire. School_admin → "Supprimer ce parent" →
   cascade sur ses children, ses push tokens, etc.

6. **Logs d'audit ?**
   Pour le RGPD/éducation, c'est utile. Table `audit_log` qui trace
   "qui a modifié quoi quand". À considérer en Phase D.

7. **Multi-langue ?**
   Pour l'instant 100% français. Si tu vises l'export, prévoir i18n dès Phase A.

---

## 10. Ce qu'il NE faut PAS faire

- ❌ Coder la phase A maintenant : tu n'as pas validé le besoin
- ❌ Mélanger phase A + Stripe : tu vas mourir en debug Stripe sans avoir vu le produit tourner
- ❌ Bâtir un super_admin trop sophistiqué : 3 écrans suffisent (liste écoles, créer école, voir usage)
- ❌ Permettre aux school_admins de modifier leur propre plan : ils s'auto-upgradent gratis. Toujours via Stripe ou demande à toi.
- ❌ Dénormaliser `school_id` partout : ça aide les RLS mais ça ouvre des bugs
  d'incohérence (route déplacée d'école, ses stops gardent l'ancien school_id…).
  Joins via `route_id` est plus sain.
- ❌ Supprimer le rôle `admin` actuel sans migration : tes données existantes vont casser

---

## TL;DR

```
État actuel  →  V1.5 (1 école pilote) →  V2 phase A  →  V2 phase B  →  V2 phase C
single-tenant   single-tenant tested      multi-tenant    quotas          Stripe
                + retours réels            + RLS strictes  + super-admin   billing auto
```

Garde ce doc en référence. Le jour où tu pivotes, ouvre-le et déroule
les phases dans l'ordre. Aucune surprise, aucune décision à reprendre à
chaud.

Bonne route. 🚌
