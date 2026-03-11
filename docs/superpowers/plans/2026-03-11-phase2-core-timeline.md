# TripMate Phase 2 — Core Timeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Destinations + Timeline Events CRUD with GAP detection and Google Maps Places Autocomplete, persisted to localStorage via Zustand, with a 2-tab navigation shell.

**Architecture:** Zustand store (`useTripsStore`) with `persist` middleware writes all state to localStorage under `tripmate-trips`. Pure `detectGaps()` function runs on every render to inject orange GAP warning cards inline between accommodation events that lack transport between them. Google Maps Places Autocomplete loaded via `@googlemaps/js-api-loader` from `VITE_GOOGLE_MAPS_API_KEY` env var; falls back to plain text input if key is absent.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, Zustand 5, React Router v7, `@googlemaps/js-api-loader`, Vitest, @testing-library/react

**Spec:** `docs/superpowers/specs/2026-03-11-travel-app-phase2-core-timeline.md`

---

## Chunk 1: Foundation

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/types/trip.ts` | Create | Destination + TripEvent types |
| `src/lib/travelEmojis.ts` | Create | Emoji pool + auto-assign |
| `src/lib/gapDetection.ts` | Create | detectGaps() pure function |
| `src/lib/gapDetection.test.ts` | Create | Gap logic unit tests |
| `src/stores/tripsStore.ts` | Create | Zustand store with persist |
| `src/stores/tripsStore.test.ts` | Create | Store unit tests |
| `package.json` | Modify | New dependencies |

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
pnpm install zustand @googlemaps/js-api-loader
```

Expected: zustand and @googlemaps/js-api-loader appear in `dependencies` in `package.json`. No peer dep errors.

- [ ] **Step 2: Install type definitions**

```bash
pnpm install -D @types/google.maps
```

Expected: `@types/google.maps` in `devDependencies`.

- [ ] **Step 3: Verify no TypeScript errors**

```bash
pnpm build
```

Expected: Build succeeds. (App is unchanged — just confirming deps don't break anything.)

---

### Task 2: Create type definitions

**Files:**
- Create: `src/types/trip.ts`

- [ ] **Step 1: Create `src/types/trip.ts`**

```ts
export type EventType = 'transport' | 'accommodation' | 'ticket' | 'restaurant'

// UI label → EventType mapping (used in AddEventSheet type selector pills):
//   "Transport" → 'transport'
//   "Stay"      → 'accommodation'
//   "Ticket"    → 'ticket'
//   "Food"      → 'restaurant'

export interface TripEvent {
  id: string            // crypto.randomUUID()
  destinationId: string
  type: EventType
  title: string
  place: string         // display name from Google Places (or plain text)
  placeId?: string      // Google Place ID (optional, for future map use)
  date: string          // YYYY-MM-DD
  time: string          // HH:mm (24h)
  value?: number        // optional cost
  notes?: string        // optional free text
  createdAt: string     // ISO timestamp
}

export interface Destination {
  id: string            // crypto.randomUUID()
  title: string
  emoji: string         // auto-assigned from travel emoji pool
  startDate: string     // YYYY-MM-DD
  endDate: string       // YYYY-MM-DD
  events: TripEvent[]
  createdAt: string     // ISO timestamp
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

---

### Task 3: Create travel emoji utility

**Files:**
- Create: `src/lib/travelEmojis.ts`

- [ ] **Step 1: Create `src/lib/travelEmojis.ts`**

```ts
// Pool cycles after 10 destinations — accepted behavior for Phase 2
const TRAVEL_EMOJIS = ['✈️', '🏖️', '🗺️', '🏔️', '🌴', '🗽', '🏯', '🌍', '🎒', '🚢']

export function assignEmoji(index: number): string {
  return TRAVEL_EMOJIS[index % TRAVEL_EMOJIS.length]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

---

### Task 4: Implement GAP detection with TDD

**Files:**
- Create: `src/lib/gapDetection.ts`
- Create: `src/lib/gapDetection.test.ts`

- [ ] **Step 1: Write the failing tests — create `src/lib/gapDetection.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { detectGaps } from './gapDetection'
import type { TripEvent } from '../types/trip'

function makeEvent(overrides: Partial<TripEvent>): TripEvent {
  return {
    id: 'default-id',
    destinationId: 'dest-1',
    type: 'transport',
    title: 'Event',
    place: 'Somewhere',
    date: '2026-03-15',
    time: '10:00',
    createdAt: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

describe('detectGaps', () => {
  it('returns no gaps when there are no events', () => {
    expect(detectGaps([])).toEqual([])
  })

  it('returns no gaps when there is only one accommodation', () => {
    const events = [makeEvent({ type: 'accommodation', title: 'Hotel A' })]
    expect(detectGaps(events)).toEqual([])
  })

  it('returns no gaps when two accommodations have transport between them', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Train', date: '2026-03-18', time: '09:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('returns a gap when two accommodations have no transport between them', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    const gaps = detectGaps(events)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].afterEventId).toBe('acc-1')
    expect(gaps[0].beforeEventId).toBe('acc-2')
    expect(gaps[0].message).toContain('Hotel A')
    expect(gaps[0].message).toContain('Hotel B')
  })

  it('returns multiple gaps for multiple consecutive accommodation pairs without transport', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
      makeEvent({ id: 'acc-3', type: 'accommodation', title: 'Hotel C', date: '2026-03-21', time: '12:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(2)
  })

  it('does not count transport at exactly the same time as first accommodation as "between"', () => {
    // Transport at A's exact timestamp is NOT strictly greater → still a gap
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Bus', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(1)
  })

  it('ignores ticket and restaurant events when detecting gaps', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'tick-1', type: 'ticket', title: 'Museum', date: '2026-03-17', time: '10:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(1)
  })

  it('works correctly when events are given out of order', () => {
    const events = [
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Train', date: '2026-03-18', time: '09:00' }),
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
    ]
    expect(detectGaps(events)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests — verify they ALL fail**

```bash
pnpm exec vitest run src/lib/gapDetection.test.ts
```

Expected: All 7 tests FAIL with "Cannot find module './gapDetection'".

- [ ] **Step 3: Implement `src/lib/gapDetection.ts`**

```ts
import type { TripEvent } from '../types/trip'

export interface GapWarning {
  afterEventId: string   // the accommodation event before the gap
  beforeEventId: string  // the accommodation event after the gap
  message: string        // human-readable description, built from event titles
}

function toDateTime(date: string, time: string): string {
  return `${date} ${time}`
}

export function detectGaps(events: TripEvent[]): GapWarning[] {
  const sorted = [...events].sort((a, b) =>
    toDateTime(a.date, a.time).localeCompare(toDateTime(b.date, b.time))
  )

  const accommodations = sorted.filter(e => e.type === 'accommodation')
  const gaps: GapWarning[] = []

  for (let i = 0; i < accommodations.length - 1; i++) {
    const a = accommodations[i]
    const b = accommodations[i + 1]
    const aDateTime = toDateTime(a.date, a.time)
    const bDateTime = toDateTime(b.date, b.time)

    const hasTransport = sorted.some(
      e =>
        e.type === 'transport' &&
        toDateTime(e.date, e.time) > aDateTime &&
        toDateTime(e.date, e.time) < bDateTime
    )

    if (!hasTransport) {
      gaps.push({
        afterEventId: a.id,
        beforeEventId: b.id,
        message: `No transport between "${a.title}" check-in and "${b.title}" check-in`,
      })
    }
  }

  return gaps
}
```

- [ ] **Step 4: Run tests — verify all 7 pass**

```bash
pnpm exec vitest run src/lib/gapDetection.test.ts
```

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/types/trip.ts src/lib/travelEmojis.ts src/lib/gapDetection.ts src/lib/gapDetection.test.ts
git commit -m "feat: add trip types, emoji util, and gap detection logic"
```

---

### Task 5: Create Zustand store with tests (TDD)

**Files:**
- Create: `src/stores/tripsStore.ts`
- Create: `src/stores/tripsStore.test.ts`

- [ ] **Step 1: Write the failing tests — create `src/stores/tripsStore.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useTripsStore } from './tripsStore'

beforeEach(() => {
  useTripsStore.setState({ destinations: [] })
  localStorage.clear()
})

describe('addDestination', () => {
  it('adds a destination with generated id, auto emoji, empty events, and createdAt', () => {
    useTripsStore.getState().addDestination({
      title: 'Japan 2026',
      startDate: '2026-03-15',
      endDate: '2026-04-02',
      emoji: '',
    })
    const { destinations } = useTripsStore.getState()
    expect(destinations).toHaveLength(1)
    expect(destinations[0].id).toBeTruthy()
    expect(destinations[0].title).toBe('Japan 2026')
    expect(destinations[0].emoji).toBeTruthy()
    expect(destinations[0].events).toEqual([])
    expect(destinations[0].createdAt).toBeTruthy()
  })

  it('prepends new destination to the top of the list', () => {
    useTripsStore.getState().addDestination({ title: 'First', startDate: '2026-01-01', endDate: '2026-01-07', emoji: '' })
    useTripsStore.getState().addDestination({ title: 'Second', startDate: '2026-02-01', endDate: '2026-02-07', emoji: '' })
    expect(useTripsStore.getState().destinations[0].title).toBe('Second')
  })
})

describe('deleteDestination', () => {
  it('removes the destination by id', () => {
    useTripsStore.getState().addDestination({ title: 'Japan', startDate: '2026-03-15', endDate: '2026-04-02', emoji: '' })
    const id = useTripsStore.getState().destinations[0].id
    useTripsStore.getState().deleteDestination(id)
    expect(useTripsStore.getState().destinations).toHaveLength(0)
  })
})

describe('addEvent', () => {
  it('appends an event with generated id to the correct destination', () => {
    useTripsStore.getState().addDestination({ title: 'Japan', startDate: '2026-03-15', endDate: '2026-04-02', emoji: '' })
    const destId = useTripsStore.getState().destinations[0].id
    useTripsStore.getState().addEvent(destId, {
      type: 'transport',
      title: 'Flight',
      place: 'GRU Airport',
      date: '2026-03-15',
      time: '10:00',
    })
    const events = useTripsStore.getState().destinations[0].events
    expect(events).toHaveLength(1)
    expect(events[0].id).toBeTruthy()
    expect(events[0].title).toBe('Flight')
    expect(events[0].destinationId).toBe(destId)
  })
})

describe('deleteEvent', () => {
  it('removes only the specified event, leaving others intact', () => {
    useTripsStore.getState().addDestination({ title: 'Japan', startDate: '2026-03-15', endDate: '2026-04-02', emoji: '' })
    const destId = useTripsStore.getState().destinations[0].id
    useTripsStore.getState().addEvent(destId, { type: 'transport', title: 'Flight', place: 'GRU', date: '2026-03-15', time: '10:00' })
    useTripsStore.getState().addEvent(destId, { type: 'accommodation', title: 'Hotel', place: 'Tokyo', date: '2026-03-15', time: '22:00' })
    const firstId = useTripsStore.getState().destinations[0].events[0].id
    useTripsStore.getState().deleteEvent(destId, firstId)
    const remaining = useTripsStore.getState().destinations[0].events
    expect(remaining).toHaveLength(1)
    expect(remaining[0].title).toBe('Hotel')
  })
})

describe('localStorage persistence', () => {
  it('persists destinations to localStorage under tripmate-trips key', () => {
    useTripsStore.getState().addDestination({ title: 'Japan', startDate: '2026-03-15', endDate: '2026-04-02', emoji: '' })
    const stored = localStorage.getItem('tripmate-trips')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.destinations).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests — verify they ALL fail**

```bash
pnpm exec vitest run src/stores/tripsStore.test.ts
```

Expected: All 6 tests FAIL with "Cannot find module './tripsStore'".

- [ ] **Step 3: Implement `src/stores/tripsStore.ts`**

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Destination, TripEvent } from '../types/trip'
import { assignEmoji } from '../lib/travelEmojis'

interface TripsState {
  destinations: Destination[]
  addDestination: (d: Omit<Destination, 'id' | 'events' | 'createdAt'>) => void
  updateDestination: (id: string, patch: Partial<Omit<Destination, 'id' | 'events'>>) => void
  deleteDestination: (id: string) => void
  addEvent: (destinationId: string, e: Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>) => void
  updateEvent: (destinationId: string, eventId: string, patch: Partial<Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>>) => void
  deleteEvent: (destinationId: string, eventId: string) => void
}

export const useTripsStore = create<TripsState>()(
  persist(
    (set, get) => ({
      destinations: [],

      addDestination: (d) => {
        const { destinations } = get()
        const newDest: Destination = {
          ...d,
          id: crypto.randomUUID(),
          emoji: assignEmoji(destinations.length),
          events: [],
          createdAt: new Date().toISOString(),
        }
        set({ destinations: [newDest, ...destinations] })
      },

      updateDestination: (id, patch) => {
        set(state => ({
          destinations: state.destinations.map(d =>
            d.id === id ? { ...d, ...patch } : d
          ),
        }))
      },

      deleteDestination: (id) => {
        set(state => ({
          destinations: state.destinations.filter(d => d.id !== id),
        }))
      },

      addEvent: (destinationId, e) => {
        const newEvent: TripEvent = {
          ...e,
          id: crypto.randomUUID(),
          destinationId,
          createdAt: new Date().toISOString(),
        }
        set(state => ({
          destinations: state.destinations.map(d =>
            d.id === destinationId
              ? { ...d, events: [...d.events, newEvent] }
              : d
          ),
        }))
      },

      updateEvent: (destinationId, eventId, patch) => {
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

      deleteEvent: (destinationId, eventId) => {
        set(state => ({
          destinations: state.destinations.map(d =>
            d.id === destinationId
              ? { ...d, events: d.events.filter(e => e.id !== eventId) }
              : d
          ),
        }))
      },
    }),
    { name: 'tripmate-trips' }
  )
)
```

- [ ] **Step 4: Run all store tests — verify all 6 pass**

```bash
pnpm exec vitest run src/stores/tripsStore.test.ts
```

Expected: `6 passed`.

- [ ] **Step 5: Run all tests to verify nothing broken**

```bash
pnpm exec vitest run
```

Expected: All tests pass (LoginPage + gapDetection + tripsStore).

- [ ] **Step 6: Commit**

```bash
git add src/stores/tripsStore.ts src/stores/tripsStore.test.ts
git commit -m "feat: add Zustand trips store with localStorage persistence"
```

---

## Chunk 2: App Shell

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/BottomSheet.tsx` | Create | Reusable bottom sheet overlay |
| `src/components/BottomNav.tsx` | Create | 2-tab navigation (Trips, Profile) |
| `src/pages/ProfilePage.tsx` | Create | Profile stub page |
| `src/App.tsx` | Modify | Add new routes |

---

### Task 6: Create BottomSheet component

**Files:**
- Create: `src/components/BottomSheet.tsx`

- [ ] **Step 1: Create `src/components/BottomSheet.tsx`**

```tsx
import { useEffect } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-8 h-1 rounded-full bg-border" />
        </div>
        {title && (
          <div className="px-6 pt-2 pb-1">
            <h2 className="text-base font-bold text-foreground">{title}</h2>
          </div>
        )}
        <div className="px-6 pb-8 pt-2">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

---

### Task 7: Create BottomNav component

**Files:**
- Create: `src/components/BottomNav.tsx`

- [ ] **Step 1: Create `src/components/BottomNav.tsx`**

```tsx
import { NavLink } from 'react-router-dom'
import { Map, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40">
      <div className="flex justify-around items-center py-2">
        <NavLink
          to="/trips"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-6 py-1 text-xs font-semibold transition-colors',
              isActive ? 'text-primary' : 'text-muted'
            )
          }
        >
          <Map size={20} />
          Trips
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-6 py-1 text-xs font-semibold transition-colors',
              isActive ? 'text-primary' : 'text-muted'
            )
          }
        >
          <User size={20} />
          Profile
        </NavLink>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

---

### Task 8: Create ProfilePage stub

**Files:**
- Create: `src/pages/ProfilePage.tsx`

- [ ] **Step 1: Create `src/pages/ProfilePage.tsx`**

```tsx
import BottomNav from '@/components/BottomNav'

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col items-center justify-center text-center px-4">
      <div className="w-20 h-20 rounded-full bg-input-bg border-2 border-border flex items-center justify-center mb-4">
        <span className="text-3xl">👤</span>
      </div>
      <h1 className="text-xl font-extrabold text-foreground mb-2">Profile</h1>
      <p className="text-sm text-muted">Account features coming soon</p>
      <BottomNav />
    </div>
  )
}
```

---

### Task 9: Update App.tsx with new routes

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import TripsPage from '@/pages/TripsPage'
import TripDetailPage from '@/pages/TripDetailPage'
import ProfilePage from '@/pages/ProfilePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/trips" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/trips/:id" element={<TripDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Create placeholder pages so App.tsx compiles**

Create `src/pages/TripsPage.tsx`:

```tsx
// placeholder — replaced in Task 12
export default function TripsPage() {
  return <div>Trips</div>
}
```

Create `src/pages/TripDetailPage.tsx`:

```tsx
// placeholder — replaced in Task 15
export default function TripDetailPage() {
  return <div>Trip Detail</div>
}
```

- [ ] **Step 3: Verify app compiles and routes work**

```bash
pnpm dev
```

Open http://localhost:5173 — should redirect to `/trips` and show "Trips". Navigate to `/profile` — shows "Account features coming soon". Stop server with Ctrl+C.

- [ ] **Step 4: Verify all tests still pass**

```bash
pnpm exec vitest run
```

Expected: All existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/BottomSheet.tsx src/components/BottomNav.tsx src/pages/ProfilePage.tsx src/pages/TripsPage.tsx src/pages/TripDetailPage.tsx src/App.tsx
git commit -m "feat: add app shell — BottomSheet, BottomNav, ProfilePage, routes"
```

---

## Chunk 3: Destinations List

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/DestinationRow.tsx` | Create | Compact row in destinations list |
| `src/components/sheets/NewDestinationSheet.tsx` | Create | Bottom sheet for creating a destination |
| `src/pages/TripsPage.tsx` | Rewrite | Full destinations list page |
| `src/pages/TripsPage.test.tsx` | Create | Tests for destinations list |

---

### Task 10: Create DestinationRow component

**Files:**
- Create: `src/components/DestinationRow.tsx`

- [ ] **Step 1: Create `src/components/DestinationRow.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { detectGaps } from '@/lib/gapDetection'
import type { Destination } from '@/types/trip'

interface Props {
  destination: Destination
  onDelete: (id: string) => void
}

export default function DestinationRow({ destination, onDelete }: Props) {
  const navigate = useNavigate()
  const gaps = detectGaps(destination.events)
  const hasGaps = gaps.length > 0
  const hasEvents = destination.events.length > 0

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm('Delete this destination and all its events?')) {
      onDelete(destination.id)
    }
  }

  return (
    <div
      className="bg-white border border-border rounded-[10px] p-3 flex items-center gap-3 cursor-pointer active:bg-input-bg"
      onClick={() => navigate(`/trips/${destination.id}`)}
      onContextMenu={(e) => { e.preventDefault(); handleDelete(e) }}
      role="button"
      aria-label={destination.title}
    >
      <span className="text-2xl" aria-hidden="true">{destination.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-foreground text-sm truncate">{destination.title}</div>
        <div className="text-xs text-muted">
          {destination.startDate} – {destination.endDate}
        </div>
      </div>
      {hasGaps && (
        <span className="text-xs font-bold bg-[#FFF7ED] text-[#C75B2A] rounded px-1.5 py-0.5 shrink-0">
          ⚠️ GAP
        </span>
      )}
      {!hasGaps && hasEvents && (
        <span className="text-xs font-bold bg-[#F0FDF4] text-[#059669] rounded px-1.5 py-0.5 shrink-0">
          ✓ OK
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

---

### Task 11: Create NewDestinationSheet

**Files:**
- Create: `src/components/sheets/NewDestinationSheet.tsx`

- [ ] **Step 1: Create the sheets directory**

```bash
mkdir -p src/components/sheets
```

- [ ] **Step 2: Create `src/components/sheets/NewDestinationSheet.tsx`**

```tsx
import { useState } from 'react'
import BottomSheet from '@/components/BottomSheet'
import { useTripsStore } from '@/stores/tripsStore'
import { assignEmoji } from '@/lib/travelEmojis'

interface Props {
  open: boolean
  onClose: () => void
}

export default function NewDestinationSheet({ open, onClose }: Props) {
  const addDestination = useTripsStore(s => s.addDestination)
  const destinations = useTripsStore(s => s.destinations)

  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [errors, setErrors] = useState<{ title?: string; endDate?: string }>({})

  const previewEmoji = assignEmoji(destinations.length)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (endDate && startDate && endDate < startDate) errs.endDate = 'End date must be after start date'
    if (Object.keys(errs).length) { setErrors(errs); return }

    addDestination({ title: title.trim(), startDate, endDate, emoji: '' })
    setTitle('')
    setStartDate('')
    setEndDate('')
    setErrors({})
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="New Destination">
      <div className="text-center text-4xl mb-1" aria-hidden="true">{previewEmoji}</div>
      <div className="text-xs text-muted text-center mb-4">Auto-assigned icon</div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Japan 2026"
            aria-label="Trip title"
            className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
              errors.title ? 'border-red-500' : 'border-border'
            }`}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground mb-1 block" htmlFor="dest-start">
              Start Date
            </label>
            <input
              id="dest-start"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              className="w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground mb-1 block" htmlFor="dest-end">
              End Date
            </label>
            <input
              id="dest-end"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              required
              min={startDate}
              className={`w-full bg-input-bg border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary ${
                errors.endDate ? 'border-red-500' : 'border-border'
              }`}
            />
            {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold mt-2 hover:bg-primary-dark transition-colors"
        >
          Create Destination
        </button>
      </form>
    </BottomSheet>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

---

### Task 12: Implement TripsPage with tests (TDD)

**Files:**
- Rewrite: `src/pages/TripsPage.tsx`
- Create: `src/pages/TripsPage.test.tsx`

- [ ] **Step 1: Write failing tests — create `src/pages/TripsPage.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import TripsPage from './TripsPage'
import { useTripsStore } from '@/stores/tripsStore'
import type { Destination } from '@/types/trip'

function makeDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'dest-1',
    title: 'Japan 2026',
    emoji: '✈️',
    startDate: '2026-03-15',
    endDate: '2026-04-02',
    events: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  return render(<MemoryRouter><TripsPage /></MemoryRouter>)
}

beforeEach(() => {
  useTripsStore.setState({ destinations: [] })
})

describe('TripsPage', () => {
  it('shows empty state when no destinations exist', () => {
    renderPage()
    expect(screen.getByText('No trips yet')).toBeInTheDocument()
    expect(screen.getByText('Plan your first trip')).toBeInTheDocument()
  })

  it('renders a destination row when destinations exist', () => {
    useTripsStore.setState({ destinations: [makeDestination()] })
    renderPage()
    expect(screen.getByText('Japan 2026')).toBeInTheDocument()
  })

  it('shows ⚠️ GAP badge when destination has accommodation gap', () => {
    useTripsStore.setState({
      destinations: [makeDestination({
        events: [
          { id: 'a1', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel A', place: 'Tokyo', date: '2026-03-15', time: '14:00', createdAt: '' },
          { id: 'a2', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel B', place: 'Osaka', date: '2026-03-18', time: '15:00', createdAt: '' },
        ],
      })],
    })
    renderPage()
    expect(screen.getByText('⚠️ GAP')).toBeInTheDocument()
  })

  it('shows ✓ OK badge when destination has events and no gaps', () => {
    useTripsStore.setState({
      destinations: [makeDestination({
        events: [
          { id: 'a1', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel A', place: 'Tokyo', date: '2026-03-15', time: '14:00', createdAt: '' },
          { id: 't1', destinationId: 'dest-1', type: 'transport', title: 'Train', place: 'Station', date: '2026-03-18', time: '09:00', createdAt: '' },
          { id: 'a2', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel B', place: 'Osaka', date: '2026-03-18', time: '15:00', createdAt: '' },
        ],
      })],
    })
    renderPage()
    expect(screen.getByText('✓ OK')).toBeInTheDocument()
  })

  it('opens New Destination sheet when "+ New" button is clicked', () => {
    renderPage()
    fireEvent.click(screen.getByText('+ New'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Destination')).toBeInTheDocument()
  })

  it('shows correct destination count', () => {
    useTripsStore.setState({
      destinations: [makeDestination(), makeDestination({ id: 'dest-2', title: 'Italy' })],
    })
    renderPage()
    expect(screen.getByText('2 destinations')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they ALL fail**

```bash
pnpm exec vitest run src/pages/TripsPage.test.tsx
```

Expected: All 6 tests FAIL. The placeholder TripsPage just renders "Trips".

- [ ] **Step 3: Replace `src/pages/TripsPage.tsx` with full implementation**

```tsx
import { useState } from 'react'
import { useTripsStore } from '@/stores/tripsStore'
import DestinationRow from '@/components/DestinationRow'
import NewDestinationSheet from '@/components/sheets/NewDestinationSheet'
import BottomNav from '@/components/BottomNav'

export default function TripsPage() {
  const destinations = useTripsStore(s => s.destinations)
  const deleteDestination = useTripsStore(s => s.deleteDestination)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">My Trips</h1>
          <p className="text-xs text-muted">
            {destinations.length} destination{destinations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setSheetOpen(true)}
          className="bg-primary text-white rounded-full px-4 py-2 text-sm font-bold hover:bg-primary-dark transition-colors"
        >
          + New
        </button>
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {destinations.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="text-5xl mb-4" aria-hidden="true">🗺️</div>
            <h2 className="text-lg font-bold text-foreground mb-1">No trips yet</h2>
            <p className="text-sm text-muted mb-6">Start planning your next adventure</p>
            <button
              onClick={() => setSheetOpen(true)}
              className="bg-primary text-white rounded-full px-6 py-2.5 text-sm font-bold hover:bg-primary-dark transition-colors"
            >
              Plan your first trip
            </button>
          </div>
        ) : (
          <>
            {destinations.map(d => (
              <DestinationRow
                key={d.id}
                destination={d}
                onDelete={deleteDestination}
              />
            ))}
            <div
              className="border-2 border-dashed border-border rounded-[10px] p-3 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSheetOpen(true)}
              role="button"
            >
              <span className="text-sm text-muted">+ Plan a new destination</span>
            </div>
          </>
        )}
      </div>

      <NewDestinationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 4: Run TripsPage tests — verify all 6 pass**

```bash
pnpm exec vitest run src/pages/TripsPage.test.tsx
```

Expected: `6 passed`.

- [ ] **Step 5: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/DestinationRow.tsx src/components/sheets/NewDestinationSheet.tsx src/pages/TripsPage.tsx src/pages/TripsPage.test.tsx
git commit -m "feat: add destinations list — DestinationRow, NewDestinationSheet, TripsPage"
```

---

## Chunk 4: Timeline View

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/TimelineEvent.tsx` | Create | Single event card in timeline |
| `src/components/GapWarningCard.tsx` | Create | Orange dashed gap warning |
| `src/pages/TripDetailPage.tsx` | Rewrite | Full timeline page |
| `src/pages/TripDetailPage.test.tsx` | Create | Tests for timeline view |

---

### Task 13: Create TimelineEvent component

**Files:**
- Create: `src/components/TimelineEvent.tsx`

- [ ] **Step 1: Create `src/components/TimelineEvent.tsx`**

```tsx
import type { TripEvent, EventType } from '@/types/trip'

const TYPE_COLORS: Record<EventType, string> = {
  transport: '#4A90D9',
  accommodation: '#7C3AED',
  ticket: '#059669',
  restaurant: '#F59E0B',
}

const TYPE_LABELS: Record<EventType, string> = {
  transport: 'Transport',
  accommodation: 'Accommodation',
  ticket: 'Ticket',
  restaurant: 'Restaurant',
}

interface Props {
  event: TripEvent
  onEdit: (event: TripEvent) => void
}

export default function TimelineEvent({ event, onEdit }: Props) {
  return (
    <div className="relative">
      {/* Colored dot on the vertical line */}
      <div
        className="absolute left-[-14px] top-[10px] w-[10px] h-[10px] rounded-full border-2 border-white z-10"
        style={{ backgroundColor: TYPE_COLORS[event.type] }}
        aria-hidden="true"
      />
      {/* Card */}
      <div
        className="bg-white border border-border rounded-lg px-3 py-2 cursor-pointer active:bg-input-bg"
        onClick={() => onEdit(event)}
        role="button"
        aria-label={`Edit ${event.title}`}
      >
        <div className="text-[10px] text-muted">{event.date} · {event.time}</div>
        <div className="font-semibold text-foreground text-sm mt-0.5">{event.title}</div>
        <div className="text-[10px] text-muted mt-0.5">
          {TYPE_LABELS[event.type]}
          {event.value != null ? ` · ${event.value}` : ''}
        </div>
      </div>
    </div>
  )
}
```

---

### Task 14: Create GapWarningCard component

**Files:**
- Create: `src/components/GapWarningCard.tsx`

- [ ] **Step 1: Create `src/components/GapWarningCard.tsx`**

```tsx
interface Props {
  message: string
}

export default function GapWarningCard({ message }: Props) {
  return (
    <div
      className="border border-dashed border-primary rounded-lg px-3 py-2 bg-[#FFF7ED]"
      role="alert"
    >
      <p className="text-xs text-[#C75B2A] font-medium">⚠️ {message}</p>
    </div>
  )
}
```

---

### Task 15: Implement TripDetailPage with tests (TDD)

**Files:**
- Rewrite: `src/pages/TripDetailPage.tsx`
- Create: `src/pages/TripDetailPage.test.tsx`

- [ ] **Step 1: Write failing tests — create `src/pages/TripDetailPage.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import TripDetailPage from './TripDetailPage'
import { useTripsStore } from '@/stores/tripsStore'
import type { Destination, TripEvent } from '@/types/trip'

const DEST_ID = 'dest-1'

function makeEvent(overrides: Partial<TripEvent>): TripEvent {
  return {
    id: 'ev-1',
    destinationId: DEST_ID,
    type: 'transport',
    title: 'Event',
    place: 'Somewhere',
    date: '2026-03-15',
    time: '10:00',
    createdAt: '',
    ...overrides,
  }
}

function makeDest(overrides: Partial<Destination> = {}): Destination {
  return {
    id: DEST_ID,
    title: 'Japan 2026',
    emoji: '✈️',
    startDate: '2026-03-15',
    endDate: '2026-04-02',
    events: [],
    createdAt: '',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/trips/${DEST_ID}`]}>
      <Routes>
        <Route path="/trips/:id" element={<TripDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useTripsStore.setState({ destinations: [] })
})

describe('TripDetailPage', () => {
  it('shows not-found message when destination does not exist', () => {
    renderPage()
    expect(screen.getByText('Destination not found')).toBeInTheDocument()
  })

  it('shows empty state when destination has no events', () => {
    useTripsStore.setState({ destinations: [makeDest()] })
    renderPage()
    expect(screen.getByText(/No events yet/)).toBeInTheDocument()
  })

  it('renders event titles', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [makeEvent({ id: 'ev-1', title: 'Flight GRU→NRT' })],
      })],
    })
    renderPage()
    expect(screen.getByText('Flight GRU→NRT')).toBeInTheDocument()
  })

  it('renders events in ascending date+time order regardless of store order', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'ev-2', title: 'Hotel Check-in', date: '2026-03-15', time: '22:00' }),
          makeEvent({ id: 'ev-1', title: 'Flight Arrives', date: '2026-03-15', time: '18:00' }),
        ],
      })],
    })
    renderPage()
    const flight = screen.getByText('Flight Arrives')
    const hotel = screen.getByText('Hotel Check-in')
    // Flight (18:00) should come before Hotel (22:00) in the DOM
    expect(flight.compareDocumentPosition(hotel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders a GAP warning when two accommodations have no transport between them', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'a1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
          makeEvent({ id: 'a2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
        ],
      })],
    })
    renderPage()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/No transport between/)).toBeInTheDocument()
  })

  it('does not render a GAP warning when transport exists between accommodations', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'a1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
          makeEvent({ id: 't1', type: 'transport', title: 'Shinkansen', date: '2026-03-18', time: '09:00' }),
          makeEvent({ id: 'a2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
        ],
      })],
    })
    renderPage()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they ALL fail**

```bash
pnpm exec vitest run src/pages/TripDetailPage.test.tsx
```

Expected: All 6 tests FAIL. The placeholder returns "Trip Detail".

- [ ] **Step 3: Create placeholder AddEventSheet so TripDetailPage compiles**

Create `src/components/sheets/AddEventSheet.tsx`:

```tsx
// placeholder — replaced in Task 17
interface Props {
  open: boolean
  onClose: () => void
  destinationId: string
  editEvent?: import('@/types/trip').TripEvent
}
export default function AddEventSheet({ open, onClose }: Props) {
  if (!open) return null
  return (
    <div role="dialog">
      <button onClick={onClose}>Close</button>
    </div>
  )
}
```

- [ ] **Step 4: Replace `src/pages/TripDetailPage.tsx` with full implementation**

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTripsStore } from '@/stores/tripsStore'
import { detectGaps } from '@/lib/gapDetection'
import TimelineEvent from '@/components/TimelineEvent'
import GapWarningCard from '@/components/GapWarningCard'
import AddEventSheet from '@/components/sheets/AddEventSheet'
import BottomNav from '@/components/BottomNav'
import type { TripEvent } from '@/types/trip'

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const destination = useTripsStore(s => s.destinations.find(d => d.id === id))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<TripEvent | undefined>()

  if (!destination) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted">Destination not found</p>
          <button
            onClick={() => navigate('/trips')}
            className="text-primary text-sm font-semibold mt-2 block"
          >
            ← Back to trips
          </button>
        </div>
      </div>
    )
  }

  const sortedEvents = [...destination.events].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  )
  const gaps = detectGaps(sortedEvents)

  type RenderItem =
    | { kind: 'event'; event: TripEvent }
    | { kind: 'gap'; message: string; key: string }

  const items: RenderItem[] = []
  sortedEvents.forEach(event => {
    items.push({ kind: 'event', event })
    const gap = gaps.find(g => g.afterEventId === event.id)
    if (gap) {
      items.push({ kind: 'gap', message: gap.message, key: `gap-${gap.afterEventId}` })
    }
  })

  function openAddSheet() {
    setEditEvent(undefined)
    setSheetOpen(true)
  }

  function openEditSheet(event: TripEvent) {
    setEditEvent(event)
    setSheetOpen(true)
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/trips')}
          className="text-muted text-sm font-medium shrink-0"
        >
          ‹ Trips
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold text-foreground truncate">
            {destination.emoji} {destination.title}
          </h1>
          <p className="text-xs text-muted">
            {destination.startDate} – {destination.endDate} · {destination.events.length} event{destination.events.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openAddSheet}
          className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shrink-0 hover:bg-primary-dark transition-colors"
          aria-label="Add event"
        >
          +
        </button>
      </div>

      {/* Timeline */}
      <div className="px-4">
        {sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">📅</div>
            <p className="text-sm text-muted">No events yet. Tap + to add your first.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border" aria-hidden="true" />
            <div className="space-y-3 pl-5">
              {items.map((item) =>
                item.kind === 'event' ? (
                  <TimelineEvent
                    key={item.event.id}
                    event={item.event}
                    onEdit={openEditSheet}
                  />
                ) : (
                  <GapWarningCard key={item.key} message={item.message} />
                )
              )}
            </div>
          </div>
        )}
      </div>

      <AddEventSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        destinationId={destination.id}
        editEvent={editEvent}
      />
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 5: Run TripDetailPage tests — verify all 6 pass**

```bash
pnpm exec vitest run src/pages/TripDetailPage.test.tsx
```

Expected: `6 passed`.

- [ ] **Step 6: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/TimelineEvent.tsx src/components/GapWarningCard.tsx src/components/sheets/AddEventSheet.tsx src/pages/TripDetailPage.tsx src/pages/TripDetailPage.test.tsx
git commit -m "feat: add timeline view — TimelineEvent, GapWarningCard, TripDetailPage"
```

---

## Chunk 5: Add/Edit Events

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/GooglePlacesInput.tsx` | Create | Places Autocomplete (falls back to text if no key) |
| `src/components/sheets/AddEventSheet.tsx` | Rewrite | Full add/edit event bottom sheet |
| `src/components/sheets/AddEventSheet.test.tsx` | Create | Form validation tests |

---

### Task 16: Create GooglePlacesInput component

**Files:**
- Create: `src/components/GooglePlacesInput.tsx`

- [ ] **Step 1: Create `src/components/GooglePlacesInput.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { Loader } from '@googlemaps/js-api-loader'

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

interface Props {
  value: string
  onChange: (place: string, placeId?: string) => void
  placeholder?: string
  className?: string
}

export default function GooglePlacesInput({ value, onChange, placeholder, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!apiKey || !inputRef.current) return

    const loader = new Loader({
      apiKey,
      version: 'weekly',
      libraries: ['places'],
    })

    loader.load().then(() => {
      if (!inputRef.current) return
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ['name', 'place_id'],
      })
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        onChange(place.name ?? '', place.place_id)
      })
    }).catch(() => {
      // Silently fall back — plain text input still works
    })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // No API key: plain controlled input — always rendered in tests
  if (!apiKey) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        data-testid="places-input-fallback"
      />
    )
  }

  // With API key: uncontrolled input (Google Autocomplete manages the DOM value)
  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      placeholder={placeholder}
      className={className}
      data-testid="places-input"
    />
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

---

### Task 17: Implement AddEventSheet with tests (TDD)

**Files:**
- Rewrite: `src/components/sheets/AddEventSheet.tsx`
- Create: `src/components/sheets/AddEventSheet.test.tsx`

- [ ] **Step 1: Write failing tests — create `src/components/sheets/AddEventSheet.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import AddEventSheet from './AddEventSheet'
import { useTripsStore } from '@/stores/tripsStore'
import type { TripEvent } from '@/types/trip'

const DEST_ID = 'dest-1'

function renderSheet(props: Partial<React.ComponentProps<typeof AddEventSheet>> = {}) {
  return render(
    <MemoryRouter>
      <AddEventSheet
        open={true}
        onClose={() => {}}
        destinationId={DEST_ID}
        {...props}
      />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useTripsStore.setState({
    destinations: [{
      id: DEST_ID,
      title: 'Japan',
      emoji: '✈️',
      startDate: '2026-03-15',
      endDate: '2026-04-02',
      events: [],
      createdAt: '',
    }],
  })
})

describe('AddEventSheet', () => {
  it('renders type selector pills: Transport, Stay, Ticket, Food', () => {
    renderSheet()
    expect(screen.getByText('Transport')).toBeInTheDocument()
    expect(screen.getByText('Stay')).toBeInTheDocument()
    expect(screen.getByText('Ticket')).toBeInTheDocument()
    expect(screen.getByText('Food')).toBeInTheDocument()
  })

  it('renders "Add to Timeline" button in create mode', () => {
    renderSheet()
    expect(screen.getByText('Add to Timeline')).toBeInTheDocument()
  })

  it('shows Title required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.getByText('Title is required')).toBeInTheDocument()
  })

  it('shows Place required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.getByText('Place is required')).toBeInTheDocument()
  })

  it('shows Date required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.getByText('Date is required')).toBeInTheDocument()
  })

  it('shows Time required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.getByText('Time is required')).toBeInTheDocument()
  })

  it('shows value error when a non-positive number is entered', () => {
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/Flight GRU/), { target: { value: 'My Flight' } })
    fireEvent.change(screen.getByTestId('places-input-fallback'), { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(document.querySelector('input[type="time"]') as HTMLInputElement, { target: { value: '10:00' } })
    fireEvent.change(screen.getByPlaceholderText('Cost (optional)'), { target: { value: '-5' } })
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.getByText('Must be a positive number')).toBeInTheDocument()
  })

  it('does not show required errors when all required fields are filled', () => {
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/Flight GRU/), { target: { value: 'My Flight' } })
    fireEvent.change(screen.getByTestId('places-input-fallback'), { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(document.querySelector('input[type="time"]') as HTMLInputElement, { target: { value: '10:00' } })
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.queryByText('Title is required')).not.toBeInTheDocument()
    expect(screen.queryByText('Place is required')).not.toBeInTheDocument()
  })

  it('shows "Save Changes" and "Delete event" in edit mode', () => {
    const editEvent: TripEvent = {
      id: 'ev-1',
      destinationId: DEST_ID,
      type: 'transport',
      title: 'Flight',
      place: 'GRU',
      date: '2026-03-15',
      time: '10:00',
      createdAt: '',
    }
    renderSheet({ editEvent })
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByText('Delete event')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they ALL fail**

```bash
pnpm exec vitest run src/components/sheets/AddEventSheet.test.tsx
```

Expected: All 9 tests FAIL. The placeholder AddEventSheet doesn't have any of these fields.

- [ ] **Step 3: Replace `src/components/sheets/AddEventSheet.tsx` with full implementation**

```tsx
import { useState, useEffect } from 'react'
import BottomSheet from '@/components/BottomSheet'
import GooglePlacesInput from '@/components/GooglePlacesInput'
import { useTripsStore } from '@/stores/tripsStore'
import { cn } from '@/lib/utils'
import type { TripEvent, EventType } from '@/types/trip'

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'transport', label: 'Transport' },
  { value: 'accommodation', label: 'Stay' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'restaurant', label: 'Food' },
]

const TYPE_PLACEHOLDERS: Record<EventType, string> = {
  transport: 'e.g. Flight GRU → NRT',
  accommodation: 'Hotel name',
  ticket: 'Museum or experience',
  restaurant: 'Restaurant name',
}

interface Props {
  open: boolean
  onClose: () => void
  destinationId: string
  editEvent?: TripEvent
}

type FormErrors = Partial<Record<'title' | 'place' | 'date' | 'time' | 'value', string>>

export default function AddEventSheet({ open, onClose, destinationId, editEvent }: Props) {
  const addEvent = useTripsStore(s => s.addEvent)
  const updateEvent = useTripsStore(s => s.updateEvent)
  const deleteEvent = useTripsStore(s => s.deleteEvent)

  const [type, setType] = useState<EventType>('transport')
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [placeId, setPlaceId] = useState<string | undefined>()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const isEdit = !!editEvent

  useEffect(() => {
    if (open && editEvent) {
      setType(editEvent.type)
      setTitle(editEvent.title)
      setPlace(editEvent.place)
      setPlaceId(editEvent.placeId)
      setDate(editEvent.date)
      setTime(editEvent.time)
      setValue(editEvent.value?.toString() ?? '')
      setNotes(editEvent.notes ?? '')
    } else if (open && !editEvent) {
      setType('transport')
      setTitle('')
      setPlace('')
      setPlaceId(undefined)
      setDate('')
      setTime('')
      setValue('')
      setNotes('')
    }
    setErrors({})
  }, [open, editEvent])

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (!place.trim()) errs.place = 'Place is required'
    if (!date) errs.date = 'Date is required'
    if (!time) errs.time = 'Time is required'
    if (value !== '' && (isNaN(Number(value)) || Number(value) <= 0)) {
      errs.value = 'Must be a positive number'
    }
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
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
    }

    if (isEdit) {
      updateEvent(destinationId, editEvent!.id, data)
    } else {
      addEvent(destinationId, data)
    }
    onClose()
  }

  function handleDelete() {
    if (window.confirm('Delete this event?')) {
      deleteEvent(destinationId, editEvent!.id)
      onClose()
    }
  }

  const inputClass = (hasError?: string) =>
    cn(
      'w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
      hasError ? 'border-red-500' : 'border-border'
    )

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? 'Edit Event' : 'Add Event'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Type selector pills */}
        <div className="flex gap-2 flex-wrap">
          {EVENT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setType(t.value); setTitle('') }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                type === t.value ? 'bg-primary text-white' : 'bg-input-bg text-muted'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={TYPE_PLACEHOLDERS[type]}
            className={inputClass(errors.title)}
            aria-label="Event title"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>

        {/* Place */}
        <div>
          <GooglePlacesInput
            value={place}
            onChange={(p, id) => { setPlace(p); setPlaceId(id) }}
            placeholder="📍 Search place"
            className={inputClass(errors.place)}
          />
          {errors.place && <p className="text-red-500 text-xs mt-1">{errors.place}</p>}
        </div>

        {/* Date + Time */}
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              aria-label="Event date"
              className={cn(
                'w-full bg-input-bg border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary',
                errors.date ? 'border-red-500' : 'border-border'
              )}
            />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
          </div>
          <div className="flex-1">
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              aria-label="Event time"
              className={cn(
                'w-full bg-input-bg border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary',
                errors.time ? 'border-red-500' : 'border-border'
              )}
            />
            {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
          </div>
        </div>

        {/* Value */}
        <div>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Cost (optional)"
            min="0"
            step="0.01"
            className={inputClass(errors.value)}
            aria-label="Cost"
          />
          {errors.value && <p className="text-red-500 text-xs mt-1">{errors.value}</p>}
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any notes..."
          rows={2}
          className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary resize-none"
          aria-label="Notes"
        />

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold hover:bg-primary-dark transition-colors"
        >
          {isEdit ? 'Save Changes' : 'Add to Timeline'}
        </button>

        {/* Delete (edit mode only) */}
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full text-red-500 text-sm font-medium py-1 hover:text-red-600 transition-colors"
          >
            Delete event
          </button>
        )}
      </form>
    </BottomSheet>
  )
}
```

- [ ] **Step 4: Run AddEventSheet tests — verify all 9 pass**

```bash
pnpm exec vitest run src/components/sheets/AddEventSheet.test.tsx
```

Expected: `9 passed`.

- [ ] **Step 5: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass (LoginPage × 9 + gapDetection × 7 + tripsStore × 6 + TripsPage × 6 + TripDetailPage × 6 + AddEventSheet × 9 = 43 total).

- [ ] **Step 6: Full build check**

```bash
pnpm build
```

Expected: Builds cleanly with no TypeScript errors.

- [ ] **Step 7: Manual verification**

```bash
pnpm dev
```

Open http://localhost:5173 and verify:
1. Redirects `/` → `/trips`
2. Empty state shown with "No trips yet"
3. Click "+ New" → sheet slides up, fill title + dates → Create Destination → row appears in list with auto-emoji
4. Tap row → timeline opens with "No events yet"
5. Tap "+" → Add Event sheet → fill Transport details → "Add to Timeline" → blue dot + card appears
6. Add two Accommodation events (no transport between) → orange GAP warning card appears between them
7. Add a Transport event between the two accommodations → GAP warning disappears
8. Tap event card → Edit sheet opens pre-filled → change title, Save → updated in timeline
9. Open Edit sheet → tap "Delete event" → confirm → event removed
10. Long-press (right-click on desktop) destination row → confirm → destination removed
11. Refresh page → all destinations and events still present (localStorage)
12. Without `VITE_GOOGLE_MAPS_API_KEY` in `.env`: place field is a plain text input (fallback)
13. Navigate to `/profile` → shows stub page, bottom nav highlights Profile

Stop server with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add src/components/GooglePlacesInput.tsx src/components/sheets/AddEventSheet.tsx src/components/sheets/AddEventSheet.test.tsx
git commit -m "feat: add AddEventSheet with Google Places input and form validation"
```

---

## Summary

When all chunks are complete:
- `pnpm dev` → full trip planning UI at `/trips`
- `pnpm exec vitest run` → 43 tests pass across 6 test files
- `pnpm build` → TypeScript compiles cleanly
- Data persists across page refreshes via localStorage (`tripmate-trips` key)
- GAP warnings appear/disappear automatically as events are added/removed
- Google Places Autocomplete works with `VITE_GOOGLE_MAPS_API_KEY` set; plain text fallback without it
