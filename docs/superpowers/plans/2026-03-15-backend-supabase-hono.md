# TripMate Backend — Supabase + Hono Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Supabase (database schema, RLS, trigger) and a Hono/Node.js backend that handles Stripe checkout session creation and webhook processing.

**Architecture:** Supabase hosts the PostgreSQL database with RLS enforcing per-user data isolation and plan limits. A separate `backend/` Node.js server (Hono) handles only two Stripe interactions: creating checkout sessions and processing webhooks. The frontend (not in this plan) will talk directly to Supabase for CRUD.

**Tech Stack:** Supabase (PostgreSQL + Auth), Hono v4, Node.js, TypeScript, Stripe SDK v17, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-backend-stripe-design.md`

---

## Chunk 1: Supabase database setup

> **Note on testing SQL:** These tasks run SQL in the Supabase SQL editor. Verification is done via the Supabase Table Editor and SQL queries, not automated tests. Automated backend tests come in Chunk 2.

### Task 1: Profiles table, trigger, and RLS

**Files:**
- Create: `supabase/migrations/001_profiles.sql` (for reference — run manually in Supabase SQL editor)

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/001_profiles.sql` with the following content:

```sql
-- Plan limit helper functions
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

-- Profiles table
create table if not exists public.profiles (
  id                     uuid        primary key references auth.users on delete cascade,
  email                  text,
  full_name              text,
  avatar_url             text,
  phone                  text,
  country                text,
  plan                   text        not null default 'free'
                                     check (plan in ('free', 'premium', 'pro', 'business')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  subscription_status    text,
  created_at             timestamptz not null default now()
);

-- RLS on profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Trigger: auto-create profile on signup
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

- [ ] **Step 2: Run the migration in Supabase SQL editor**

1. Go to your Supabase project → SQL editor
2. Paste the full contents of `supabase/migrations/001_profiles.sql`
3. Click "Run"
4. Expected: no errors

- [ ] **Step 3: Verify the table and trigger**

Run this verification query in the SQL editor:

```sql
-- Should return the profiles table columns
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'profiles' and table_schema = 'public'
order by ordinal_position;
```

Expected: 11 rows (id, email, full_name, avatar_url, phone, country, plan, stripe_customer_id, stripe_subscription_id, subscription_status, created_at). Also verify in Table Editor → Authentication → Triggers that `on_auth_user_created` exists.

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/001_profiles.sql
git commit -m "feat: add profiles table, trigger, and RLS"
```

---

### Task 2: Destinations table and RLS

**Files:**
- Create: `supabase/migrations/002_destinations.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/002_destinations.sql`:

```sql
create table if not exists public.destinations (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  title      text        not null,
  emoji      text        not null default '✈️',
  start_date date        not null,
  end_date   date        not null,
  created_at timestamptz not null default now()
);

alter table public.destinations enable row level security;

create policy "Users can view own destinations"
  on public.destinations for select
  using (user_id = auth.uid());

create policy "Users can update own destinations"
  on public.destinations for update
  using (user_id = auth.uid());

create policy "Users can delete own destinations"
  on public.destinations for delete
  using (user_id = auth.uid());

create policy "Users can insert destinations within plan limit"
  on public.destinations for insert
  with check (
    user_id = auth.uid()
    and (
      select count(*)
      from public.destinations
      where user_id = auth.uid()
    ) < get_plan_trip_limit(
      (select plan from public.profiles where id = auth.uid())
    )
  );
```

- [ ] **Step 2: Run in Supabase SQL editor and verify**

Run the SQL. Then verify:

```sql
select tablename, policyname, cmd
from pg_policies
where tablename = 'destinations';
```

Expected: 4 policies (select, update, delete, insert).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_destinations.sql
git commit -m "feat: add destinations table and RLS"
```

---

### Task 3: Trip events table and RLS

**Files:**
- Create: `supabase/migrations/003_trip_events.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/003_trip_events.sql`:

```sql
create table if not exists public.trip_events (
  id             uuid        primary key default gen_random_uuid(),
  destination_id uuid        not null references public.destinations(id) on delete cascade,
  user_id        uuid        not null references public.profiles(id),
  type           text        not null check (type in ('transport', 'accommodation', 'ticket', 'restaurant')),
  title          text        not null,
  place          text        not null,
  place_id       text,
  lat            float8,
  lng            float8,
  place_to       text,
  place_id_to    text,
  lat_to         float8,
  lng_to         float8,
  arrival_time   text,
  date           date        not null,
  time           text        not null,
  value          float8,
  notes          text,
  arrived_on_foot boolean    default false,
  created_at     timestamptz not null default now()
);

alter table public.trip_events enable row level security;

create policy "Users can view own events"
  on public.trip_events for select
  using (user_id = auth.uid());

create policy "Users can update own events"
  on public.trip_events for update
  using (user_id = auth.uid());

create policy "Users can delete own events"
  on public.trip_events for delete
  using (user_id = auth.uid());

create policy "Users can insert events within plan limit"
  on public.trip_events for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.destinations
      where id = destination_id
      and user_id = auth.uid()
    )
    and (
      select count(*)
      from public.trip_events
      where destination_id = NEW.destination_id
    ) < get_plan_event_limit(
      (select plan from public.profiles where id = auth.uid())
    )
  );
```

- [ ] **Step 2: Run in Supabase SQL editor and verify**

Run the SQL. Then verify:

```sql
select tablename, policyname, cmd
from pg_policies
where tablename = 'trip_events';
```

Expected: 4 policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_trip_events.sql
git commit -m "feat: add trip_events table and RLS"
```

---

## Chunk 2: Hono backend scaffold

### Task 4: Initialize backend project

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "tripmate-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "@supabase/supabase-js": "^2.49.4",
    "hono": "^4.8.3",
    "stripe": "^17.7.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.19.4",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": ".",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Create `backend/.env.example`**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PREMIUM=price_...
STRIPE_PRICE_ID_PRO=price_...
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

- [ ] **Step 5: Create `backend/.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 6: Install dependencies**

```bash
cd backend
pnpm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Commit**

```bash
cd ..
git add backend/package.json backend/tsconfig.json backend/vitest.config.ts backend/.env.example backend/.gitignore
git commit -m "feat: initialize backend project scaffold"
```

---

### Task 5: Lib singletons — Supabase, Stripe, plans

**Files:**
- Create: `backend/src/lib/supabase.ts`
- Create: `backend/src/lib/stripe.ts`
- Create: `backend/src/lib/plans.ts`

- [ ] **Step 1: Create `backend/src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export default supabase
```

- [ ] **Step 2: Create `backend/src/lib/stripe.ts`**

```ts
import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY env var')
}

const stripe = new Stripe(stripeSecretKey)

export default stripe
```

- [ ] **Step 3: Create `backend/src/lib/plans.ts`**

```ts
if (!process.env.STRIPE_PRICE_ID_PREMIUM || !process.env.STRIPE_PRICE_ID_PRO) {
  throw new Error('Missing STRIPE_PRICE_ID_PREMIUM or STRIPE_PRICE_ID_PRO env vars')
}

export const PRICE_TO_PLAN: Record<string, 'premium' | 'pro'> = {
  [process.env.STRIPE_PRICE_ID_PREMIUM]: 'premium',
  [process.env.STRIPE_PRICE_ID_PRO]: 'pro',
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/
git commit -m "feat: add Supabase, Stripe, and plans lib singletons"
```

---

### Task 6: GET /health endpoint

**Files:**
- Create: `backend/src/routes/health.ts`
- Create: `backend/src/index.ts`
- Create: `backend/test/health.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/test/health.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/index.ts'

describe('GET /health', () => {
  it('returns { status: ok }', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend
pnpm test
```

Expected: FAIL — `Cannot find module '../src/index.ts'`

- [ ] **Step 3: Create `backend/src/routes/health.ts`**

```ts
import { Hono } from 'hono'

const health = new Hono()

health.get('/', (c) => c.json({ status: 'ok' }))

export default health
```

- [ ] **Step 4: Create `backend/src/index.ts`**

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health.ts'

const app = new Hono()

app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))

app.route('/health', health)

const port = Number(process.env.PORT ?? 3000)

if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on port ${port}`)
  })
}

export default app
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd backend
pnpm test
```

Expected: PASS — 1 test passed

- [ ] **Step 6: Commit**

```bash
cd ..
git add backend/src/routes/health.ts backend/src/index.ts backend/test/health.test.ts
git commit -m "feat: add GET /health endpoint"
```

---

## Chunk 3: Stripe endpoints

### Task 7: POST /checkout endpoint

**Files:**
- Create: `backend/src/routes/checkout.ts`
- Create: `backend/test/checkout.test.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/checkout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import app from '../src/index.ts'

// Mock lib singletons before importing routes
vi.mock('../src/lib/supabase.ts', () => ({
  default: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

vi.mock('../src/lib/stripe.ts', () => ({
  default: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
}))

import supabase from '../src/lib/supabase.ts'
import stripe from '../src/lib/stripe.ts'

const mockSupabase = supabase as unknown as {
  auth: { getUser: ReturnType<typeof vi.fn> }
  from: ReturnType<typeof vi.fn>
}
const mockStripe = stripe as unknown as {
  customers: { create: ReturnType<typeof vi.fn> }
  checkout: { sessions: { create: ReturnType<typeof vi.fn> } }
}

function authHeader(token = 'valid-token') {
  return { Authorization: `Bearer ${token}` }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  // Reset the in-memory rate limit map between tests
  // Import and call the exported reset function
  import('../src/routes/checkout.ts').then(m => m.resetRateLimitForTesting?.())
})

describe('POST /checkout', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.request('/checkout', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT is invalid', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') })

    const res = await app.request('/checkout', {
      method: 'POST',
      headers: { ...authHeader('bad-token'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'premium', successUrl: 'http://x/success', cancelUrl: 'http://x/cancel' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when plan is invalid', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com' } }, error: null })

    const selectMock = { data: { stripe_customer_id: 'cus_existing' }, error: null }
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(selectMock) }) }),
    })

    const res = await app.request('/checkout', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'business', successUrl: 'http://x/success', cancelUrl: 'http://x/cancel' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 200 with url when user already has a stripe_customer_id', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com' } }, error: null })

    const selectMock = { data: { stripe_customer_id: 'cus_existing' }, error: null }
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(selectMock) }) }),
    })

    mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session' })

    const res = await app.request('/checkout', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'premium', successUrl: 'http://x/success', cancelUrl: 'http://x/cancel' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { url: string }
    expect(body.url).toBe('https://checkout.stripe.com/session')
    expect(mockStripe.customers.create).not.toHaveBeenCalled()
  })

  it('returns 429 after 10 requests from the same user within one minute', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-rl', email: 'rl@b.com' } }, error: null })

    const selectMock = { data: { stripe_customer_id: 'cus_rl' }, error: null }
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(selectMock) }) }),
    })
    mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/x' })

    const body = JSON.stringify({ plan: 'premium', successUrl: 'http://x/success', cancelUrl: 'http://x/cancel' })
    const headers = { ...authHeader(), 'Content-Type': 'application/json' }

    // First 10 requests succeed
    for (let i = 0; i < 10; i++) {
      const res = await app.request('/checkout', { method: 'POST', headers, body })
      expect(res.status).toBe(200)
    }

    // 11th request is rate-limited
    const res = await app.request('/checkout', { method: 'POST', headers, body })
    expect(res.status).toBe(429)
  })

  it('creates a new Stripe customer when stripe_customer_id is null', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com' } }, error: null })

    const selectMock = { data: { stripe_customer_id: null }, error: null }
    const updateMock = { eq: vi.fn().mockResolvedValue({ error: null }) }
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(selectMock) }) }),
      update: vi.fn().mockReturnValue(updateMock),
    })

    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' })
    mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session2' })

    const res = await app.request('/checkout', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro', successUrl: 'http://x/success', cancelUrl: 'http://x/cancel' }),
    })
    expect(res.status).toBe(200)
    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      email: 'a@b.com',
      metadata: { supabase_user_id: 'user-1' },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pnpm test test/checkout.test.ts
```

Expected: FAIL — `Cannot find module` or route not found (404)

- [ ] **Step 3: Create `backend/src/routes/checkout.ts`**

```ts
import { Hono } from 'hono'
import stripe from '../lib/stripe.ts'
import supabase from '../lib/supabase.ts'

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// Exported for test cleanup only — not part of the public API
export function resetRateLimitForTesting() {
  rateLimitMap.clear()
}

const checkout = new Hono()

checkout.post('/', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization' }, 401)
  }
  const token = authHeader.slice(7)

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  if (!checkRateLimit(user.id)) {
    return c.json({ error: 'Too many requests' }, 429)
  }

  const { plan, successUrl, cancelUrl } = await c.req.json<{
    plan: string
    successUrl: string
    cancelUrl: string
  }>()

  if (!plan || !['premium', 'pro'].includes(plan)) {
    return c.json({ error: 'plan must be "premium" or "pro"' }, 400)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId: string = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const priceId = plan === 'premium'
    ? process.env.STRIPE_PRICE_ID_PREMIUM!
    : process.env.STRIPE_PRICE_ID_PRO!

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { plan },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return c.json({ url: session.url })
})

export default checkout
```

- [ ] **Step 4: Register the route in `backend/src/index.ts`**

Add `import checkout from './routes/checkout.ts'` and `app.route('/checkout', checkout)` after the health route:

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health.ts'
import checkout from './routes/checkout.ts'

const app = new Hono()

app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))

app.route('/health', health)
app.route('/checkout', checkout)

const port = Number(process.env.PORT ?? 3000)

if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on port ${port}`)
  })
}

export default app
```

- [ ] **Step 5: Run all tests to verify they pass**

```bash
cd backend
pnpm test
```

Expected: PASS — 7 tests (1 health + 6 checkout).

- [ ] **Step 6: Commit**

```bash
cd ..
git add backend/src/routes/checkout.ts backend/src/index.ts backend/test/checkout.test.ts
git commit -m "feat: add POST /checkout endpoint"
```

---

### Task 8: POST /webhooks/stripe endpoint

**Files:**
- Create: `backend/src/routes/webhooks.ts`
- Create: `backend/test/webhooks.test.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/webhooks.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import app from '../src/index.ts'

vi.mock('../src/lib/supabase.ts', () => ({
  default: {
    from: vi.fn(),
  },
}))

vi.mock('../src/lib/stripe.ts', () => ({
  default: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  },
}))

import supabase from '../src/lib/supabase.ts'
import stripe from '../src/lib/stripe.ts'

const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> }
const mockStripe = stripe as unknown as {
  webhooks: { constructEvent: ReturnType<typeof vi.fn> }
}

function makeUpdateChain() {
  const eqMock = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
  mockSupabase.from.mockReturnValue({ update: updateMock })
  return { updateMock, eqMock }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_PRICE_ID_PREMIUM = 'price_premium'
  process.env.STRIPE_PRICE_ID_PRO = 'price_pro'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
})

describe('POST /webhooks/stripe', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      body: 'payload',
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when signature verification fails', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('invalid signature')
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'bad-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(400)
  })

  it('handles checkout.session.completed — sets plan and subscription_id', async () => {
    const { updateMock, eqMock } = makeUpdateChain()

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { plan: 'premium' },
          customer: 'cus_123',
          subscription: 'sub_abc',
        },
      },
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({
      plan: 'premium',
      stripe_subscription_id: 'sub_abc',
      subscription_status: 'active',
    })
    expect(eqMock).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
  })

  it('handles customer.subscription.updated — active status updates plan', async () => {
    const { updateMock } = makeUpdateChain()

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          status: 'active',
          customer: 'cus_123',
          items: { data: [{ price: { id: 'price_pro' } }] },
        },
      },
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ plan: 'pro', subscription_status: 'active' })
  })

  it('handles customer.subscription.updated — past_due keeps plan, updates status only', async () => {
    const { updateMock } = makeUpdateChain()

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          status: 'past_due',
          customer: 'cus_123',
          items: { data: [{ price: { id: 'price_premium' } }] },
        },
      },
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ subscription_status: 'past_due' })
  })

  it('handles customer.subscription.deleted — resets to free', async () => {
    const { updateMock } = makeUpdateChain()

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: 'cus_123',
        },
      },
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({
      plan: 'free',
      stripe_subscription_id: null,
      subscription_status: 'canceled',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pnpm test test/webhooks.test.ts
```

Expected: FAIL — route not found (404 on all requests)

- [ ] **Step 3: Create `backend/src/routes/webhooks.ts`**

```ts
import { Hono } from 'hono'
import type Stripe from 'stripe'
import stripeClient from '../lib/stripe.ts'
import supabase from '../lib/supabase.ts'
import { PRICE_TO_PLAN } from '../lib/plans.ts'

const webhooks = new Hono()

webhooks.post('/stripe', async (c) => {
  const sig = c.req.header('stripe-signature')
  if (!sig) {
    return c.json({ error: 'Missing stripe-signature' }, 400)
  }

  const body = await c.req.text()
  let event: Stripe.Event

  try {
    event = stripeClient.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    return c.json({ error: 'Invalid signature' }, 400)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const plan = session.metadata?.plan as 'premium' | 'pro'
      const customerId = session.customer as string
      await supabase
        .from('profiles')
        .update({
          plan,
          stripe_subscription_id: session.subscription as string,
          subscription_status: 'active',
        })
        .eq('stripe_customer_id', customerId)
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const priceId = sub.items.data[0].price.id

      if (sub.status === 'active' || sub.status === 'trialing') {
        const plan = PRICE_TO_PLAN[priceId] ?? 'free'
        await supabase
          .from('profiles')
          .update({ plan, subscription_status: sub.status })
          .eq('stripe_customer_id', customerId)
      } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
        await supabase
          .from('profiles')
          .update({ subscription_status: sub.status })
          .eq('stripe_customer_id', customerId)
      } else if (sub.status === 'canceled') {
        await supabase
          .from('profiles')
          .update({ plan: 'free', stripe_subscription_id: null, subscription_status: 'canceled' })
          .eq('stripe_customer_id', customerId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      await supabase
        .from('profiles')
        .update({ plan: 'free', stripe_subscription_id: null, subscription_status: 'canceled' })
        .eq('stripe_customer_id', customerId)
      break
    }
  }

  return c.json({ received: true })
})

export default webhooks
```

- [ ] **Step 4: Register the route in `backend/src/index.ts`**

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health.ts'
import checkout from './routes/checkout.ts'
import webhooks from './routes/webhooks.ts'

const app = new Hono()

app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))

app.route('/health', health)
app.route('/checkout', checkout)
app.route('/webhooks', webhooks)

const port = Number(process.env.PORT ?? 3000)

if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on port ${port}`)
  })
}

export default app
```

- [ ] **Step 5: Run all tests**

```bash
cd backend
pnpm test
```

Expected: PASS — all tests pass (1 health + 6 checkout + 6 webhooks = 13 tests)

- [ ] **Step 6: Commit**

```bash
cd ..
git add backend/src/routes/webhooks.ts backend/src/index.ts backend/test/webhooks.test.ts
git commit -m "feat: add POST /webhooks/stripe endpoint"
```

---

## Next plans

This plan delivers a working, tested Hono backend and Supabase schema. The remaining work is split into three follow-up plans:

- **Plan 2** (`2026-03-15-frontend-auth.md`): Wire `LoginPage` to Supabase Auth, add `SignupPage`, `AuthProvider` context, route protection
- **Plan 3** (`2026-03-15-frontend-data-layer.md`): Replace Zustand localStorage persistence with Supabase queries
- **Plan 4** (`2026-03-15-frontend-subscription-ui.md`): Plan limits in UI, `useProfileStore`, upgrade buttons, Stripe redirect, post-payment polling
