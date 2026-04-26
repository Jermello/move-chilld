# Move-Chilld

School shuttle tracker so parents know **exactly when to leave home**.

Built with **Expo Router**, **TypeScript**, **Supabase** (Auth + Postgres + Realtime), **react-native-maps**, and **expo-notifications**.

## Quick start

```bash
npm install
npx expo start
```

Open on an iOS/Android device or simulator. (Maps and GPS won't work on web.)

## Project structure

```
app/
  _layout.tsx    Root stack
  index.tsx      Login (Google + email/password fallback)
  home.tsx       Parent dashboard
  driver.tsx    Driver dashboard

src/
  lib/
    supabase.ts  Supabase client (AsyncStorage session persistence)
    types.ts     Shared domain types
    geo.ts       Distance + ETA helpers
  hooks/
    useSession.ts
    useProfile.ts
  features/
    auth/          Google OAuth flow
    driver/        Driver API + screen helpers
    parent/        Parent API, realtime hook, status logic, map component
    location/      Foreground GPS tracking for the driver
    notifications/ Push token registration + "approaching" local alert

supabase/
  schema.sql   Tables + RLS + realtime publications
  seed.sql    Minimal seed data for smoke testing
```

## Backend setup

1. In the Supabase SQL editor, run `supabase/schema.sql`.
2. Enable the **Google** provider under _Authentication → Providers_:
   - Add redirect URLs:
     - `movechilld://auth-callback` (native)
     - `http://localhost:8081/auth-callback` (dev web)
3. After signing up a driver and a parent user, edit `supabase/seed.sql` with their uuids and run it.
4. _(Optional)_ Move the Supabase URL and publishable key into `app.json` under `expo.extra`:

   ```json
   "extra": {
     "supabaseUrl": "https://…supabase.co",
     "supabasePublishableKey": "sb_publishable_…"
   }
   ```

## Roles

- **Parent** (default on signup): sees assigned route, shuttle status, ETA, live map, gets a push when the bus is within 700 m.
- **Driver**: set `profiles.role = 'driver'` and assign them a route. They can start/end trips, mark stops as arrived, and stream GPS while driving.

## Shuttle status logic

Computed in `src/features/parent/status.ts`:

- no active trip → `not_started`
- trip completed → `completed`
- stop event = arrived → `passed`
- distance < 700 m → `approaching` (triggers local notification)
- otherwise → `en_route`

ETA uses a naive 30 km/h assumption (`AVG_SPEED_MPS`). Swap in a better estimator later without changing the UI.

## Known MVP limitations

- Foreground-only GPS tracking (driver must keep the app open).
- Local-only "approaching" notification (no server-side push fan-out yet — `push_token` is collected so it's easy to add).
- Single-route, single-child assumption.
- No admin UI — routes/stops/children inserted manually.
