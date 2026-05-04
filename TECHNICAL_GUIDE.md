# Move-Chilld — Guide technique

> Cible : un dev React 18 (web) qui veut comprendre l'app **au niveau code**.
> Quand on utilise un truc qui n'existe pas (ou qui est différent) sur le web React, c'est expliqué dans un encadré **🆕 Nouveau pour toi**.

---

## 1. Vue d'ensemble (1 paragraphe)

Move-Chilld est une **app mobile Expo / React Native** qui permet aux parents de suivre en temps réel le bus scolaire de leur enfant. Trois rôles : `parent`, `driver`, `admin`. Le backend est **Supabase** (Postgres + Auth + Realtime via WebSocket). Le chauffeur stream sa position GPS dans Postgres ; les parents écoutent ces inserts via une socket Realtime et voient le bus se déplacer sur une carte. Quand le bus passe sous un seuil de distance par rapport à l'arrêt de l'enfant, une notification locale est déclenchée.

---

## 2. Stack — quoi, pourquoi, et c'est quoi la différence avec le web

| Tech | Rôle | Différence vs React 18 web |
|---|---|---|
| **React 19.1** (`react`, `react-dom`) | Lib UI | Tu peux utiliser le **React Compiler** (activé via `experiments.reactCompiler` dans `app.json`). Il auto-mémoïse — donc les `useMemo`/`useCallback` que tu vois ici sont parfois redondants. |
| **React Native 0.81** | Render UI native (UIView iOS / android.view.View Android) au lieu de DOM | Pas de `<div>`, pas de `<p>`. Tu as `<View>`, `<Text>`, `<ScrollView>`, `<FlatList>`, `<Pressable>`. Pas de CSS — tu fais `StyleSheet.create({...})` avec un sous-ensemble de propriétés CSS (camelCase). |
| **Expo 54** | Framework au-dessus de RN qui fournit des modules natifs prêts à l'emploi (location, notifications, etc.) sans avoir à toucher du code Swift/Kotlin | Pas d'équivalent web — c'est l'écosystème "build mobile facilement". |
| **Expo Router 6** | Routing **fichier-based** | Pense **Next.js App Router** mais pour mobile. Le dossier `app/` = les routes. `app/home.tsx` → route `/home`. `app/admin/route/[id].tsx` → route dynamique `/admin/route/:id`. |
| **Supabase JS** | Client Postgres + Auth + Realtime | Comme Firebase, mais SQL. Tu fais du **SQL côté serveur** (RLS = Row Level Security) au lieu d'écrire des routes API. Le client RN/web parle **directement à la DB** ; les permissions sont enforced en SQL. |
| **react-native-maps** | Carte Apple Maps (iOS) / Google Maps (Android) | Pas Google Maps JS API — wrap natif. Pas dispo sur web (voir l'astuce `.native.tsx` plus bas). |
| **expo-location** | API GPS unifiée iOS + Android | `navigator.geolocation` mais en natif, avec gestion fine de la précision et des permissions runtime. |
| **expo-notifications** | Push + notifications locales | Pas le `Notification` API du browser. Côté push, c'est **APNs (Apple) ou FCM (Google)** sous le capot, abstrait par Expo. |
| **AsyncStorage** | KV-store persistant local | C'est `localStorage`, mais **async** (`await AsyncStorage.getItem(...)`). Storage natif (sandbox app), pas un cookie. |

> **🆕 Nouveau pour toi : “bridge” natif vs DOM**
> Sur le web, `<div>` se transforme en élément du DOM. Sur RN, `<View>` est traduit en vue native via le **bridge** (ou la **JSI** sur la New Architecture). C'est pour ça qu'il y a des modules type `expo-location` : il faut du code natif pour parler au GPS, et JS l'appelle via le pont.
>
> `app.json` → `"newArchEnabled": true` : on est sur la **New Architecture** (TurboModules + Fabric), donc moins d'overhead de bridge, plus de typing JSI.

---

## 3. Arborescence (et où vit quoi)

```
app/                       ← routes Expo Router (équivalent Next App Router)
  _layout.tsx              ← Root Stack + ThemeProvider (entrée de l'app)
  index.tsx                ← Login / signup (route "/")
  home.tsx                 ← Dashboard parent
  driver.tsx               ← Dashboard chauffeur
  admin/
    _layout.tsx            ← Garde admin (redirect si pas admin)
    index.tsx              ← Liste users / routes
    route/[id].tsx         ← Edition d'une route (param dynamique)

src/
  lib/
    supabase.ts            ← client Supabase + reprise auto du token
    types.ts               ← types domaine (Profile, Route, Stop, TripSession, ...)
    geo.ts                 ← Haversine (distance) + format ETA
    theme.ts + themeContext.tsx ← design system + dark mode
  hooks/
    useSession.ts          ← session Supabase (user connecté ou pas)
    useProfile.ts          ← row `profiles` du user courant (rôle, push token...)
  features/                ← un dossier par "domaine métier"
    auth/googleAuth.ts
    parent/
      api.ts               ← requêtes Supabase côté parent
      useParentTrip.ts     ← hook qui orchestre fetch + realtime + state machine
      status.ts            ← logique de statut (en_route / approaching / ...)
      ShuttleMap.native.tsx
      ShuttleMap.tsx       ← fallback web (la map ne marche pas sur web)
    driver/
      api.ts               ← startTrip, endTrip, markStopArrived, pushLocation
      useAutoArrive.ts     ← détecte auto l'arrivée à un arrêt (geo-fencing local)
    location/useDriverLocation.ts ← watchPosition GPS + push à Supabase
    notifications/
      usePushToken.ts      ← enregistre Expo push token sur le profil
      useApproachingAlert.ts ← notif locale quand le bus arrive

supabase/
  schema.sql               ← tables + RLS policies + publication realtime
```

> **🆕 Nouveau pour toi : Expo Router + `_layout.tsx`**
> - Le fichier qu'expose chaque dossier est `_layout.tsx` (équivalent du `layout.tsx` Next).
> - `Stack.Screen name="home"` mappe le fichier `app/home.tsx` à un écran avec un titre.
> - `<Redirect href="/home" />` est le composant pour rediriger en cours de render (équivalent `redirect()` de Next côté client). Comme c'est un *composant*, tu fais juste `return <Redirect ... />` — pas d'effet, pas de side-effect, c'est synchrone et déclaratif.
>
> **🆕 Nouveau pour toi : `.native.tsx` resolution**
> Metro (le bundler RN) résout `ShuttleMap` en regardant `.ios.tsx`, `.android.tsx`, `.native.tsx`, puis `.tsx` dans cet ordre. Donc :
> - Sur iOS/Android → il prend `ShuttleMap.native.tsx` (avec `react-native-maps`)
> - Sur Web → il prend `ShuttleMap.tsx` (un placeholder)
>
> Tu importes simplement `from "@/src/features/parent/ShuttleMap"` — Metro choisit le bon fichier selon la plateforme. Élégant pour gérer les libs natives-only.

---

## 4. Modèle de données (Postgres)

```
profiles  (id PK = auth.users.id, role, email, full_name, push_token)
routes    (id, name, driver_id → profiles)
stops     (id, route_id, name, lat, lng, stop_order)
children  (id, parent_id → profiles, route_id, stop_id)
trip_sessions   (id, route_id, driver_id, status: pending|active|completed,
                 started_at, ended_at)
vehicle_locations (id, trip_session_id, lat, lng, created_at)  ← 1 row par ping GPS
stop_events       (trip_session_id, stop_id, status: pending|arrived, arrived_at)
```

Contraintes clés :
- **Un seul trip actif par route** : index unique partiel (`where status = 'active'`).
- **Un seul stop_event par (trip, stop)** : unique constraint.
- **RLS partout** : un parent ne lit que ses enfants ; un driver n'écrit que les locations de SES trips ; etc.

> **🆕 Nouveau pour toi : RLS (Row Level Security)**
> Sur le web "classique" tu as un backend Express qui vérifie `if (user.id !== resource.ownerId) return 403`. En Supabase, tu écris cette règle **en SQL** :
> ```sql
> create policy "children read"
>   on public.children for select
>   using (auth.uid() = parent_id);
> ```
> Et ensuite, **n'importe quel client** (mobile, web, curl) qui hit la DB avec un JWT user verra automatiquement seulement ses propres rows. Pas besoin d'API REST custom — la sécurité vit dans la DB.

---

## 5. Le flow de bout en bout (le truc à imprimer dans la tête)

### 5.1 Boot de l'app

```
JS thread démarre
  → expo-router/entry (déclaré dans package.json "main")
  → app/_layout.tsx render
     → <ThemeProvider>      (lit AsyncStorage pour le mode dark)
       → <ThemedStack>      (configure react-navigation)
         → <Stack.Screen name="index"> ...
            → app/index.tsx (login)
```

### 5.2 Auth — login

`app/index.tsx` consomme :
- `useSession()` → s'abonne à Supabase auth
- `useProfile(session?.user.id)` → fetch la row `profiles`

```47:53:app/index.tsx
  if (session) {
    const role = profile?.role ?? "parent";
    if (role === "admin") return <Redirect href="/admin" />;
    if (role === "driver") return <Redirect href="/driver" />;
    return <Redirect href="/home" />;
  }
```

Trois chemins de connexion :

1. **Email/password** → `supabase.auth.signInWithPassword(...)`
2. **Signup** → `supabase.auth.signUp({ options: { data: { intended_role, full_name } } })`. Le `data` finit dans `auth.users.raw_user_meta_data`, et un **trigger Postgres** (`handle_new_user`, dans `schema.sql`) crée automatiquement la row `profiles` correspondante.
3. **Google OAuth** → `signInWithGoogle()` (`src/features/auth/googleAuth.ts`)

#### Le flow OAuth Google, en détail

```17:52:src/features/auth/googleAuth.ts
export async function signInWithGoogle(): Promise<{ error?: string }> {
  const redirectTo = Linking.createURL("auth-callback");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  ...
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
```

> **🆕 Nouveau pour toi : deep links**
> 1. L'app demande à Supabase une URL OAuth.
> 2. `WebBrowser.openAuthSessionAsync` ouvre Safari/Chrome **in-app**.
> 3. L'utilisateur s'auth chez Google. Google redirige vers `movechilld://auth-callback?...`.
> 4. iOS/Android voient le scheme `movechilld://` (déclaré dans `app.json`: `"scheme": "movechilld"`) et **rouvrent l'app**, en passant l'URL.
> 5. On parse `access_token` + `refresh_token` du fragment et on les pose dans Supabase via `setSession`.
>
> Pas d'équivalent strict côté web ; c'est l'analogue mobile d'un redirect OAuth.

#### `useSession` — pattern classique

```9:24:src/hooks/useSession.ts
useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
    setLoading(false);
  });

  const { data: listener } = supabase.auth.onAuthStateChange(
    (_event, session) => { setSession(session); }
  );

  return () => { listener.subscription.unsubscribe(); };
}, []);
```

**Persist + auto-refresh** : configuré dans `src/lib/supabase.ts`.

```18:36:src/lib/supabase.ts
export const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
```

> **🆕 Nouveau pour toi : `AppState` et `Platform`**
> - `Platform.OS` ∈ `"ios" | "android" | "web"`. On l'utilise pour brancher des comportements différents.
> - `AppState` te dit si l'app est `active`, `background`, `inactive`. On stoppe le refresh JWT en background pour pas bouffer la batterie / faire des requêtes inutiles. C'est l'équivalent mobile de l'event `visibilitychange` du browser.

### 5.3 Côté chauffeur : démarrer un trip

`app/driver.tsx` :

1. Au mount, `load()` appelle `fetchDriverRoute(userId)` puis `fetchActiveTrip(routeId)` pour reprendre un trip en cours.
2. Tap sur "Démarrer le trajet" → `startTrip(routeId, driverId, stops)` :

```40:69:src/features/driver/api.ts
export async function startTrip(routeId, driverId, stops) {
  const { data: trip, error } = await supabase
    .from("trip_sessions")
    .insert({ route_id: routeId, driver_id: driverId, status: "active",
              started_at: new Date().toISOString() })
    .select(...).single();

  // Seed un pending stop_event par arrêt
  if (stops.length > 0) {
    const rows = stops.map((s) => ({ trip_session_id: trip.id,
                                     stop_id: s.id, status: "pending" }));
    await supabase.from("stop_events").insert(rows);
  }
  return trip;
}
```

3. Une fois `trip.status === "active"`, le hook `useDriverLocation(tripId)` se déclenche.

#### `useDriverLocation` — streaming GPS

```28:60:src/features/location/useDriverLocation.ts
const { status } = await Location.requestForegroundPermissionsAsync();
...
subscription = await Location.watchPositionAsync(
  { accuracy: Location.Accuracy.High,
    timeInterval: MIN_PUSH_INTERVAL_MS,    // 5s
    distanceInterval: 10 },                // ou 10m
  async (loc) => {
    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;
    setCoords({ lat, lng });

    const now = Date.now();
    if (now - lastPushRef.current < MIN_PUSH_INTERVAL_MS) return;
    lastPushRef.current = now;
    await pushLocation(tripId, lat, lng);
  }
);

return () => { subscription?.remove(); };
```

`pushLocation` fait un simple INSERT dans `vehicle_locations`. La **RLS policy** vérifie côté DB que `auth.uid()` = `trip_sessions.driver_id`.

> **🆕 Nouveau pour toi : permissions runtime**
> Sur le web, `navigator.geolocation` te demande la permission via le browser. Sur mobile, **toi** tu déclenches le prompt avec `requestForegroundPermissionsAsync()`. Le statut peut être `granted | denied | undetermined`. Et c'est *foreground* ici : si l'app passe en background, RN coupe le watch (limitation MVP).

#### `useAutoArrive` — geo-fencing local

```28:44:src/features/driver/useAutoArrive.ts
useEffect(() => {
  if (!enabled || !coords) return;
  for (const stop of stops) {
    if (triggeredRef.current.has(stop.id)) continue;
    const ev = events.find((e) => e.stop_id === stop.id);
    if (!ev || ev.status === "arrived") continue;

    const d = haversineMeters(coords, { lat: stop.lat, lng: stop.lng });
    if (d <= AUTO_ARRIVE_METERS) {           // 60m
      triggeredRef.current.add(stop.id);
      Promise.resolve(onArrived(stop.id)).catch(() => {
        triggeredRef.current.delete(stop.id);
      });
    }
  }
}, [enabled, coords, stops, events, onArrived]);
```

Le `triggeredRef` (Set dans un `useRef`) garantit l'**idempotence** côté client : un stop ne peut être marqué qu'une fois par run. Si le INSERT échoue, on retire l'id du Set pour ré-essayer au prochain ping GPS.

`onArrived(stopId)` → `markStopArrived(tripId, stopId)` → UPDATE Postgres → broadcast via Realtime → tous les parents abonnés voient l'event arriver.

### 5.4 Côté parent : voir le bus en temps réel

`app/home.tsx` câble tout :

```31:38:app/home.tsx
const { profile } = useProfile(session?.user.id);
usePushToken(session?.user.id);

const { child, route, stops, parentStop, trip, location, status, loading, reload } =
  useParentTrip(session?.user.id);

useApproachingAlert(status.status, trip?.id ?? null);
```

#### `useParentTrip` — l'orchestrateur

C'est le hook le plus dense de l'app. Il fait 3 choses :

**(a) Initial fetch** quand `parentId` change :

```40:79:src/features/parent/useParentTrip.ts
const reload = useCallback(async () => {
  if (!parentId) return;
  ...
  const c = await fetchChildForParent(parentId);
  ...
  const [r, s, t] = await Promise.all([
    fetchRoute(c.route_id),
    fetchStopsForRoute(c.route_id),
    fetchActiveTripForRoute(c.route_id),
  ]);
  ...
  if (t) {
    const [loc, ev] = await Promise.all([
      fetchLatestLocation(t.id),
      fetchTripStopEvents(t.id),
    ]);
    ...
  }
}, [parentId]);
```

**(b) Polling fallback** si pas de trip actif (le chauffeur n'a pas encore démarré) :

```86:103:src/features/parent/useParentTrip.ts
useEffect(() => {
  if (!route || trip) return;
  const id = setInterval(() => {
    fetchActiveTripForRoute(route.id).then(async (t) => {
      if (!t) return;
      setTrip(t);
      ...
    });
  }, 15000);
  return () => clearInterval(id);
}, [route, trip]);
```

> Pourquoi du polling alors qu'on a Realtime ? Parce que la subscription Realtime ci-dessous est filtrée sur `id=eq.${tripId}` — donc tant qu'on n'a pas de trip, on n'a rien à écouter. Le polling toutes les 15s comble ce gap.

**(c) Realtime subscriptions** quand un trip est actif :

```106:157:src/features/parent/useParentTrip.ts
useEffect(() => {
  if (!trip) return;
  const tripId = trip.id;

  const locChannel = supabase
    .channel(`parent-loc-${tripId}`)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "vehicle_locations",
        filter: `trip_session_id=eq.${tripId}` },
      (payload) => setLocation(payload.new as VehicleLocation)
    )
    .subscribe();

  const eventsChannel = supabase
    .channel(`parent-events-${tripId}`)
    .on("postgres_changes",
      { event: "*", ..., table: "stop_events", filter: `trip_session_id=eq.${tripId}` },
      () => fetchTripStopEvents(tripId).then(setEvents)
    )
    .subscribe();

  const tripChannel = supabase
    .channel(`parent-trip-${tripId}`)
    .on("postgres_changes",
      { event: "UPDATE", ..., table: "trip_sessions", filter: `id=eq.${tripId}` },
      (payload) => setTrip(payload.new as TripSession)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(locChannel);
    supabase.removeChannel(eventsChannel);
    supabase.removeChannel(tripChannel);
  };
}, [trip]);
```

> **🆕 Nouveau pour toi : Supabase Realtime**
> Sous le capot c'est une **WebSocket** vers Supabase, multiplexée en "channels". Tu déclares :
> - une table à écouter (`vehicle_locations`)
> - un type d'event (`INSERT` / `UPDATE` / `DELETE` / `*`)
> - un filtre côté serveur (`trip_session_id=eq.<uuid>`) — ultra important, sinon tu reçois TOUTES les rows de la table.
>
> Côté SQL, il faut que la table soit dans la **publication** `supabase_realtime` :
> ```sql
> alter publication supabase_realtime add table public.vehicle_locations;
> ```
> Postgres en interne logique-replique les changements ; Supabase les pousse via WS.
>
> ⚠️ Cleanup : **toujours** `removeChannel` dans le cleanup du `useEffect`, sinon tu fuites des WS chaque fois que `trip` change.

**(d) State derived** — la machine d'états du statut :

```159:168:src/features/parent/useParentTrip.ts
const status = useMemo(
  () => computeParentStatus({ trip, stop: parentStop, location, stopEvents: events }),
  [trip, parentStop, location, events]
);
```

`computeParentStatus` (`src/features/parent/status.ts`) est une fonction **pure** — elle prend tout le state et retourne le statut UI :

```
no trip + jamais arrivé    → not_started
trip.status = completed    → completed
stop_event.status = arrived → passed
distance < 100m             → at_stop      (notif "à ton arrêt")
distance < 500m             → approaching   (notif "le bus arrive")
distance < 1000m            → coming_soon
sinon                       → en_route
```

C'est ce qui rend le composant simple à raisonner : `useParentTrip` collecte de la donnée brute, `computeParentStatus` calcule le statut.

#### Notifications locales

```43:56:src/features/notifications/useApproachingAlert.ts
useEffect(() => {
  if (!tripId) return;
  const trigger = TRIGGERS.find((t) => t.status === status);
  if (!trigger) return;

  const key = `${tripId}:${status}`;
  if (firedRef.current.has(key)) return;
  firedRef.current = new Set([...firedRef.current, key]).add(key);

  Notifications.scheduleNotificationAsync({
    content: { title: trigger.title, body: trigger.body },
    trigger: null,
  });
}, [status, tripId]);
```

Quand le statut passe à `approaching` ou `at_stop`, on programme une notif **locale** (pas de serveur de push). Le `firedRef` empêche de re-tirer si on flicker entre 2 statuts.

> **🆕 Nouveau pour toi : notif locale vs push**
> - **Locale** = l'app demande à l'OS d'afficher une notif. L'app doit être lancée. Pas besoin de serveur. C'est ce qu'on fait ici.
> - **Push** = un serveur (APNs / FCM, ou Expo Push) envoie une notif depuis le cloud, l'OS l'affiche même app fermée. On collecte le token (`usePushToken.ts`) mais on ne l'utilise pas encore côté serveur (cf. limitations MVP).

### 5.5 La carte

`ShuttleMap.native.tsx` :

```57:69:src/features/parent/ShuttleMap.native.tsx
useEffect(() => {
  if (!follow || !location || !mapRef.current) return;
  mapRef.current.animateToRegion({
    latitude: location.lat, longitude: location.lng,
    latitudeDelta: FOLLOW_LATITUDE_DELTA,
    longitudeDelta: FOLLOW_LONGITUDE_DELTA,
  }, 600);
}, [follow, location]);
```

À chaque nouvelle position reçue via Realtime, on anime la map vers le bus si `follow` est true. Si l'utilisateur swipe la map (`onPanDrag`), on coupe le follow pour pas se battre avec lui.

---

## 6. Diagramme du flow temps réel

```
┌──────────────┐                   ┌──────────────┐                   ┌──────────────┐
│   DRIVER     │                   │   SUPABASE   │                   │   PARENT     │
│   app        │                   │   Postgres   │                   │   app        │
└──────┬───────┘                   └──────┬───────┘                   └──────┬───────┘
       │                                  │                                  │
       │ 1. tap "Démarrer"                │                                  │
       │ insert trip_sessions             │                                  │
       │─────────────────────────────────▶│                                  │
       │                                  │ 2. broadcast UPDATE trip         │
       │                                  │ ───── via Realtime WS ────────▶ │
       │                                  │                                  │ setTrip()
       │ 3. expo-location watchPosition   │                                  │
       │    every 5s :                    │                                  │
       │ insert vehicle_locations         │                                  │
       │─────────────────────────────────▶│                                  │
       │                                  │ 4. INSERT broadcast              │
       │                                  │ ──────────────────────────────▶ │
       │                                  │                                  │ setLocation()
       │                                  │                                  │   ↓
       │                                  │                                  │ computeParentStatus
       │                                  │                                  │   ↓
       │                                  │                                  │ if approaching :
       │                                  │                                  │   notification locale
       │                                  │                                  │   ↓
       │                                  │                                  │ map.animateToRegion
       │ 5. useAutoArrive détecte         │                                  │
       │    distance < 60m :              │                                  │
       │ update stop_events SET arrived   │                                  │
       │─────────────────────────────────▶│                                  │
       │                                  │ 6. UPDATE broadcast              │
       │                                  │ ──────────────────────────────▶ │
       │                                  │                                  │ setEvents() → status="passed"
```

---

## 7. Conventions React 19 / RN à connaître

### Styling
Pas de CSS. Pas de `className`. Tu fais :

```tsx
<View style={[styles.card, isActive && styles.cardActive, { borderColor: dynamicColor }]} />
```

Le tableau est mergé. Tu peux mélanger objets statiques (`styles.card`) et inline (`{ borderColor }`). Les styles inline sont le moyen propre d'injecter des valeurs runtime (theming).

### `useMemo(makeStyles, [theme])`
Tu vois ce pattern partout :

```tsx
const styles = useMemo(() => makeStyles(theme), [theme]);
```

Comme `StyleSheet.create({...})` est statique, on appelle une factory `makeStyles(theme)` qui retourne le résultat de `StyleSheet.create`. On le mémoïse pour éviter de re-créer la stylesheet à chaque render. Avec React Compiler activé, c'est même redondant — mais ça reste lisible.

### Pas de Hot Reload "fast refresh" magique pour les natives
Quand tu installes une lib avec du code natif (ex. `react-native-maps`), un simple `expo start` ne suffit pas si c'est la première fois — il faut soit Expo Go (qui contient le binaire), soit un dev build (`eas build --profile development`).

### `Pressable` vs `Button`
- `Button` est limité (pas stylisable).
- `Pressable` te donne `onPress`, `onPressIn/Out`, et te laisse stylé un `<View>` à l'intérieur. C'est ce qu'on utilise partout.

### `FlatList` vs `.map()`
Pour les listes longues, RN recommande `FlatList` parce qu'elle **virtualise** (ne render que les items visibles). Comme `react-window` mais natif. Vu dans `driver.tsx` pour la liste des arrêts.

### Theming
`themeContext.tsx` expose `useTheme()` qui retourne `{ colors, shadow, mode, effectiveMode, setMode, toggleMode }`. La préférence est persistée dans AsyncStorage. Le hydration attend la lecture pour éviter le **flash of wrong theme** :

```73:75:src/lib/themeContext.tsx
// Avoid the "wrong theme flash" before AsyncStorage hydrates.
if (!hydrated) return null;
```

---

## 8. Sécurité — où sont les check-points

| Check | Où |
|---|---|
| User authentifié | RLS policies `to authenticated using (true)` + redirects dans `_layout.tsx` |
| Parent ne lit que ses enfants | `auth.uid() = parent_id` sur `children` |
| Driver ne push que ses locations | Policy `vehicle_locations` insert vérifie que `trip_sessions.driver_id = auth.uid()` |
| Un seul trip actif par route | Index unique partiel `where status = 'active'` |
| Admin n'est jamais auto-attribué | Le trigger `handle_new_user` clamp à `parent | driver` |
| Token Supabase | Stocké en AsyncStorage (sandbox app), refresh auto en foreground |

> **🆕 Nouveau pour toi : la clé "publishable" en clair dans le bundle**
> `app.json` contient `supabasePublishableKey`. C'est OK : c'est une clé publique côté client (équivalent `anon` key). Le vrai gardien, c'est la **RLS**. Ne jamais y mettre la `service_role` key — elle bypass la RLS.

---

## 9. Limitations actuelles (ce qu'on n'a pas fait exprès)

- **GPS foreground only** — si le chauffeur lock le téléphone, le watch s'arrête. Pour du background, il faudrait `expo-task-manager` + `Location.startLocationUpdatesAsync` avec une task name enregistrée.
- **Pas de fan-out push serveur** — les notifs sont locales, donc l'app doit tourner. Pour notifier même app fermée : il faudrait un Edge Function qui écoute les inserts de `vehicle_locations`, calcule les distances par parent, et push via `expo.host/--/api/v2/push/send` en utilisant les `push_token` collectés.
- **MVP single-child / single-route** — `fetchChildForParent` fait `.limit(1)`.
- **ETA naïf** — distance / 30 km/h (`AVG_SPEED_MPS = 8.3`). Pas de routing API (Mapbox / Google Directions).

---

## 10. TL;DR — la mind map

```
Boot (_layout.tsx) ── ThemeProvider ── Stack
                                          ├── index.tsx (login) ── useSession + useProfile ── Redirect
                                          ├── home.tsx (parent)
                                          │     └── useParentTrip
                                          │           ├── fetchChild/Route/Stops/Trip
                                          │           ├── polling 15s si pas de trip
                                          │           ├── 3× supabase.channel(...) realtime
                                          │           └── computeParentStatus → ShuttleMap + alertes
                                          ├── driver.tsx
                                          │     ├── fetchDriverRoute / startTrip / endTrip
                                          │     ├── useDriverLocation ── watchPosition → INSERT vehicle_locations
                                          │     └── useAutoArrive ── haversine < 60m → UPDATE stop_events
                                          └── admin/* (CRUD users / routes / stops / children)
```

Tout le reste (theming, types, helpers geo) est de la plomberie autour de ce squelette.
