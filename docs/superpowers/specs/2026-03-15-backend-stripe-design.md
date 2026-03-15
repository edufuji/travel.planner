# TripMate Backend & Stripe Integration — Design Spec

## Overview

Add a Node.js/Hono backend and Supabase (auth + database) to TripMate, replacing the current localStorage-only architecture. Stripe handles subscription billing for Premium and Pro tiers (two paid plans; Business is contact-only; Free has no charge). The frontend continues to own all UI; Supabase owns auth and data; the Hono backend owns only Stripe interactions.

---

## Architecture

```
Frontend (React/Vite)
  ├── Supabase JS client → Supabase (auth + PostgreSQL + RLS)
  └── fetch → Hono backend
                ├── POST /checkout  → Stripe API
                └── POST /webhooks/stripe ← Stripe events
                      └── Supabase service-role client → profiles table
```

**Key principle:** The frontend talks directly to Supabase for all trip/event CRUD. The Hono backend is thin — Stripe checkout session creation and webhook handling only.

---

## Subscription Tiers

| Tier | Max Trips | Max Events/Trip | Stripe |
|------|-----------|-----------------|--------|
| Free | 1 | 10 | No charge |
| Premium | 10 | 30 | Stripe subscription |
| Pro | 30 | Unlimited | Stripe subscription |
| Business | Unlimited | Unlimited | Contact button (no Stripe checkout) |

Business tier is enterprise/custom — the upgrade UI shows a "Contact us" button instead of a Stripe Checkout flow.

**Plan limit constants** (used in RLS functions and frontend):

| Plan | Trip limit | Event limit |
|------|-----------|-------------|
| free | 1 | 10 |
| premium | 10 | 30 |
| pro | 30 | 2147483647 (unlimited) |
| business | 2147483647 | 2147483647 |

---

## Database Schema (Supabase/PostgreSQL)

### `profiles`
Created automatically via a trigger on `auth.users` insert (see Trigger section below). No user-facing INSERT policy — the trigger runs as the service role and bypasses RLS.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, FK → auth.users |
| `email` | text | Denormalized from auth.users for easy querying |
| `full_name` | text | Nullable; from OAuth metadata or user input |
| `avatar_url` | text | Nullable; from OAuth metadata |
| `phone` | text | Nullable |
| `country` | text | Nullable |
| `plan` | text | `'free'` \| `'premium'` \| `'pro'` \| `'business'`, default `'free'` |
| `stripe_customer_id` | text | Nullable, set on first Stripe checkout |
| `stripe_subscription_id` | text | Nullable |
| `subscription_status` | text | Nullable; mirrors Stripe status: `'active'` \| `'past_due'` \| `'canceled'` \| `'trialing'`. A `past_due` subscription keeps the plan column set but should be surfaced as a payment warning in the UI. |
| `created_at` | timestamptz | Default now() |

#### Profiles trigger

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### `destinations`
Mirrors the existing `Destination` type.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, default gen_random_uuid() |
| `user_id` | uuid | FK → profiles.id ON DELETE CASCADE |
| `title` | text | |
| `emoji` | text | |
| `start_date` | date | |
| `end_date` | date | |
| `created_at` | timestamptz | Default now() |

### `trip_events`
Mirrors the existing `TripEvent` type.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, default gen_random_uuid() |
| `destination_id` | uuid | FK → destinations.id **ON DELETE CASCADE** |
| `user_id` | uuid | FK → profiles.id (denormalized for RLS) |
| `type` | text | `'transport'` \| `'accommodation'` \| `'ticket'` \| `'restaurant'` |
| `title` | text | |
| `place` | text | |
| `place_id` | text | Nullable, Google Place ID |
| `lat` | float8 | Nullable |
| `lng` | float8 | Nullable |
| `place_to` | text | Nullable, transport destination display name |
| `place_id_to` | text | Nullable, transport destination Google Place ID |
| `lat_to` | float8 | Nullable |
| `lng_to` | float8 | Nullable |
| `arrival_time` | text | Nullable, HH:mm |
| `date` | date | |
| `time` | text | HH:mm |
| `value` | float8 | Nullable, cost |
| `notes` | text | Nullable |
| `arrived_on_foot` | boolean | Nullable, default false |
| `created_at` | timestamptz | Default now() |

Deleting a `destination` cascades to all its `trip_events`.

### Row Level Security (RLS)

All three tables have RLS enabled.

#### `profiles`
- **SELECT / UPDATE**: `id = auth.uid()`
- **INSERT**: no user-facing policy; handled by trigger only

#### `destinations`
- **SELECT / UPDATE / DELETE**: `user_id = auth.uid()`
- **INSERT**: `user_id = auth.uid()` AND `(SELECT count(*) FROM destinations WHERE user_id = auth.uid()) < get_plan_trip_limit((SELECT plan FROM profiles WHERE id = auth.uid()))`

#### `trip_events`
- **SELECT / UPDATE / DELETE**: `user_id = auth.uid()`
- **INSERT**: `user_id = auth.uid()` AND the destination belongs to the current user AND the destination is not over the event limit:
  ```sql
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM destinations WHERE id = NEW.destination_id AND user_id = auth.uid())
  AND (SELECT count(*) FROM trip_events WHERE destination_id = NEW.destination_id)
      < get_plan_event_limit((SELECT plan FROM profiles WHERE id = auth.uid()))
  ```

#### Helper functions

```sql
create or replace function get_plan_trip_limit(plan text)
returns int language sql immutable as $$
  select case plan
    when 'free'     then 1
    when 'premium'  then 10
    when 'pro'      then 30
    when 'business' then 2147483647
    else 1
  end;
$$;

create or replace function get_plan_event_limit(plan text)
returns int language sql immutable as $$
  select case plan
    when 'free'     then 10
    when 'premium'  then 30
    when 'pro'      then 2147483647
    when 'business' then 2147483647
    else 10
  end;
$$;
```

### Downgrade behavior

When a user downgrades (e.g., Pro → Free), their existing trips and events are **not deleted** — they remain readable and editable. Only new INSERTs are blocked by RLS. The frontend surfaces a warning on the ProfilePage: "You have X trips over your Free plan limit. You cannot add new trips until you upgrade or delete existing ones." This is a read-only grace period with no forced deletion.

---

## Hono Backend (`backend/`)

### Structure

```
backend/
  src/
    index.ts          — Hono app entry point, route registration, CORS config
    routes/
      checkout.ts     — POST /checkout
      webhooks.ts     — POST /webhooks/stripe
      health.ts       — GET /health
    lib/
      stripe.ts       — Stripe client singleton
      supabase.ts     — Supabase service-role client singleton
      plans.ts        — price ID → plan name mapping
  .env.example
  package.json
  tsconfig.json
```

### CORS

The Hono backend must allow requests from the frontend origin. Configure `CORS_ORIGIN` as an env variable (e.g., `http://localhost:5173` in development, the production domain in prod). Apply the Hono CORS middleware to all routes.

### Endpoints

**`GET /health`**
Returns `{ status: 'ok' }`. No auth required. Used for deployment health checks.

**`POST /checkout`**
- Auth: requires `Authorization: Bearer <supabase-jwt>` header
- Body: `{ plan: 'premium' | 'pro', successUrl: string, cancelUrl: string }`
- Verifies the JWT with Supabase (`supabase.auth.getUser(token)`)
- Reads the user's `stripe_customer_id` from `profiles`
- Creates a Stripe Customer if `stripe_customer_id` is null; saves it to `profiles`
- Creates a Stripe Checkout Session (mode: `'subscription'`) with:
  - `price`: `STRIPE_PRICE_ID_PREMIUM` or `STRIPE_PRICE_ID_PRO` based on `plan`
  - `customer`: the Stripe customer ID
  - `metadata.plan`: `'premium'` or `'pro'` (used by webhook to set the plan)
  - `success_url` and `cancel_url` from the request body
- Returns `{ url: string }` — the Stripe-hosted checkout URL
- Frontend redirects the browser to this URL
- Rate limit: 10 requests per user per minute (reject with 429 if exceeded)

**`POST /webhooks/stripe`**
- Reads raw body; verifies Stripe webhook signature using `STRIPE_WEBHOOK_SECRET`
- Returns `400` immediately on signature failure
- Handles:
  - `checkout.session.completed`:
    - Reads `metadata.plan` from the session to determine the new plan (`'premium'` or `'pro'`)
    - Looks up the Supabase user by `stripe_customer_id` → `profiles.stripe_customer_id`
    - Updates `profiles`: `plan = metadata.plan`, `stripe_subscription_id = session.subscription`, `subscription_status = 'active'`
  - `customer.subscription.updated`:
    - Maps `subscription.items.data[0].price.id` to a plan name using the `plans.ts` map (price ID → plan)
    - If `subscription.status` is `'active'` or `'trialing'`: update `profiles.plan` to the mapped plan, set `subscription_status = subscription.status`
    - If `subscription.status` is `'past_due'` or `'unpaid'`: **keep** `profiles.plan` unchanged (user retains access during the grace period); set `subscription_status = subscription.status` so the UI can show a payment warning
    - If `subscription.status` is `'canceled'`: set `profiles.plan = 'free'`, `subscription_status = 'canceled'`, `stripe_subscription_id = null`
    - Always match by `stripe_customer_id`
  - `customer.subscription.deleted`:
    - Updates `profiles.plan = 'free'`, `profiles.stripe_subscription_id = null`, `profiles.subscription_status = 'canceled'`
- Uses Supabase service-role client to update `profiles` (bypasses RLS)
- **Idempotency**: all profile updates are plain SQL UPDATEs (SET plan = ...). Stripe may deliver the same event more than once; re-applying the same UPDATE is harmless. No additional deduplication is required.
- Returns `200` on success

#### `lib/plans.ts` — price ID → plan mapping

```ts
export const PRICE_TO_PLAN: Record<string, 'premium' | 'pro'> = {
  [process.env.STRIPE_PRICE_ID_PREMIUM!]: 'premium',
  [process.env.STRIPE_PRICE_ID_PRO!]: 'pro',
}
```

### Environment variables

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_PREMIUM=
STRIPE_PRICE_ID_PRO=
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

---

## Frontend Changes

### Auth
- Wire `LoginPage` to `supabase.auth.signInWithPassword()`, `supabase.auth.signInWithOAuth()` (Google, Apple)
- Add signup flow (new `SignupPage` or modal)
- Add `AuthProvider` context that exposes `user` and `session`
- Protect routes: redirect to `/login` if no active session
- On logout: `supabase.auth.signOut()`

### Data layer
- Replace Zustand `persist` middleware (localStorage) with Supabase queries
- `addDestination` → `supabase.from('destinations').insert(...)`
- `updateDestination` → `supabase.from('destinations').update(...).eq('id', id)`
- `deleteDestination` → `supabase.from('destinations').delete().eq('id', id)`
- Same pattern for `trip_events`
- On app load: fetch destinations with nested events using Supabase's relational select:
  ```ts
  supabase.from('destinations').select('*, trip_events(*)')
  ```
  Map the flat `trip_events` array into the existing nested `events` shape that the rest of the frontend expects
- Keep Zustand as the in-memory state layer; Supabase replaces only the persistence

### Plan limits in UI
- Read `profiles.plan` and `profiles.subscription_status` on login; store in a `useProfileStore`
- If `subscription_status === 'past_due'`, show a payment warning banner with a link to the Stripe customer portal
- Compute remaining trips and events from plan limits
- Disable "Add trip" button when at trip limit; show tooltip: "Upgrade to add more trips"
- Disable "Add event" button when at event limit for that destination; show tooltip
- On downgrade: show a warning on ProfilePage if the user has more trips/events than their current plan allows
- RLS insert block is the safety net — the UI prevents reaching it in normal use

### Upgrade UI (ProfilePage)
- Display current plan badge
- Show tier comparison table (Free / Premium / Pro / Business)
- "Upgrade" button on Premium and Pro: calls `POST /checkout` on the Hono backend, redirects to Stripe URL
- Business tier: "Contact us" button (mailto or external link)
- After Stripe redirects back to the success URL: poll `profiles.plan` every 2 seconds for up to 10 seconds until it reflects the new plan (the webhook fires asynchronously). Show a loading spinner during the wait. If no change after 10 seconds, show a message: "Your plan will update shortly — refresh the page in a moment."

---

## Data Migration

Current data lives in localStorage under the key `tripmate-trips`. On first login after the backend is live:
- Offer a one-time "Import from local data" prompt
- Read localStorage, write each destination and event to Supabase
- Clear localStorage after successful import

This is opt-in — users who never used the app before skip it entirely.

---

## Testing

- **Hono backend**: Vitest unit tests for checkout and webhook handlers using mocked Stripe and Supabase clients
- **Stripe webhooks**: test with Stripe CLI (`stripe listen --forward-to localhost:3000/webhooks/stripe`)
- **RLS policies**: integration tests with two test users verifying data isolation and limit enforcement
- **Frontend auth**: existing Vitest + Testing Library tests; add tests for the auth-gated route redirects

---

## Out of scope

- Annual billing (monthly only for now)
- Invoice history UI
- Email notifications for subscription events
- Admin dashboard
- Stripe customer portal (for self-serve plan management / cancellation)
