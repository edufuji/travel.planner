# Arrived On Foot Flag Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `'walking'` event type with an `arrivedOnFoot?: boolean` flag on `TripEvent`, wiring it through gap detection, map rendering, and the AddEventSheet form.

**Architecture:** Three independent changes after a shared data-model update: (1) gap detection reads the flag directly from the destination accommodation, (2) map segments use the flag to draw dotted green polylines, (3) AddEventSheet shows a checkbox for all event types. All `Record<EventType, ...>` maps must drop the `walking` key atomically with the type change.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, Zustand 5, Vitest + @testing-library/react, Google Maps JS API

**Spec:** `docs/superpowers/specs/2026-03-14-arrived-on-foot-flag.md`

---

## Chunk 1: Data model, gap detection, and map segments

### Task 1: Data model + gap detection (TDD)

**Files:**
- Modify: `src/types/trip.ts`
- Modify: `src/lib/gapDetection.ts`
- Modify: `src/lib/gapDetection.test.ts`
- Modify: `src/lib/buildMapSegments.ts` (TYPE_COLORS only — logic in Task 2)
- Modify: `src/components/TimelineEvent.tsx`
- Modify: `src/components/sheets/AddEventSheet.tsx` (pill + placeholder only — checkbox in Task 3)
- Modify: `src/components/MapView.tsx`
- Modify: `src/pages/TripDetailPage.test.tsx`
- Modify: `src/pages/TripsPage.test.tsx`

- [ ] **Step 1: Update gapDetection.test.ts**

Replace the entire file with:

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

  it('returns no gaps when destination accommodation has arrivedOnFoot: true', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', arrivedOnFoot: true }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('returns a gap when destination accommodation has no arrivedOnFoot flag', () => {
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

  it('returns multiple gaps for multiple consecutive accommodation pairs without arrivedOnFoot', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
      makeEvent({ id: 'acc-3', type: 'accommodation', title: 'Hotel C', date: '2026-03-21', time: '12:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(2)
  })

  it('gap is NOT cleared when only a non-accommodation event has arrivedOnFoot: true', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'tick-1', type: 'ticket', title: 'Museum', date: '2026-03-17', time: '10:00', arrivedOnFoot: true }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(1)
  })

  it('gap is NOT cleared when only the source accommodation has arrivedOnFoot: true', () => {
    // arrivedOnFoot on acc-1 (not acc-2) should not clear the gap
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00', arrivedOnFoot: true }),
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
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', arrivedOnFoot: true }),
      makeEvent({ id: 'tick-1', type: 'ticket', title: 'Museum', date: '2026-03-17', time: '10:00' }),
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('transport event between two accommodations does NOT clear the gap', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Train', date: '2026-03-18', time: '09:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run gapDetection tests — verify they fail**

```
npx vitest run src/lib/gapDetection.test.ts --reporter=verbose
```

Expected: multiple failures — "arrivedOnFoot" tests fail because the source still uses the old walking-event scan.

- [ ] **Step 3: Update src/types/trip.ts**

Remove `'walking'` from `EventType` and add `arrivedOnFoot` field:

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
  lat?: number          // WGS84 latitude, from Google Places geometry.location.lat()
  lng?: number          // WGS84 longitude, from Google Places geometry.location.lng()
  // Transport-only: destination (arrival) location
  placeTo?: string      // display name of destination
  placeIdTo?: string    // Google Place ID of destination
  latTo?: number        // WGS84 latitude of destination
  lngTo?: number        // WGS84 longitude of destination
  // Transport-only: arrival time
  arrivalTime?: string  // HH:mm (24h); separate from `time` (departure)
  date: string          // YYYY-MM-DD
  time: string          // HH:mm (24h)
  value?: number        // optional cost
  notes?: string        // optional free text
  arrivedOnFoot?: boolean  // true = user arrived at this event's location on foot
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

- [ ] **Step 4: Update src/lib/gapDetection.ts**

Replace the loop body — remove `aDateTime`/`bDateTime` and the `sorted.some(...)` scan, replace with direct flag check:

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

    const hasWalkingRoute = b.arrivedOnFoot === true

    if (!hasWalkingRoute) {
      gaps.push({
        afterEventId: a.id,
        beforeEventId: b.id,
        message: `No walking route between "${a.title}" check-in and "${b.title}" check-in`,
      })
    }
  }

  return gaps
}
```

- [ ] **Step 5: Drop `walking` from all Record<EventType> maps — four files**

**src/lib/buildMapSegments.ts** — add `WALKING_COLOR` constant, remove `walking` key, update the one reference:

```ts
// Add above TYPE_COLORS:
const WALKING_COLOR = '#22C55E'

// Replace TYPE_COLORS (remove walking entry):
export const TYPE_COLORS: Record<EventType, string> = {
  transport: '#4A90D9',
  accommodation: '#7C3AED',
  ticket: '#059669',
  restaurant: '#F59E0B',
}

// In the isWalkingSegment branch (around line 92), change:
//   color = TYPE_COLORS['walking']
// to:
//   color = WALKING_COLOR
```

**src/components/TimelineEvent.tsx** — remove `walking` entries:

```ts
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
```

**src/components/sheets/AddEventSheet.tsx** — remove `walking` from `EVENT_TYPES` and `TYPE_PLACEHOLDERS`:

```ts
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
```

**src/components/MapView.tsx** — remove `Footprints` import and `walking` from `TYPE_ICONS`:

```ts
// Change import line (remove Footprints):
import { Plane, BedDouble, Ticket, Utensils } from 'lucide-react'

// Replace TYPE_ICONS (remove walking entry):
const TYPE_ICONS: Record<EventType, React.FC<{ size?: number; color?: string }>> = {
  transport: Plane,
  accommodation: BedDouble,
  ticket: Ticket,
  restaurant: Utensils,
}
```

- [ ] **Step 6: Fix integration test fixtures — TripDetailPage.test.tsx**

Find the test "does not render a GAP warning when walking exists between accommodations". Replace the `w1` walking event with `arrivedOnFoot: true` on the `a2` accommodation. Update the test name:

Old fixture (lines ~110-115):
```ts
events: [
  makeEvent({ id: 'a1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
  makeEvent({ id: 'w1', type: 'walking', title: 'Walk to hotel', date: '2026-03-18', time: '09:00' }),
  makeEvent({ id: 'a2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
],
```

New fixture:
```ts
it('does not render a GAP warning when destination stay has arrivedOnFoot: true', () => {
  useTripsStore.setState({
    destinations: [makeDest({
      events: [
        makeEvent({ id: 'a1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
        makeEvent({ id: 'a2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', arrivedOnFoot: true }),
      ],
    })],
  })
  renderPage()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
```

- [ ] **Step 7: Fix integration test fixtures — TripsPage.test.tsx**

Find the test "shows ✓ OK badge when destination has events and no gaps". Replace the `w1` walking event with `arrivedOnFoot: true` on `a2`. Remove the `w1` event entirely from the events array:

Old fixture (lines ~58-63):
```ts
events: [
  { id: 'a1', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel A', place: 'Tokyo', date: '2026-03-15', time: '14:00', createdAt: '' },
  { id: 'w1', destinationId: 'dest-1', type: 'walking', title: 'Walk to hotel', place: 'Street', date: '2026-03-18', time: '09:00', createdAt: '' },
  { id: 'a2', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel B', place: 'Osaka', date: '2026-03-18', time: '15:00', createdAt: '' },
],
```

New fixture:
```ts
events: [
  { id: 'a1', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel A', place: 'Tokyo', date: '2026-03-15', time: '14:00', createdAt: '' },
  { id: 'a2', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel B', place: 'Osaka', date: '2026-03-18', time: '15:00', arrivedOnFoot: true, createdAt: '' },
],
```

- [ ] **Step 8: Run all tests — verify they pass**

```
npx vitest run --reporter=verbose
```

Expected: all tests pass. If any fail, fix before continuing.

- [ ] **Step 9: Commit**

```bash
git add src/types/trip.ts src/lib/gapDetection.ts src/lib/gapDetection.test.ts \
  src/lib/buildMapSegments.ts src/components/TimelineEvent.tsx \
  src/components/sheets/AddEventSheet.tsx src/components/MapView.tsx \
  src/pages/TripDetailPage.test.tsx src/pages/TripsPage.test.tsx
git commit -m "feat: replace walking EventType with arrivedOnFoot flag on TripEvent"
```

---

### Task 2: Map segment walking logic (TDD)

**Files:**
- Modify: `src/lib/buildMapSegments.ts`
- Modify: `src/lib/buildMapSegments.test.ts`

- [ ] **Step 1: Update buildMapSegments.test.ts**

Remove the two tests that use `type: 'walking'` fixtures (lines ~164-184):
- "produces isWalking: true segment when next point is a walking event"
- "segment FROM a walking event to the next is solid (isWalking: false)"

Add two replacement tests at the same location:

```ts
it('produces isWalking: true segment when destination event has arrivedOnFoot: true', () => {
  const events = [
    makeEvent({ id: 'acc-1', type: 'accommodation', lat: 35.6762, lng: 139.6503, date: '2026-03-15', time: '14:00' }),
    makeEvent({ id: 'acc-2', type: 'accommodation', lat: 35.6851, lng: 139.7100, date: '2026-03-18', time: '15:00', arrivedOnFoot: true }),
  ]
  const segments = buildMapSegments(events, [])
  expect(segments).toHaveLength(1)
  expect(segments[0].isWalking).toBe(true)
  expect(segments[0].color).toBe('#22C55E')
  expect(segments[0].isGap).toBe(false)
})

it('produces isWalking: false segment when destination event has no arrivedOnFoot flag', () => {
  const events = [
    makeEvent({ id: 'acc-1', type: 'accommodation', lat: 35.6762, lng: 139.6503, date: '2026-03-15', time: '14:00' }),
    makeEvent({ id: 'acc-2', type: 'accommodation', lat: 35.6851, lng: 139.7100, date: '2026-03-18', time: '15:00' }),
  ]
  const segments = buildMapSegments(events, [])
  expect(segments[0].isWalking).toBe(false)
})
```

- [ ] **Step 2: Run buildMapSegments tests — verify new tests fail**

```
npx vitest run src/lib/buildMapSegments.test.ts --reporter=verbose
```

Expected: the two new tests fail — `isWalking` is `false` because `isWalkingSegment` still checks `J.eventType === 'walking'`, not `arrivedOnFoot`.

- [ ] **Step 3: Update buildMapSegments.ts — MapPoint interface + isWalkingSegment logic**

Add `arrivedOnFoot?: boolean` to the `MapPoint` interface:

```ts
interface MapPoint {
  lat: number
  lng: number
  sourceEventId: string
  isArrival: boolean
  eventType: EventType
  eventDate: string
  eventTime: string
  arrivedOnFoot?: boolean
}
```

In the departure-point push block (the first `mapPoints.push`), add `arrivedOnFoot`:

```ts
mapPoints.push({
  lat: event.lat,
  lng: event.lng,
  sourceEventId: event.id,
  isArrival: false,
  eventType: event.type,
  eventDate: event.date,
  eventTime: event.time,
  arrivedOnFoot: event.arrivedOnFoot,
})
```

Do NOT add `arrivedOnFoot` to the synthetic arrival-point push (the one inside `if (event.type === 'transport' && event.latTo ...)`).

Change the `isWalkingSegment` check:

```ts
// old:
const isWalkingSegment = J.eventType === 'walking' && !J.isArrival

// new:
const isWalkingSegment = J.arrivedOnFoot === true && !J.isArrival
```

- [ ] **Step 4: Run all tests — verify they pass**

```
npx vitest run --reporter=verbose
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/buildMapSegments.ts src/lib/buildMapSegments.test.ts
git commit -m "feat: map walking segments now driven by arrivedOnFoot flag"
```

---

## Chunk 2: AddEventSheet checkbox

### Task 3: AddEventSheet "Arrived on foot" checkbox (TDD)

**Files:**
- Modify: `src/components/sheets/AddEventSheet.tsx`
- Modify: `src/components/sheets/AddEventSheet.test.tsx`

- [ ] **Step 1: Update AddEventSheet.test.tsx**

Remove these two tests (both reference `On Foot` pill):
- `'renders type selector pills: Transport, Stay, Ticket, Food, On Foot'`
- `'On Foot type shows single place field (no placeTo arrow)'`

Replace the first test with an updated pill assertion (no "On Foot"):

```ts
it('renders type selector pills: Transport, Stay, Ticket, Food', () => {
  renderSheet()
  expect(screen.getByText('Transport')).toBeInTheDocument()
  expect(screen.getByText('Stay')).toBeInTheDocument()
  expect(screen.getByText('Ticket')).toBeInTheDocument()
  expect(screen.getByText('Food')).toBeInTheDocument()
  expect(screen.queryByText('On Foot')).not.toBeInTheDocument()
})
```

Add four new tests for the checkbox. Insert them after the existing pill test:

```ts
it('Arrived on foot checkbox is unchecked by default', () => {
  renderSheet()
  const checkbox = screen.getByLabelText('Arrived on foot') as HTMLInputElement
  expect(checkbox.checked).toBe(false)
})

it('checking Arrived on foot submits arrivedOnFoot: true', () => {
  const addEvent = vi.fn()
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
    addEvent,
  })
  renderSheet()
  fireEvent.click(screen.getByText('Stay'))
  fireEvent.change(screen.getByPlaceholderText('Hotel name'), { target: { value: 'Hilton' } })
  fireEvent.change(screen.getByTestId('places-input-fallback'), { target: { value: 'Tokyo' } })
  fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
  fireEvent.change(screen.getByLabelText('Event time'), { target: { value: '14:00' } })
  fireEvent.click(screen.getByLabelText('Arrived on foot'))
  fireEvent.click(screen.getByText('Add to Timeline'))
  expect(addEvent).toHaveBeenCalledWith(
    DEST_ID,
    expect.objectContaining({ arrivedOnFoot: true })
  )
})

it('editing event with arrivedOnFoot: true shows checkbox checked', () => {
  const editEvent: TripEvent = {
    id: 'ev-1',
    destinationId: DEST_ID,
    type: 'accommodation',
    title: 'Hilton',
    place: 'Tokyo',
    date: '2026-03-15',
    time: '14:00',
    arrivedOnFoot: true,
    createdAt: '',
  }
  renderSheet({ editEvent })
  const checkbox = screen.getByLabelText('Arrived on foot') as HTMLInputElement
  expect(checkbox.checked).toBe(true)
})

it('leaving Arrived on foot unchecked does not submit arrivedOnFoot: true', () => {
  const addEvent = vi.fn()
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
    addEvent,
  })
  renderSheet()
  fireEvent.click(screen.getByText('Stay'))
  fireEvent.change(screen.getByPlaceholderText('Hotel name'), { target: { value: 'Hilton' } })
  fireEvent.change(screen.getByTestId('places-input-fallback'), { target: { value: 'Tokyo' } })
  fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
  fireEvent.change(screen.getByLabelText('Event time'), { target: { value: '14:00' } })
  // Do NOT click the checkbox
  fireEvent.click(screen.getByText('Add to Timeline'))
  const payload = addEvent.mock.calls[0][1]
  expect(payload.arrivedOnFoot).not.toBe(true)
})
```

- [ ] **Step 2: Run AddEventSheet tests — verify new tests fail**

```
npx vitest run src/components/sheets/AddEventSheet.test.tsx --reporter=verbose
```

Expected: new checkbox tests fail — checkbox doesn't exist yet. The updated pill test should pass (since `walking` pill was already removed in Task 1).

- [ ] **Step 3: Update AddEventSheet.tsx — add arrivedOnFoot state and checkbox**

Add `arrivedOnFoot` state variable after the last existing state declaration (`confirmDelete`, line 54):

```ts
const [arrivedOnFoot, setArrivedOnFoot] = useState(false)
```

In the `useEffect` open handler, add `setArrivedOnFoot` to both branches:

```ts
// Edit branch — add after setNotes:
setArrivedOnFoot(editEvent.arrivedOnFoot ?? false)

// New-event branch — add after setNotes(''):
setArrivedOnFoot(false)
```

In `handleSubmit`, add `arrivedOnFoot` to the `data` object (after `notes`):

```ts
arrivedOnFoot: arrivedOnFoot || undefined,
```

Add the checkbox UI in the JSX — insert it after the closing `)}` of the place ternary block (line ~224) and before the `{/* Date + Departure time */}` comment:

```tsx
{/* Arrived on foot toggle */}
<label className="flex items-center gap-2 text-sm text-foreground">
  <input
    type="checkbox"
    checked={arrivedOnFoot}
    onChange={e => setArrivedOnFoot(e.target.checked)}
    aria-label="Arrived on foot"
  />
  Arrived on foot
</label>
```

- [ ] **Step 4: Run all tests — verify they pass**

```
npx vitest run --reporter=verbose
```

Expected: all tests pass. Final count should be similar to before (net: removed 2 walking tests, added 5 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/sheets/AddEventSheet.tsx src/components/sheets/AddEventSheet.test.tsx
git commit -m "feat: add Arrived on foot checkbox to AddEventSheet"
```
