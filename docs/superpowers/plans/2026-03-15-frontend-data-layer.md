# TripMate Phase 3 — Frontend Data Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Zustand `persist` (localStorage) with Supabase queries so all trip data is persisted to the database.

**Architecture:** Pure mapper functions convert Supabase snake_case rows ↔ camelCase frontend types. Zustand store loses `persist` middleware and gains async CRUD actions + `fetchDestinations(userId)` + `clearDestinations()`. A `useDestinationsSync` hook wired in `App.tsx` fetches on login and clears on logout. Sheets are updated to pass `userId` from `useAuth()`. A `LocalDataImport` component handles one-time migration from any existing localStorage data.

**Tech Stack:** React 19, TypeScript, Zustand 5 (no persist middleware), @supabase/supabase-js, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-backend-stripe-design.md`

---

## Chunk 1: Mapper Functions

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/tripsMapper.ts` | Create | snake_case DB rows ↔ camelCase frontend types |
| `src/lib/tripsMapper.test.ts` | Create | Unit tests for all mapper functions |

---

### Task 1: Create tripsMapper.ts with TDD

**Files:**
- Create: `src/lib/tripsMapper.ts`
- Create: `src/lib/tripsMapper.test.ts`

- [ ] **Step 1: Write failing tests — create `src/lib/tripsMapper.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import {
  dbDestinationToDestination,
  dbEventToTripEvent,
  destinationToDbInsert,
  tripEventToDbInsert,
  destinationToDbUpdate,
  eventToDbUpdate,
  type DbDestination,
  type DbEvent,
} from './tripsMapper'

const dbDest: DbDestination = {
  id: 'dest-1',
  user_id: 'user-1',
  title: 'Japan 2026',
  emoji: '✈️',
  start_date: '2026-03-15',
  end_date: '2026-04-02',
  created_at: '2026-01-01T00:00:00Z',
}

const dbEvent: DbEvent = {
  id: 'ev-1',
  destination_id: 'dest-1',
  user_id: 'user-1',
  type: 'transport',
  title: 'Flight GRU→NRT',
  place: 'GRU Airport',
  place_id: 'gid-1',
  lat: -23.4,
  lng: -46.5,
  place_to: 'Narita Airport',
  place_id_to: 'gid-2',
  lat_to: 35.7,
  lng_to: 140.4,
  arrival_time: '18:00',
  date: '2026-03-15',
  time: '10:00',
  value: 1200,
  notes: 'Window seat',
  arrived_on_foot: false,
  created_at: '2026-01-02T00:00:00Z',
}

describe('dbDestinationToDestination', () => {
  it('maps snake_case columns to camelCase fields', () => {
    const result = dbDestinationToDestination(dbDest, [])
    expect(result.id).toBe('dest-1')
    expect(result.title).toBe('Japan 2026')
    expect(result.emoji).toBe('✈️')
    expect(result.startDate).toBe('2026-03-15')
    expect(result.endDate).toBe('2026-04-02')
    expect(result.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(result.events).toEqual([])
  })

  it('attaches provided events array', () => {
    const events = [dbEventToTripEvent(dbEvent)]
    const result = dbDestinationToDestination(dbDest, events)
    expect(result.events).toHaveLength(1)
    expect(result.events[0].title).toBe('Flight GRU→NRT')
  })

  it('does not include user_id in the result', () => {
    const result = dbDestinationToDestination(dbDest, [])
    expect((result as Record<string, unknown>).user_id).toBeUndefined()
  })
})

describe('dbEventToTripEvent', () => {
  it('maps all snake_case columns to camelCase fields', () => {
    const result = dbEventToTripEvent(dbEvent)
    expect(result.id).toBe('ev-1')
    expect(result.destinationId).toBe('dest-1')
    expect(result.type).toBe('transport')
    expect(result.title).toBe('Flight GRU→NRT')
    expect(result.place).toBe('GRU Airport')
    expect(result.placeId).toBe('gid-1')
    expect(result.lat).toBe(-23.4)
    expect(result.lng).toBe(-46.5)
    expect(result.placeTo).toBe('Narita Airport')
    expect(result.placeIdTo).toBe('gid-2')
    expect(result.latTo).toBe(35.7)
    expect(result.lngTo).toBe(140.4)
    expect(result.arrivalTime).toBe('18:00')
    expect(result.date).toBe('2026-03-15')
    expect(result.time).toBe('10:00')
    expect(result.value).toBe(1200)
    expect(result.notes).toBe('Window seat')
    expect(result.arrivedOnFoot).toBe(false)
    expect(result.createdAt).toBe('2026-01-02T00:00:00Z')
  })

  it('converts null nullable columns to undefined', () => {
    const sparse: DbEvent = {
      ...dbEvent,
      place_id: null,
      lat: null,
      lng: null,
      place_to: null,
      place_id_to: null,
      lat_to: null,
      lng_to: null,
      arrival_time: null,
      value: null,
      notes: null,
      arrived_on_foot: null,
    }
    const result = dbEventToTripEvent(sparse)
    expect(result.placeId).toBeUndefined()
    expect(result.lat).toBeUndefined()
    expect(result.lng).toBeUndefined()
    expect(result.placeTo).toBeUndefined()
    expect(result.placeIdTo).toBeUndefined()
    expect(result.latTo).toBeUndefined()
    expect(result.lngTo).toBeUndefined()
    expect(result.arrivalTime).toBeUndefined()
    expect(result.value).toBeUndefined()
    expect(result.notes).toBeUndefined()
    expect(result.arrivedOnFoot).toBeUndefined()
  })

  it('does not include user_id in the result', () => {
    const result = dbEventToTripEvent(dbEvent)
    expect((result as Record<string, unknown>).user_id).toBeUndefined()
  })
})

describe('destinationToDbInsert', () => {
  it('maps camelCase fields to snake_case with userId', () => {
    const result = destinationToDbInsert(
      { title: 'Japan', emoji: '✈️', startDate: '2026-03-15', endDate: '2026-04-02' },
      'user-1'
    )
    expect(result.user_id).toBe('user-1')
    expect(result.title).toBe('Japan')
    expect(result.emoji).toBe('✈️')
    expect(result.start_date).toBe('2026-03-15')
    expect(result.end_date).toBe('2026-04-02')
  })
})

describe('tripEventToDbInsert', () => {
  it('maps camelCase fields to snake_case with destinationId and userId', () => {
    const result = tripEventToDbInsert(
      {
        destinationId: 'dest-1',
        type: 'transport',
        title: 'Flight',
        place: 'GRU',
        placeId: 'gid-1',
        lat: -23.4,
        lng: -46.5,
        placeTo: 'NRT',
        placeIdTo: 'gid-2',
        latTo: 35.7,
        lngTo: 140.4,
        arrivalTime: '18:00',
        date: '2026-03-15',
        time: '10:00',
        value: 1200,
        notes: 'Note',
        arrivedOnFoot: false,
      },
      'user-1'
    )
    expect(result.destination_id).toBe('dest-1')
    expect(result.user_id).toBe('user-1')
    expect(result.place_id).toBe('gid-1')
    expect(result.place_to).toBe('NRT')
    expect(result.place_id_to).toBe('gid-2')
    expect(result.lat_to).toBe(35.7)
    expect(result.lng_to).toBe(140.4)
    expect(result.arrival_time).toBe('18:00')
    expect(result.arrived_on_foot).toBe(false)
  })

  it('converts undefined optional fields to null', () => {
    const result = tripEventToDbInsert(
      {
        destinationId: 'dest-1',
        type: 'accommodation',
        title: 'Hotel',
        place: 'Tokyo',
        date: '2026-03-15',
        time: '14:00',
      },
      'user-1'
    )
    expect(result.place_id).toBeNull()
    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
    expect(result.place_to).toBeNull()
    expect(result.arrival_time).toBeNull()
    expect(result.value).toBeNull()
    expect(result.notes).toBeNull()
    expect(result.arrived_on_foot).toBeNull()
  })
})

describe('destinationToDbUpdate', () => {
  it('only includes provided fields, mapped to snake_case', () => {
    const result = destinationToDbUpdate({ title: 'New Title', endDate: '2026-05-01' })
    expect(result.title).toBe('New Title')
    expect(result.end_date).toBe('2026-05-01')
    expect('start_date' in result).toBe(false)
    expect('emoji' in result).toBe(false)
  })
})

describe('eventToDbUpdate', () => {
  it('only includes provided fields, mapped to snake_case', () => {
    const result = eventToDbUpdate({ title: 'Updated', arrivedOnFoot: true })
    expect(result.title).toBe('Updated')
    expect(result.arrived_on_foot).toBe(true)
    expect('place' in result).toBe(false)
  })

  it('includes null for explicitly-cleared optional fields', () => {
    const result = eventToDbUpdate({ placeId: undefined, value: undefined })
    expect(result.place_id).toBeNull()
    expect(result.value).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — verify they ALL fail**

```bash
pnpm exec vitest run src/lib/tripsMapper.test.ts
```

Expected: All 12 tests FAIL with "Cannot find module './tripsMapper'".

- [ ] **Step 3: Implement `src/lib/tripsMapper.ts`**

```ts
import type { Destination, TripEvent, EventType } from '../types/trip'

// ─── DB row types (snake_case, matching Supabase schema) ────────────────────

export interface DbDestination {
  id: string
  user_id: string
  title: string
  emoji: string
  start_date: string
  end_date: string
  created_at: string
}

export interface DbEvent {
  id: string
  destination_id: string
  user_id: string
  type: EventType
  title: string
  place: string
  place_id: string | null
  lat: number | null
  lng: number | null
  place_to: string | null
  place_id_to: string | null
  lat_to: number | null
  lng_to: number | null
  arrival_time: string | null
  date: string
  time: string
  value: number | null
  notes: string | null
  arrived_on_foot: boolean | null
  created_at: string
}

// ─── DB → Frontend ──────────────────────────────────────────────────────────

export function dbDestinationToDestination(row: DbDestination, events: TripEvent[]): Destination {
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    startDate: row.start_date,
    endDate: row.end_date,
    events,
    createdAt: row.created_at,
  }
}

export function dbEventToTripEvent(row: DbEvent): TripEvent {
  return {
    id: row.id,
    destinationId: row.destination_id,
    type: row.type,
    title: row.title,
    place: row.place,
    placeId: row.place_id ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    placeTo: row.place_to ?? undefined,
    placeIdTo: row.place_id_to ?? undefined,
    latTo: row.lat_to ?? undefined,
    lngTo: row.lng_to ?? undefined,
    arrivalTime: row.arrival_time ?? undefined,
    date: row.date,
    time: row.time,
    value: row.value ?? undefined,
    notes: row.notes ?? undefined,
    arrivedOnFoot: row.arrived_on_foot ?? undefined,
    createdAt: row.created_at,
  }
}

// ─── Frontend → DB insert payloads ──────────────────────────────────────────

export function destinationToDbInsert(
  d: Omit<Destination, 'id' | 'events' | 'createdAt'>,
  userId: string
) {
  return {
    user_id: userId,
    title: d.title,
    emoji: d.emoji,
    start_date: d.startDate,
    end_date: d.endDate,
  }
}

export function tripEventToDbInsert(
  e: Omit<TripEvent, 'id' | 'createdAt'>,
  userId: string
) {
  return {
    destination_id: e.destinationId,
    user_id: userId,
    type: e.type,
    title: e.title,
    place: e.place,
    place_id: e.placeId ?? null,
    lat: e.lat ?? null,
    lng: e.lng ?? null,
    place_to: e.placeTo ?? null,
    place_id_to: e.placeIdTo ?? null,
    lat_to: e.latTo ?? null,
    lng_to: e.lngTo ?? null,
    arrival_time: e.arrivalTime ?? null,
    date: e.date,
    time: e.time,
    value: e.value ?? null,
    notes: e.notes ?? null,
    arrived_on_foot: e.arrivedOnFoot ?? null,
  }
}

// ─── Frontend → DB update payloads (only provided fields) ───────────────────

export function destinationToDbUpdate(
  patch: Partial<Omit<Destination, 'id' | 'events' | 'createdAt'>>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (patch.title !== undefined) result.title = patch.title
  if (patch.emoji !== undefined) result.emoji = patch.emoji
  if (patch.startDate !== undefined) result.start_date = patch.startDate
  if (patch.endDate !== undefined) result.end_date = patch.endDate
  return result
}

export function eventToDbUpdate(
  patch: Partial<Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (patch.type !== undefined) result.type = patch.type
  if (patch.title !== undefined) result.title = patch.title
  if (patch.place !== undefined) result.place = patch.place
  if ('placeId' in patch) result.place_id = patch.placeId ?? null
  if ('lat' in patch) result.lat = patch.lat ?? null
  if ('lng' in patch) result.lng = patch.lng ?? null
  if ('placeTo' in patch) result.place_to = patch.placeTo ?? null
  if ('placeIdTo' in patch) result.place_id_to = patch.placeIdTo ?? null
  if ('latTo' in patch) result.lat_to = patch.latTo ?? null
  if ('lngTo' in patch) result.lng_to = patch.lngTo ?? null
  if ('arrivalTime' in patch) result.arrival_time = patch.arrivalTime ?? null
  if (patch.date !== undefined) result.date = patch.date
  if (patch.time !== undefined) result.time = patch.time
  if ('value' in patch) result.value = patch.value ?? null
  if ('notes' in patch) result.notes = patch.notes ?? null
  if ('arrivedOnFoot' in patch) result.arrived_on_foot = patch.arrivedOnFoot ?? null
  return result
}
```

- [ ] **Step 4: Run mapper tests — verify all 12 pass**

```bash
pnpm exec vitest run src/lib/tripsMapper.test.ts
```

Expected: `12 passed`.

- [ ] **Step 5: Run all tests to verify nothing broken**

```bash
pnpm exec vitest run
```

Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tripsMapper.ts src/lib/tripsMapper.test.ts
git commit -m "feat: add tripsMapper — DB row ↔ frontend type conversion functions"
```

---

## Chunk 2: Zustand Store (Async)

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/stores/tripsStore.ts` | Rewrite | Remove persist, async CRUD via Supabase |
| `src/stores/tripsStore.test.ts` | Rewrite | Mock Supabase, test async actions |

---

### Task 2: Rewrite tripsStore.ts with async Supabase actions (TDD)

**Files:**
- Rewrite: `src/stores/tripsStore.ts`
- Rewrite: `src/stores/tripsStore.test.ts`

- [ ] **Step 1: Write failing tests — replace `src/stores/tripsStore.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTripsStore } from './tripsStore'
import type { DbDestination, DbEvent } from '../lib/tripsMapper'

// ─── Supabase mock ───────────────────────────────────────────────────────────

const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ─── Mock chain builder ───────────────────────────────────────────────────────
// Each call to mockFrom returns a fresh chain with configurable resolved values.

function buildChain(opts: {
  selectResult?: { data: unknown; error: null | { message: string } }
  insertResult?: { data: unknown; error: null | { message: string } }
  deleteResult?: { error: null | { message: string } }
  updateResult?: { error: null | { message: string } }
}) {
  const { selectResult, insertResult, deleteResult, updateResult } = opts
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue(selectResult ?? { data: [], error: null }),
        // for trip_events select (no order)
        then: undefined,  // not a promise itself
      }),
      // for trip_events select (just .eq, no .order)
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(insertResult ?? { data: null, error: null }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(deleteResult ?? { error: null }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(updateResult ?? { error: null }),
    }),
  }
}

// ─── DB fixtures ─────────────────────────────────────────────────────────────

function makeDbDest(overrides: Partial<DbDestination> = {}): DbDestination {
  return {
    id: 'dest-1',
    user_id: 'user-1',
    title: 'Japan 2026',
    emoji: '✈️',
    start_date: '2026-03-15',
    end_date: '2026-04-02',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDbEvent(overrides: Partial<DbEvent> = {}): DbEvent {
  return {
    id: 'ev-1',
    destination_id: 'dest-1',
    user_id: 'user-1',
    type: 'transport',
    title: 'Flight',
    place: 'GRU',
    place_id: null,
    lat: null,
    lng: null,
    place_to: null,
    place_id_to: null,
    lat_to: null,
    lng_to: null,
    arrival_time: null,
    date: '2026-03-15',
    time: '10:00',
    value: null,
    notes: null,
    arrived_on_foot: null,
    created_at: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  useTripsStore.setState({ destinations: [], loading: false })
  mockFrom.mockReset()
})

describe('fetchDestinations', () => {
  it('fetches destinations and their events, populates store', async () => {
    const dbDest = makeDbDest()
    const dbEvent = makeDbEvent()

    // First call: destinations table
    // Second call: trip_events table
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [dbDest], error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [dbEvent], error: null }),
        }),
      })

    await useTripsStore.getState().fetchDestinations('user-1')

    const { destinations, loading } = useTripsStore.getState()
    expect(destinations).toHaveLength(1)
    expect(destinations[0].title).toBe('Japan 2026')
    expect(destinations[0].startDate).toBe('2026-03-15')
    expect(destinations[0].events).toHaveLength(1)
    expect(destinations[0].events[0].title).toBe('Flight')
    expect(loading).toBe(false)
  })

  it('sets destinations to [] when user has no destinations', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })

    await useTripsStore.getState().fetchDestinations('user-1')
    expect(useTripsStore.getState().destinations).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })

    await expect(useTripsStore.getState().fetchDestinations('user-1')).rejects.toThrow('DB error')
  })
})

describe('clearDestinations', () => {
  it('resets destinations to empty array without hitting Supabase', () => {
    useTripsStore.setState({ destinations: [{ id: 'x', title: 'T', emoji: '✈️', startDate: '', endDate: '', events: [], createdAt: '' }] })
    useTripsStore.getState().clearDestinations()
    expect(useTripsStore.getState().destinations).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('addDestination', () => {
  it('inserts into Supabase and prepends result to destinations', async () => {
    const dbDest = makeDbDest()
    mockFrom.mockReturnValueOnce(buildChain({ insertResult: { data: dbDest, error: null } }))

    await useTripsStore.getState().addDestination('user-1', {
      title: 'Japan 2026',
      emoji: '✈️',
      startDate: '2026-03-15',
      endDate: '2026-04-02',
    })

    const { destinations } = useTripsStore.getState()
    expect(destinations).toHaveLength(1)
    expect(destinations[0].title).toBe('Japan 2026')
    expect(destinations[0].startDate).toBe('2026-03-15')
    expect(destinations[0].events).toEqual([])
  })

  it('returns the newly created Destination', async () => {
    const dbDest = makeDbDest()
    mockFrom.mockReturnValueOnce(buildChain({ insertResult: { data: dbDest, error: null } }))

    const result = await useTripsStore.getState().addDestination('user-1', {
      title: 'Japan 2026',
      emoji: '✈️',
      startDate: '2026-03-15',
      endDate: '2026-04-02',
    })

    expect(result.id).toBe('dest-1')
    expect(result.title).toBe('Japan 2026')
    expect(result.events).toEqual([])
  })

  it('throws when Supabase insert returns an error', async () => {
    mockFrom.mockReturnValueOnce(buildChain({ insertResult: { data: null, error: { message: 'Plan limit reached' } } }))

    await expect(
      useTripsStore.getState().addDestination('user-1', { title: 'T', emoji: '✈️', startDate: '2026-01-01', endDate: '2026-01-07' })
    ).rejects.toThrow('Plan limit reached')
  })
})

describe('deleteDestination', () => {
  it('calls Supabase delete and removes destination from store', async () => {
    useTripsStore.setState({ destinations: [{ id: 'dest-1', title: 'Japan', emoji: '✈️', startDate: '', endDate: '', events: [], createdAt: '' }] })
    mockFrom.mockReturnValueOnce(buildChain({ deleteResult: { error: null } }))

    await useTripsStore.getState().deleteDestination('dest-1')

    expect(useTripsStore.getState().destinations).toHaveLength(0)
  })
})

describe('addEvent', () => {
  it('inserts into Supabase and appends event to correct destination', async () => {
    useTripsStore.setState({
      destinations: [{ id: 'dest-1', title: 'Japan', emoji: '✈️', startDate: '', endDate: '', events: [], createdAt: '' }],
    })
    const dbEv = makeDbEvent()
    mockFrom.mockReturnValueOnce(buildChain({ insertResult: { data: dbEv, error: null } }))

    await useTripsStore.getState().addEvent('dest-1', 'user-1', {
      destinationId: 'dest-1',
      type: 'transport',
      title: 'Flight',
      place: 'GRU',
      date: '2026-03-15',
      time: '10:00',
    })

    const events = useTripsStore.getState().destinations[0].events
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Flight')
    expect(events[0].destinationId).toBe('dest-1')
  })
})

describe('deleteEvent', () => {
  it('calls Supabase delete and removes event from destination', async () => {
    useTripsStore.setState({
      destinations: [{
        id: 'dest-1', title: 'Japan', emoji: '✈️', startDate: '', endDate: '', createdAt: '',
        events: [{ id: 'ev-1', destinationId: 'dest-1', type: 'transport', title: 'Flight', place: 'GRU', date: '2026-03-15', time: '10:00', createdAt: '' }],
      }],
    })
    mockFrom.mockReturnValueOnce(buildChain({ deleteResult: { error: null } }))

    await useTripsStore.getState().deleteEvent('dest-1', 'ev-1')

    expect(useTripsStore.getState().destinations[0].events).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they ALL fail**

```bash
pnpm exec vitest run src/stores/tripsStore.test.ts
```

Expected: All 10 tests FAIL (store still has old synchronous implementation with persist).

- [ ] **Step 3: Replace `src/stores/tripsStore.ts` with async Supabase implementation**

```ts
import { create } from 'zustand'
import type { Destination, TripEvent } from '../types/trip'
import { assignEmoji } from '../lib/travelEmojis'
import { supabase } from '../lib/supabase'
import {
  dbDestinationToDestination,
  dbEventToTripEvent,
  destinationToDbInsert,
  tripEventToDbInsert,
  destinationToDbUpdate,
  eventToDbUpdate,
} from '../lib/tripsMapper'

interface TripsState {
  destinations: Destination[]
  loading: boolean
  fetchDestinations: (userId: string) => Promise<void>
  clearDestinations: () => void
  addDestination: (userId: string, d: Omit<Destination, 'id' | 'events' | 'createdAt'>) => Promise<Destination>
  updateDestination: (id: string, patch: Partial<Omit<Destination, 'id' | 'events'>>) => Promise<void>
  deleteDestination: (id: string) => Promise<void>
  addEvent: (destinationId: string, userId: string, e: Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>) => Promise<void>
  updateEvent: (destinationId: string, eventId: string, patch: Partial<Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>>) => Promise<void>
  deleteEvent: (destinationId: string, eventId: string) => Promise<void>
}

export const useTripsStore = create<TripsState>()((set, get) => ({
  destinations: [],
  loading: false,

  fetchDestinations: async (userId) => {
    set({ loading: true })
    const { data: destRows, error: destError } = await supabase
      .from('destinations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (destError) {
      set({ loading: false })
      throw new Error(destError.message)
    }

    const { data: eventRows, error: eventError } = await supabase
      .from('trip_events')
      .select('*')
      .eq('user_id', userId)
    if (eventError) {
      set({ loading: false })
      throw new Error(eventError.message)
    }

    const destinations = (destRows ?? []).map(row => {
      const events = (eventRows ?? [])
        .filter(e => e.destination_id === row.id)
        .map(dbEventToTripEvent)
      return dbDestinationToDestination(row, events)
    })

    set({ destinations, loading: false })
  },

  clearDestinations: () => {
    set({ destinations: [] })
  },

  addDestination: async (userId, d) => {
    const emoji = d.emoji || assignEmoji(get().destinations.length)
    const { data, error } = await supabase
      .from('destinations')
      .insert(destinationToDbInsert({ ...d, emoji }, userId))
      .select()
      .single()
    if (error) throw new Error(error.message)
    const newDest = dbDestinationToDestination(data, [])
    set(state => ({ destinations: [newDest, ...state.destinations] }))
    return newDest
  },

  updateDestination: async (id, patch) => {
    const { error } = await supabase
      .from('destinations')
      .update(destinationToDbUpdate(patch))
      .eq('id', id)
    if (error) throw new Error(error.message)
    set(state => ({
      destinations: state.destinations.map(d =>
        d.id === id ? { ...d, ...patch } : d
      ),
    }))
  },

  deleteDestination: async (id) => {
    const { error } = await supabase
      .from('destinations')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
    set(state => ({
      destinations: state.destinations.filter(d => d.id !== id),
    }))
  },

  addEvent: async (destinationId, userId, e) => {
    const { data, error } = await supabase
      .from('trip_events')
      .insert(tripEventToDbInsert({ ...e, destinationId }, userId))
      .select()
      .single()
    if (error) throw new Error(error.message)
    const newEvent = dbEventToTripEvent(data)
    set(state => ({
      destinations: state.destinations.map(d =>
        d.id === destinationId
          ? { ...d, events: [...d.events, newEvent] }
          : d
      ),
    }))
  },

  updateEvent: async (destinationId, eventId, patch) => {
    const { error } = await supabase
      .from('trip_events')
      .update(eventToDbUpdate(patch))
      .eq('id', eventId)
    if (error) throw new Error(error.message)
    set(state => ({
      destinations: state.destinations.map(d =>
        d.id === destinationId
          ? {
              ...d,
              events: d.events.map(e =>
                e.id === eventId ? { ...e, ...patch } : e
              ),
            }
          : d
      ),
    }))
  },

  deleteEvent: async (destinationId, eventId) => {
    const { error } = await supabase
      .from('trip_events')
      .delete()
      .eq('id', eventId)
    if (error) throw new Error(error.message)
    set(state => ({
      destinations: state.destinations.map(d =>
        d.id === destinationId
          ? { ...d, events: d.events.filter(e => e.id !== eventId) }
          : d
      ),
    }))
  },
}))
```

- [ ] **Step 4: Run store tests — verify all 10 pass**

```bash
pnpm exec vitest run src/stores/tripsStore.test.ts
```

Expected: `10 passed`.

- [ ] **Step 5: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass (some TripsPage/TripDetailPage/AddEventSheet tests may fail because they call store actions without userId — check and fix).

> **Note:** TripsPage and TripDetailPage tests use `useTripsStore.setState(...)` directly, bypassing the async actions. They should still pass. Only the AddEventSheet tests call `addEvent`/`updateEvent`/`deleteEvent` — check if they need updating. If addEvent signature changed in the sheet, fix the sheet's call site.

- [ ] **Step 6: Commit**

```bash
git add src/stores/tripsStore.ts src/stores/tripsStore.test.ts
git commit -m "feat: rewrite tripsStore — remove persist, async Supabase CRUD"
```

---

## Chunk 3: Sheets, Sync Hook, and Migration

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/sheets/NewDestinationSheet.tsx` | Modify | Pass userId from useAuth() to addDestination |
| `src/components/sheets/AddEventSheet.tsx` | Modify | Pass userId from useAuth() to addEvent |
| `src/hooks/useDestinationsSync.ts` | Create | Fetch on login, clear on logout |
| `src/App.tsx` | Modify | Wire useDestinationsSync via AppRoutes inner component |
| `src/components/LocalDataImport.tsx` | Create | One-time migration prompt for localStorage data |

---

### Task 3: Update NewDestinationSheet to pass userId

**Files:**
- Modify: `src/components/sheets/NewDestinationSheet.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/sheets/NewDestinationSheet.tsx` to understand the current `handleSubmit`.

- [ ] **Step 2: Update `handleSubmit` to use userId from useAuth**

In `NewDestinationSheet.tsx`:

1. Add import: `import { useAuth } from '@/contexts/AuthContext'`
2. Inside the component, add: `const { user } = useAuth()`
3. Change the `addDestination` call signature: `addDestination(user!.id, { title: title.trim(), startDate, endDate, emoji: '' })`
4. Make `handleSubmit` async and add `await` before `addDestination(...)`
5. Wrap in try/catch:

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  const errs: typeof errors = {}
  if (!title.trim()) errs.title = 'Title is required'
  if (endDate && startDate && endDate < startDate) errs.endDate = 'End date must be after start date'
  if (Object.keys(errs).length) { setErrors(errs); return }

  try {
    await addDestination(user!.id, { title: title.trim(), startDate, endDate, emoji: '' })
    setTitle('')
    setStartDate('')
    setEndDate('')
    setErrors({})
    onClose()
  } catch (err) {
    setErrors({ title: err instanceof Error ? err.message : 'Failed to create destination' })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

---

### Task 4: Update AddEventSheet to pass userId

**Files:**
- Modify: `src/components/sheets/AddEventSheet.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/sheets/AddEventSheet.tsx` to understand current calls to `addEvent`, `updateEvent`, `deleteEvent`.

- [ ] **Step 2: Update AddEventSheet**

1. Add import: `import { useAuth } from '@/contexts/AuthContext'`
2. Inside the component, add: `const { user } = useAuth()`
3. Change `handleSubmit` to be `async` and update the `addEvent` call:
   - `await addEvent(destinationId, user!.id, data)` (add userId as second argument)
   - `await updateEvent(destinationId, editEvent!.id, data)`
4. Change `handleDelete` to be `async`:
   - `await deleteEvent(destinationId, editEvent!.id)`
5. Wrap each in try/catch — on error, add an `authError` state and display it, or use a simple `alert(err.message)` for now.

The minimal change (preferred, no new state):

```tsx
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  const errs = validate()
  if (Object.keys(errs).length) { setErrors(errs); return }

  const data = {
    type,
    title: title.trim(),
    place: place.trim(),
    placeId,
    date,
    time,
    value: value !== '' ? Number(value) : undefined,
    notes: notes.trim() || undefined,
    // preserve transport-specific fields from editEvent when editing
    ...(isEdit ? {
      placeTo: editEvent!.placeTo,
      placeIdTo: editEvent!.placeIdTo,
      latTo: editEvent!.latTo,
      lngTo: editEvent!.lngTo,
      arrivalTime: editEvent!.arrivalTime,
      arrivedOnFoot: editEvent!.arrivedOnFoot,
    } : {}),
  }

  try {
    if (isEdit) {
      await updateEvent(destinationId, editEvent!.id, data)
    } else {
      await addEvent(destinationId, user!.id, data)
    }
    onClose()
  } catch (err) {
    console.error('Failed to save event:', err)
  }
}

async function handleDelete() {
  if (window.confirm('Delete this event?')) {
    try {
      await deleteEvent(destinationId, editEvent!.id)
      onClose()
    } catch (err) {
      console.error('Failed to delete event:', err)
    }
  }
}
```

- [ ] **Step 3: Update AddEventSheet tests — mock useAuth**

In `src/components/sheets/AddEventSheet.test.tsx`, the test calls `addEvent` via the store. Since `addEvent` is now async and calls Supabase, the tests need a Supabase mock. Add at the top of the test file:

```ts
const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { from: mockFrom } }))

const mockUseAuth = vi.hoisted(() => vi.fn())
vi.mock('@/contexts/AuthContext', () => ({ useAuth: mockUseAuth }))
```

In `beforeEach`:
```ts
mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, session: {}, loading: false, signOut: vi.fn() })
mockFrom.mockReturnValue({
  insert: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
  delete: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
})
```

The form validation tests (which click "Add to Timeline" and check error messages) don't actually reach the Supabase call because validation fails first — these tests don't need special Supabase setup.

- [ ] **Step 4: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sheets/NewDestinationSheet.tsx src/components/sheets/AddEventSheet.tsx src/components/sheets/AddEventSheet.test.tsx
git commit -m "feat: wire userId from useAuth into destination and event sheet mutations"
```

---

### Task 5: Create useDestinationsSync hook and wire into App.tsx

**Files:**
- Create: `src/hooks/useDestinationsSync.ts`
- Create: `src/hooks/useDestinationsSync.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing tests — create `src/hooks/useDestinationsSync.test.ts`**

```ts
import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDestinationsSync } from './useDestinationsSync'

const mockFetchDestinations = vi.hoisted(() => vi.fn())
const mockClearDestinations = vi.hoisted(() => vi.fn())
const mockUseAuth = vi.hoisted(() => vi.fn())

vi.mock('@/stores/tripsStore', () => ({
  useTripsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      fetchDestinations: mockFetchDestinations,
      clearDestinations: mockClearDestinations,
    }),
}))

vi.mock('@/contexts/AuthContext', () => ({ useAuth: mockUseAuth }))

beforeEach(() => {
  mockFetchDestinations.mockReset().mockResolvedValue(undefined)
  mockClearDestinations.mockReset()
})

describe('useDestinationsSync', () => {
  it('calls fetchDestinations with user id when user is logged in', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    renderHook(() => useDestinationsSync())
    expect(mockFetchDestinations).toHaveBeenCalledWith('user-1')
  })

  it('calls clearDestinations when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null })
    renderHook(() => useDestinationsSync())
    expect(mockClearDestinations).toHaveBeenCalled()
    expect(mockFetchDestinations).not.toHaveBeenCalled()
  })

  it('re-fetches when user id changes', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    const { rerender } = renderHook(() => useDestinationsSync())
    expect(mockFetchDestinations).toHaveBeenCalledTimes(1)

    mockUseAuth.mockReturnValue({ user: { id: 'user-2' } })
    rerender()
    expect(mockFetchDestinations).toHaveBeenCalledTimes(2)
    expect(mockFetchDestinations).toHaveBeenLastCalledWith('user-2')
  })

  it('clears destinations when user logs out', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    const { rerender } = renderHook(() => useDestinationsSync())

    mockUseAuth.mockReturnValue({ user: null })
    rerender()
    expect(mockClearDestinations).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — verify they ALL fail**

```bash
pnpm exec vitest run src/hooks/useDestinationsSync.test.ts
```

Expected: All 4 tests FAIL with "Cannot find module './useDestinationsSync'".

- [ ] **Step 3: Create `src/hooks/useDestinationsSync.ts`**

```ts
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTripsStore } from '@/stores/tripsStore'

export function useDestinationsSync() {
  const { user } = useAuth()
  const fetchDestinations = useTripsStore(s => s.fetchDestinations)
  const clearDestinations = useTripsStore(s => s.clearDestinations)

  useEffect(() => {
    if (user) {
      fetchDestinations(user.id).catch(console.error)
    } else {
      clearDestinations()
    }
  }, [user?.id])  // re-run only when the user ID changes
}
```

- [ ] **Step 4: Run hook tests — verify all 4 pass**

```bash
pnpm exec vitest run src/hooks/useDestinationsSync.test.ts
```

Expected: `4 passed`.

- [ ] **Step 5: Modify `src/App.tsx` to wire the hook**

Read the current `src/App.tsx`. Then add a small `AppRoutes` component that calls `useDestinationsSync()` and wraps the existing `<Routes>` JSX.

The pattern:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { useDestinationsSync } from '@/hooks/useDestinationsSync'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import TripsPage from '@/pages/TripsPage'
import TripDetailPage from '@/pages/TripDetailPage'
import ProfilePage from '@/pages/ProfilePage'

function AppRoutes() {
  useDestinationsSync()
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/trips" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/trips" element={<ProtectedRoute><TripsPage /></ProtectedRoute>} />
      <Route path="/trips/:id" element={<ProtectedRoute><TripDetailPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 7: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useDestinationsSync.ts src/hooks/useDestinationsSync.test.ts src/App.tsx
git commit -m "feat: add useDestinationsSync — fetch on login, clear on logout"
```

---

### Task 6: Create LocalDataImport migration component

**Files:**
- Create: `src/components/LocalDataImport.tsx`

This component checks for leftover data in the old localStorage key (`tripmate-trips`), prompts the user once to import it into Supabase, then clears the localStorage key.

- [ ] **Step 1: Create `src/components/LocalDataImport.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTripsStore } from '@/stores/tripsStore'
import type { Destination } from '@/types/trip'

const LEGACY_KEY = 'tripmate-trips'

function readLegacyDestinations(): Destination[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    // Zustand persist format: { state: { destinations: [...] }, version: 0 }
    return Array.isArray(parsed?.state?.destinations) ? parsed.state.destinations : []
  } catch {
    return []
  }
}

export default function LocalDataImport() {
  const { user } = useAuth()
  const addDestination = useTripsStore(s => s.addDestination)
  const addEvent = useTripsStore(s => s.addEvent)
  const [importing, setImporting] = useState(false)
  const [legacy, setLegacy] = useState<Destination[]>([])

  useEffect(() => {
    if (user) {
      setLegacy(readLegacyDestinations())
    }
  }, [user?.id])

  if (!user || legacy.length === 0) return null

  async function handleImport() {
    setImporting(true)
    try {
      for (const dest of legacy) {
        const created = await addDestination(user!.id, {
          title: dest.title,
          emoji: dest.emoji,
          startDate: dest.startDate,
          endDate: dest.endDate,
        })
        for (const event of dest.events) {
          await addEvent(created.id, user!.id, {
            destinationId: created.id,
            type: event.type,
            title: event.title,
            place: event.place,
            placeId: event.placeId,
            lat: event.lat,
            lng: event.lng,
            placeTo: event.placeTo,
            placeIdTo: event.placeIdTo,
            latTo: event.latTo,
            lngTo: event.lngTo,
            arrivalTime: event.arrivalTime,
            date: event.date,
            time: event.time,
            value: event.value,
            notes: event.notes,
            arrivedOnFoot: event.arrivedOnFoot,
          })
        }
      }
      localStorage.removeItem(LEGACY_KEY)
      setLegacy([])
    } catch (err) {
      console.error('Import failed:', err)
    } finally {
      setImporting(false)
    }
  }

  function handleDismiss() {
    localStorage.removeItem(LEGACY_KEY)
    setLegacy([])
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 bg-white border border-border rounded-xl p-4 shadow-lg z-50">
      <p className="text-sm font-semibold text-foreground mb-1">
        You have {legacy.length} trip{legacy.length !== 1 ? 's' : ''} saved locally
      </p>
      <p className="text-xs text-muted mb-3">
        Import them to your account so they're backed up and available everywhere.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-bold disabled:opacity-70"
        >
          {importing ? 'Importing…' : 'Import trips'}
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 bg-input-bg text-muted rounded-lg py-2 text-sm font-medium"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add `<LocalDataImport />` to TripsPage**

In `src/pages/TripsPage.tsx`, import and add `<LocalDataImport />` just before `<BottomNav />`:

```tsx
import LocalDataImport from '@/components/LocalDataImport'

// Inside return, just before <BottomNav />:
<LocalDataImport />
<BottomNav />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 4: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass (TripsPage tests render without LocalDataImport triggering — `user` is null in those tests so the component returns null).

- [ ] **Step 5: Full build check**

```bash
pnpm build
```

Expected: Builds cleanly with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/LocalDataImport.tsx src/pages/TripsPage.tsx
git commit -m "feat: add LocalDataImport — one-time migration from localStorage to Supabase"
```

---

## Summary

When all tasks are complete:

- `pnpm exec vitest run` → All tests pass (tripsMapper × 12 + tripsStore × 10 + useDestinationsSync × 4 + AddEventSheet × 9 + other existing tests)
- `pnpm build` → TypeScript compiles cleanly
- All trip data reads/writes go through Supabase (no localStorage)
- `useDestinationsSync` fetches data on login and clears on logout
- Users with existing localStorage data are prompted once to migrate
- Supabase RLS enforces plan limits server-side (insert will fail if limit exceeded; the store throws the error for the UI to handle)

**Manual prerequisites before testing end-to-end:**
1. Run the 3 SQL migration files in Supabase SQL editor (`supabase/migrations/001_profiles.sql`, `002_destinations.sql`, `003_trip_events.sql`)
2. Add to `.env.local`:
   ```
   VITE_SUPABASE_URL=<your-project-url>
   VITE_SUPABASE_ANON_KEY=<your-anon-key>
   ```
