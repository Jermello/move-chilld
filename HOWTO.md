# Move-Chilld — Guide pratique

Ce fichier explique **concrètement** comment marche l'app, comment ajouter des données, et comment tester un flow complet de bout en bout.

---

## 1. Comprendre l'app en 30 secondes

Il y a **2 rôles** :

- **Parent** : ouvre l'app, voit où est le bus de son enfant, reçoit une notif quand il est proche.
- **Chauffeur** : ouvre l'app, démarre un trajet, son GPS est streamé en temps réel, il marque les arrêts au fur et à mesure.

Un user = un compte Supabase (`auth.users`). Son rôle est stocké dans `profiles.role` (`parent` ou `driver`). L'app redirige automatiquement sur l'écran correspondant.

```
auth.users → profiles (role=parent|driver)
                    │
      ┌─────────────┴─────────────┐
      │                           │
   parent                      driver
      │                           │
   children                    routes
      │                           │
   stop_id ─── → stops ← ─── route_id
                                  │
                           trip_sessions
                                  │
                      vehicle_locations + stop_events
```

---

## 2. Par où ça commence dans le code

```
app/
├── _layout.tsx       Stack router racine
├── index.tsx         Écran de login (email/password + Google)
├── home.tsx          Dashboard PARENT
└── driver.tsx        Dashboard CHAUFFEUR
```

Quand tu ouvres l'app :

1. `app/index.tsx` s'affiche.
2. Si tu n'es pas connecté → formulaire de login.
3. Si tu es connecté :
   - On lit `profiles.role` via `useProfile(user.id)`.
   - Si `role === "driver"` → `<Redirect href="/driver" />`.
   - Sinon → `<Redirect href="/home" />`.

Donc pour changer de rôle tu changes juste `profiles.role` en SQL.

---

## 3. Setup de zéro (checklist)

Fais ça une fois, dans cet ordre :

### 3.1 — Côté Supabase (SQL Editor)

1. Run `supabase/schema.sql` → crée les 7 tables + la RLS + les triggers.
2. Dans **Authentication → Sign In / Providers → Email** → décoche **Confirm email** → Save.  
   (Sans ça tu ne peux pas te connecter avec un mail de test.)
3. Dans **Authentication → URL Configuration** :
   - **Site URL** : `movechilld://`
   - **Redirect URLs** : `movechilld://**`, `exp://**`

### 3.2 — Côté app

```bash
npm install
npx expo start
```

Scanne le QR avec Expo Go sur ton téléphone.

---

## 4. Créer des comptes de test

### Méthode rapide : via le formulaire de l'app

1. Dans l'app, tu mets un email bidon (ex: `parent@test.local`) + un password (min 6 chars) + un **nom complet** + tu choisis le toggle **Parent / Chauffeur** → **Créer un compte**.
2. Tu es directement connecté (grâce au fix "Confirm email" désactivé) sur l'écran correspondant à ton rôle.
3. Déconnecte-toi.
4. Recommence avec `chauffeur@test.local` en sélectionnant **Chauffeur** dans le toggle.

Tu as maintenant 2 comptes, le premier en `parent`, le second en `driver`.

### Vérifie dans Supabase

**Authentication → Users** :
- `parent@test.local`    → UID = `aaaa...`
- `chauffeur@test.local` → UID = `bbbb...`

**Database → Tables → profiles** : tu dois voir 2 lignes avec leur `role`, leur `full_name` et leur `email` respectifs.  
Si la table est vide (cas où le trigger a raté), lance ce SQL :

```sql
insert into public.profiles (id, role, email, full_name)
select
  id,
  coalesce(raw_user_meta_data->>'intended_role', 'parent'),
  email,
  coalesce(raw_user_meta_data->>'full_name', email)
from auth.users
on conflict (id) do nothing;
```

---

## 5. Donner un rôle chauffeur à un user

**Database → Tables → profiles** → clique sur la cellule `role` du chauffeur → tape `driver` → Enter.

Ou en SQL :

```sql
update public.profiles
set role = 'driver', full_name = 'Mon Chauffeur'
where id = 'bbbb...'; -- UID du chauffeur
```

À la prochaine ouverture de l'app par ce compte, il atterrit sur `/driver` au lieu de `/home`.

---

## 6. Créer une route + des arrêts + un enfant

Il n'y a **pas d'écran d'admin dans l'app** (MVP strict). Tout se fait en SQL dans Supabase.

### Exemple complet — à copier-coller en remplaçant les UUIDs

```sql
-- Remplace ces 2 UUIDs par les tiens
-- driver UID :
-- \set driver_id 'bbbb...'
-- parent UID :
-- \set parent_id 'aaaa...'

with new_route as (
  insert into public.routes (name, driver_id)
  values ('Route matin centre-ville', 'bbbb...') -- ← UID chauffeur
  returning id
),
new_stops as (
  insert into public.stops (route_id, name, lat, lng, stop_order)
  select id, name, lat, lng, stop_order
  from new_route, (values
    ('Place de la République', 48.8671, 2.3630, 1),
    ('Gare du Nord',           48.8809, 2.3553, 2),
    ('École Jules Ferry',      48.8905, 2.3180, 3)
  ) as s(name, lat, lng, stop_order)
  returning id, route_id, stop_order
)
insert into public.children (parent_id, route_id, stop_id, full_name)
select 'aaaa...', -- ← UID parent
       s.route_id,
       s.id,
       'Mon enfant'
from new_stops s
where s.stop_order = 2; -- l'enfant est à l'arrêt "Gare du Nord"
```

Résultat :
- 1 route assignée au chauffeur.
- 3 arrêts en ordre.
- 1 enfant qui descend à l'arrêt n°2.

### Ajouter un deuxième enfant (autre parent, même route)

```sql
insert into public.children (parent_id, route_id, stop_id, full_name)
values (
  'cccc...', -- UID du 2e parent
  (select id from public.routes where name = 'Route matin centre-ville'),
  (select id from public.stops where name = 'École Jules Ferry'),
  'Enfant n°2'
);
```

### Ajouter un arrêt à une route existante

```sql
insert into public.stops (route_id, name, lat, lng, stop_order)
values (
  (select id from public.routes where name = 'Route matin centre-ville'),
  'Place de Clichy',
  48.8836,
  2.3272,
  4
);
```

---

## 7. Tester un trajet de bout en bout

Tu as besoin de **2 devices** ou **2 navigateurs différents** (1 pour le chauffeur, 1 pour le parent).

### Setup rapide : 1 téléphone + Expo web

- **Sur le téléphone (Expo Go)** : connecte-toi en **chauffeur** (`chauffeur@test.local`).  
  → tu atterris sur `/driver`.
- **Dans le navigateur (Expo web, http://localhost:8081)** : connecte-toi en **parent** (`parent@test.local`).  
  → tu atterris sur `/home`. (La carte ne s'affichera pas sur web, c'est normal, le reste marche.)

### Séquence

1. **Parent** voit : "Route matin centre-ville · Gare du Nord" · statut "Pas encore démarré".
2. **Chauffeur** clique **Démarrer le trajet** → autorise le GPS → le statut passe à "🟢 Trajet en cours" et la position s'affiche en bas de la carte.
3. **Parent** : au bout de ~5 secondes le statut passe à "En route" + distance + ETA.  
   Si le chauffeur se rapproche à < 700 m du stop → statut "Arrive bientôt" + notif locale.
4. **Chauffeur** clique **Arrivé** sur le stop 1 ("République") → ce stop devient vert.
5. **Chauffeur** clique **Arrivé** sur le stop 2 ("Gare du Nord") → côté **parent**, le statut passe à "Déjà passé".
6. **Chauffeur** clique **Terminer le trajet** → côté parent le statut passe à "Trajet terminé".

---

## 8. Debugging : "je ne vois pas ce que je devrais voir"

Ouvre SQL Editor dans Supabase et lance ces requêtes pour voir l'état actuel :

```sql
-- Qui est connecté avec quel rôle ?
select p.id, u.email, p.role, p.full_name
from public.profiles p
join auth.users u using (id);

-- Quelles routes existent ?
select r.name, p.full_name as driver
from public.routes r
left join public.profiles p on p.id = r.driver_id;

-- Quels enfants, sur quel arrêt ?
select c.full_name as child, p.full_name as parent, r.name as route, s.name as stop
from public.children c
join public.profiles p on p.id = c.parent_id
join public.routes r on r.id = c.route_id
join public.stops s on s.id = c.stop_id;

-- Y a-t-il un trajet actif ?
select t.id, r.name as route, t.status, t.started_at
from public.trip_sessions t
join public.routes r on r.id = t.route_id
order by t.created_at desc
limit 5;

-- Dernières positions du bus
select trip_session_id, lat, lng, created_at
from public.vehicle_locations
order by created_at desc
limit 10;

-- Statut des arrêts pour le trajet en cours
select s.stop_order, s.name, e.status, e.arrived_at
from public.stop_events e
join public.stops s on s.id = e.stop_id
where e.trip_session_id = (
  select id from public.trip_sessions where status = 'active' limit 1
)
order by s.stop_order;
```

---

## 9. Reset complet (tout effacer sauf les users)

Parfois pendant les tests tu veux repartir propre sans supprimer tes comptes :

```sql
delete from public.vehicle_locations;
delete from public.stop_events;
delete from public.trip_sessions;
delete from public.children;
delete from public.stops;
delete from public.routes;
-- profiles + auth.users sont conservés
```

---

## 10. Questions fréquentes

**Q: Je suis connecté mais je vois "Pas encore configuré" sur /home.**  
→ Aucun enfant n'est lié à ton user. Fais l'étape 6 avec ton UID parent.

**Q: Le chauffeur voit "Aucun trajet assigné".**  
→ Aucune route ne lui est assignée. Crée une route avec `driver_id = <son UID>` (étape 6).

**Q: Le chauffeur clique "Démarrer le trajet" et rien ne se passe.**  
→ Probable problème de permission GPS. Sur iOS, va dans Réglages → Confidentialité → Localisation → Expo Go → Autorisée. Relance.

**Q: Côté parent, la distance/ETA ne bouge pas.**  
→ Check que `vehicle_locations` se remplit (requête SQL étape 8). Si oui, problème de realtime — vérifie que dans Supabase → **Database → Replication**, les tables `vehicle_locations`, `stop_events`, `trip_sessions` sont bien dans la publication `supabase_realtime` (normalement le schema.sql l'a déjà fait).

**Q: Je veux un nouveau parent pour tester.**  
→ Déconnecte-toi dans l'app, crée un compte avec un nouvel email, puis lance l'étape 6 avec son UID.

**Q: Les coordonnées GPS sont à Paris, je veux tester chez moi.**  
→ Change `lat`/`lng` des stops dans `supabase/seed.sql` (ou en SQL direct) pour qu'ils soient proches de toi. Le chauffeur doit être à < 700 m du stop du parent pour déclencher "Arrive bientôt".
