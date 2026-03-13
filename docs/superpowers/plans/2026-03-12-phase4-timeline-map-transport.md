# Phase 4 — Timeline Date Grouping, Map Sidebar, Transport Origin/Destination

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add date-grouped timeline headers, a left sidebar to the map view, and From/To/arrival-time fields for transport events.

**Architecture:** New `useTimelineGroups` hook groups sorted events by date and inlines gaps; consumed by both `TripDetailPage` (timeline view) and `MapView` (sidebar). `TripEvent` gains five optional transport-only fields (`placeTo`, `placeIdTo`, `latTo`, `lngTo`, `arrivalTime`). `buildMapSegments` expands transport events with explicit destinations into two map points using a `MapPoint` chain. `MapView` gains a 38%-wide left sidebar using `useTimelineGroups`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, Zustand 5, Vitest, @testing-library/react, @googlemaps/js-api-loader

**Spec:** `docs/superpowers/specs/2026-03-12-phase4-timeline-map-transport.md`

---

## Chunk 1: Foundation

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/types/trip.ts` | Modify | Add 5 transport-only optional fields |
| `src/lib/useTimelineGroups.ts` | Create | Pure hook: group events by date, inline gaps |
| `src/lib/useTimelineGroups.test.ts` | Create | Unit tests for the hook |
| `src/components/TimelineDateHeader.tsx` | Create | Date group header component |

---

### Task 1: Extend TripEvent type

**Files:**
- Modify: `src/types/trip.ts`

- [ ] **Step 1: Add five transport-only optional fields after `placeId`**

```ts
export interface TripEvent {
  id: string
  destinationId: string
  type: EventType
  title: string
  place: string
  placeId?: string
  lat?: number
  lng?: number
  // Transport-only: destination (arrival) location
  placeTo?: string      // display name of destination
  placeIdTo?: string    // Google Place ID of destination
  latTo?: number        // WGS84 latitude of destination
  lngTo?: number        // WGS84 longitude of destination
  // Transport-only: arrival time
  arrivalTime?: string  // HH:mm (24h); separate from `time` (departure)
  date: string
  time: string
  value?: number
  notes?: string
  createdAt: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

---

### Task 2: Create `useTimelineGroups` hook with TDD

**Files:**
- Create: `src/lib/useTimelineGroups.ts`
- Create: `src/lib/useTimelineGroups.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/useTimelineGroups.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { useTimelineGroups } from './useTimelineGroups'
import type { TripEvent } from '../types/trip'
import type { GapWarning } from './gapDetection'

function makeEvent(overrides: Partial<TripEvent>): TripEvent {
  return {
    id: 'ev-1',
    destinationId: 'dest-1',
    type: 'transport',
    title: 'Event',
    place: 'Somewhere',
    date: '2026-03-15',
    time: '10:00',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('useTimelineGroups', () => {
  it('returns empty array for no events', () => {
    expect(useTimelineGroups([], [])).toEqual([])
  })

  it('single event produces one group with one event item', () => {
    const events = [makeEvent({ date: '2026-03-15' })]
    const groups = useTimelineGroups(events, [])
    expect(groups).toHaveLength(1)
    expect(groups[0].date).toBe('2026-03-15')
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].kind).toBe('event')
  })

  it('two events on same date go into one group', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-03-15', time: '08:00' }),
      makeEvent({ id: 'b', date: '2026-03-15', time: '14:00' }),
    ]
    const groups = useTimelineGroups(events, [])
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(2)
  })

  it('events on different dates produce separate groups in ascending date order', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-03-15', time: '08:00' }),
      makeEvent({ id: 'b', date: '2026-03-16', time: '09:00' }),
    ]
    const groups = useTimelineGroups(events, [])
    expect(groups).toHaveLength(2)
    expect(groups[0].date).toBe('2026-03-15')
    expect(groups[1].date).toBe('2026-03-16')
  })

  it('gap warning appears immediately after afterEventId event within its date group', () => {
    const events = [
      makeEvent({ id: 'a', type: 'accommodation', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'b', date: '2026-03-15', time: '16:00' }),
      makeEvent({ id: 'c', type: 'accommodation', date: '2026-03-18', time: '15:00' }),
    ]
    const gaps: GapWarning[] = [{ afterEventId: 'a', beforeEventId: 'c', message: 'Gap message' }]
    const groups = useTimelineGroups(events, gaps)
    // Day 15 group: event(a), gap, event(b)
    const march15 = groups.find(g => g.date === '2026-03-15')!
    expect(march15.items[0]).toMatchObject({ kind: 'event' })
    expect(march15.items[1]).toMatchObject({ kind: 'gap' })
    expect(march15.items[2]).toMatchObject({ kind: 'event' })
  })

  it('gap card lands in the date group of the afterEventId event', () => {
    const events = [
      makeEvent({ id: 'a', type: 'accommodation', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'b', type: 'accommodation', date: '2026-03-18', time: '15:00' }),
    ]
    const gaps: GapWarning[] = [{ afterEventId: 'a', beforeEventId: 'b', message: 'No transport' }]
    const groups = useTimelineGroups(events, gaps)
    // Gap should be in 2026-03-15 group (afterEventId='a' is on 15th)
    const march15 = groups.find(g => g.date === '2026-03-15')!
    expect(march15.items.some(i => i.kind === 'gap')).toBe(true)
    const march18 = groups.find(g => g.date === '2026-03-18')!
    expect(march18.items.some(i => i.kind === 'gap')).toBe(false)
  })

  it('group label has correct format — "Sun, 15 Mar 2026" for 2026-03-15', () => {
    const events = [makeEvent({ date: '2026-03-15' })]
    const groups = useTimelineGroups(events, [])
    expect(groups[0].label).toBe('Sun, 15 Mar 2026')
  })
})
```

- [ ] **Step 2: Run tests — verify all 7 fail**

```bash
pnpm exec vitest run src/lib/useTimelineGroups.test.ts
```

Expected: All 7 FAIL with "Cannot find module './useTimelineGroups'".

- [ ] **Step 3: Implement `src/lib/useTimelineGroups.ts`**

```ts
import type { TripEvent } from '../types/trip'
import type { GapWarning } from './gapDetection'

export type RenderItem =
  | { kind: 'event'; event: TripEvent }
  | { kind: 'gap'; message: string; key: string }

export interface TimelineGroup {
  date: string   // YYYY-MM-DD — used as React key
  label: string  // "Sun, 15 Mar 2026"
  items: RenderItem[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatGroupLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${WEEKDAYS[dt.getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`
}

export function useTimelineGroups(
  sortedEvents: TripEvent[],
  gaps: GapWarning[]
): TimelineGroup[] {
  const groups: TimelineGroup[] = []
  const groupByDate = new Map<string, TimelineGroup>()

  for (const event of sortedEvents) {
    if (!groupByDate.has(event.date)) {
      const group: TimelineGroup = {
        date: event.date,
        label: formatGroupLabel(event.date),
        items: [],
      }
      groupByDate.set(event.date, group)
      groups.push(group)
    }
    const group = groupByDate.get(event.date)!
    group.items.push({ kind: 'event', event })
    const gap = gaps.find(g => g.afterEventId === event.id)
    if (gap) {
      group.items.push({ kind: 'gap', message: gap.message, key: `gap-${gap.afterEventId}` })
    }
  }

  return groups
}
```

- [ ] **Step 4: Run tests — verify all 7 pass**

```bash
pnpm exec vitest run src/lib/useTimelineGroups.test.ts
```

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/types/trip.ts src/lib/useTimelineGroups.ts src/lib/useTimelineGroups.test.ts
git commit -m "feat: extend TripEvent type and add useTimelineGroups hook"
```

---

### Task 3: Create TimelineDateHeader component

**Files:**
- Create: `src/components/TimelineDateHeader.tsx`

- [ ] **Step 1: Create `src/components/TimelineDateHeader.tsx`**

```tsx
interface Props {
  label: string
}

export default function TimelineDateHeader({ label }: Props) {
  return (
    <div className="pt-4 pb-1 first:pt-0">
      <span className="text-xs font-bold text-primary uppercase tracking-wide">
        {label}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineDateHeader.tsx
git commit -m "feat: add TimelineDateHeader component"
```

---

## Chunk 2: buildMapSegments Transport Expansion

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/buildMapSegments.ts` | Rewrite | MapPoint chain with transport expansion |
| `src/lib/buildMapSegments.test.ts` | Modify | Add 3 transport expansion tests |

---

### Task 4: Update `buildMapSegments` with TDD

**Files:**
- Rewrite: `src/lib/buildMapSegments.ts`
- Modify: `src/lib/buildMapSegments.test.ts`

- [ ] **Step 1: Add 3 failing tests to `src/lib/buildMapSegments.test.ts`**

Add inside the `describe('buildMapSegments', ...)` block, after the existing 9 tests:

```ts
  it('transport event with latTo/lngTo expands into 3 segments: before-origin, origin→dest, dest-after', () => {
    const events = [
      makeEvent({ id: 'hotel-a', type: 'accommodation', lat: 10.0, lng: 10.0, date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'flight', type: 'transport', lat: 20.0, lng: 20.0, latTo: 30.0, lngTo: 30.0, date: '2026-03-18', time: '08:00', arrivalTime: '23:00' }),
      makeEvent({ id: 'hotel-b', type: 'accommodation', lat: 31.0, lng: 31.0, date: '2026-03-19', time: '14:00' }),
    ]
    const segments = buildMapSegments(events, [])
    expect(segments).toHaveLength(3)
    // origin→destination segment is always transport blue, never a gap
    expect(segments[1].color).toBe('#4A90D9')
    expect(segments[1].isGap).toBe(false)
    expect(segments[1].from).toEqual({ lat: 20.0, lng: 20.0 })
    expect(segments[1].to).toEqual({ lat: 30.0, lng: 30.0 })
  })

  it('transport event without latTo/lngTo behaves as single-point event (no expansion)', () => {
    const events = [
      makeEvent({ id: 'a', type: 'transport', lat: 10.0, lng: 10.0, date: '2026-03-15', time: '08:00' }),
      makeEvent({ id: 'b', type: 'accommodation', lat: 20.0, lng: 20.0, date: '2026-03-15', time: '22:00' }),
    ]
    const segments = buildMapSegments(events, [])
    expect(segments).toHaveLength(1)
  })

  it('gap color applied correctly when transport has no latTo/lngTo and accommodations lack transport', () => {
    const events = [
      makeEvent({ id: 'a1', type: 'accommodation', lat: 10.0, lng: 10.0, date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'a2', type: 'accommodation', lat: 20.0, lng: 20.0, date: '2026-03-18', time: '15:00' }),
    ]
    const gaps: GapWarning[] = [{ afterEventId: 'a1', beforeEventId: 'a2', message: 'No transport' }]
    const segments = buildMapSegments(events, gaps)
    expect(segments).toHaveLength(1)
    expect(segments[0].isGap).toBe(true)
    expect(segments[0].color).toBe(GAP_COLOR)
  })
```

Also add `TYPE_COLORS` to the import at line 2:

```ts
import { buildMapSegments, GAP_COLOR, TYPE_COLORS } from './buildMapSegments'
```

- [ ] **Step 2: Run tests — verify 3 new tests fail, existing 9 pass**

```bash
pnpm exec vitest run src/lib/buildMapSegments.test.ts
```

Expected: 9 PASS + 3 FAIL. New tests fail because `latTo`/`lngTo` are unknown properties (before type update) — or because the current implementation ignores them.

Note: if step 2 of Task 1 was done, `latTo`/`lngTo` are already on the type, so the new tests compile but produce wrong results.

- [ ] **Step 3: Rewrite `src/lib/buildMapSegments.ts`**

```ts
import type { TripEvent, EventType } from '../types/trip'
import type { GapWarning } from './gapDetection'

export interface MapSegment {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  color: string    // hex — matches TYPE_COLORS of the starting event (or transport blue for legs)
  isGap: boolean   // true → render as dashed orange polyline
}

export const TYPE_COLORS: Record<EventType, string> = {
  transport: '#4A90D9',
  accommodation: '#7C3AED',
  ticket: '#059669',
  restaurant: '#F59E0B',
}

export const GAP_COLOR = '#C75B2A'

interface MapPoint {
  lat: number
  lng: number
  sourceEventId: string
  isArrival: boolean   // true only for the synthetic arrival point of a transport event
  eventType: EventType
  eventDate: string
  eventTime: string
}

export function buildMapSegments(
  sortedEvents: TripEvent[],
  gaps: GapWarning[]
): MapSegment[] {
  // Build map points, expanding transport events with latTo/lngTo into two points
  const mapPoints: MapPoint[] = []

  for (const event of sortedEvents) {
    if (event.lat === undefined || event.lng === undefined) continue

    mapPoints.push({
      lat: event.lat,
      lng: event.lng,
      sourceEventId: event.id,
      isArrival: false,
      eventType: event.type,
      eventDate: event.date,
      eventTime: event.time,
    })

    // Transport events with explicit destination add a synthetic arrival point
    if (event.type === 'transport' && event.latTo !== undefined && event.lngTo !== undefined) {
      mapPoints.push({
        lat: event.latTo,
        lng: event.lngTo,
        sourceEventId: event.id,
        isArrival: true,
        eventType: event.type,
        eventDate: event.date,
        eventTime: event.arrivalTime ?? event.time,
      })
    }
  }

  if (mapPoints.length < 2) return []

  // Lookup for gap detection — only built when gaps exist
  const eventById = gaps.length > 0
    ? new Map<string, TripEvent>(sortedEvents.map(e => [e.id, e]))
    : null

  const segments: MapSegment[] = []

  for (let i = 0; i < mapPoints.length - 1; i++) {
    const I = mapPoints[i]
    const J = mapPoints[i + 1]

    // Intra-transport leg: left point is origin, right point is arrival of same event
    const isTransportLeg =
      !I.isArrival && J.isArrival && I.sourceEventId === J.sourceEventId

    let color: string
    let isGap = false

    if (isTransportLeg) {
      // Origin → arrival of same transport event: always transport blue, never a gap
      color = TYPE_COLORS['transport']
    } else if (I.isArrival) {
      // Segment from arrival point — skip gap detection (already transported)
      color = TYPE_COLORS[I.eventType]
    } else if (eventById !== null) {
      const aDateTime = `${I.eventDate} ${I.eventTime}`
      const bDateTime = `${J.eventDate} ${J.eventTime}`
      const hasGap = gaps.some(g => {
        const refEvent = eventById.get(g.afterEventId)
        if (!refEvent) return false
        const refDateTime = `${refEvent.date} ${refEvent.time}`
        return refDateTime >= aDateTime && refDateTime < bDateTime
      })
      if (hasGap) {
        color = GAP_COLOR
        isGap = true
      } else {
        color = TYPE_COLORS[I.eventType]
      }
    } else {
      color = TYPE_COLORS[I.eventType]
    }

    segments.push({
      from: { lat: I.lat, lng: I.lng },
      to: { lat: J.lat, lng: J.lng },
      color,
      isGap,
    })
  }

  return segments
}
```

- [ ] **Step 4: Run all buildMapSegments tests — verify all 12 pass**

```bash
pnpm exec vitest run src/lib/buildMapSegments.test.ts
```

Expected: `12 passed`.

- [ ] **Step 5: Run all tests to verify nothing broken**

```bash
pnpm exec vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/buildMapSegments.ts src/lib/buildMapSegments.test.ts
git commit -m "feat: update buildMapSegments to expand transport events with explicit destinations"
```

---

## Chunk 3: Timeline + Form UI

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/TimelineEvent.tsx` | Modify | Add place row; transport From→To + arrival time display |
| `src/components/sheets/AddEventSheet.tsx` | Modify | Transport From/To/arrivalTime fields + state reset |
| `src/components/sheets/AddEventSheet.test.tsx` | Modify | Fix 3 existing tests + add 5 transport-specific tests |
| `src/pages/TripDetailPage.tsx` | Modify | Use useTimelineGroups + render TimelineDateHeader |
| `src/pages/TripDetailPage.test.tsx` | Modify | Add 3 date grouping tests |

---

### Task 5: Update TimelineEvent — place row and transport display

**Files:**
- Modify: `src/components/TimelineEvent.tsx`

- [ ] **Step 1: Replace `src/components/TimelineEvent.tsx`**

```tsx
import { formatDate } from '@/lib/formatDate'
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
  const timeDisplay =
    event.type === 'transport' && event.arrivalTime
      ? `🛫 ${event.time} · 🛬 ${event.arrivalTime}`
      : event.time

  const placeDisplay =
    event.type === 'transport' && event.placeTo
      ? `📍 ${event.place} → ${event.placeTo}`
      : event.place
        ? `📍 ${event.place}`
        : null

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
        <div className="text-[10px] text-muted">{formatDate(event.date)} · {timeDisplay}</div>
        <div className="font-semibold text-foreground text-sm mt-0.5">{event.title}</div>
        {placeDisplay && (
          <div className="text-[10px] text-muted mt-0.5">{placeDisplay}</div>
        )}
        <div className="text-[10px] text-muted mt-0.5">
          {TYPE_LABELS[event.type]}
          {event.value != null ? ` · ${event.value}` : ''}
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

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineEvent.tsx
git commit -m "feat: add place row and transport From→To/arrival time display to TimelineEvent"
```

---

### Task 6: Update AddEventSheet — transport From/To + arrival time (TDD)

**Files:**
- Modify: `src/components/sheets/AddEventSheet.tsx`
- Modify: `src/components/sheets/AddEventSheet.test.tsx`

- [ ] **Step 1: Add 5 new failing tests and fix 3 existing tests in `AddEventSheet.test.tsx`**

**Fix 3 existing tests** that use `screen.getByTestId('places-input-fallback')` or `document.querySelector('input[type="time"]')` — these will break when transport shows two place inputs and two time inputs:

In test `'shows value error when a non-positive number is entered'` (line 80–89), replace:
```ts
fireEvent.change(screen.getByTestId('places-input-fallback'), { target: { value: 'Tokyo' } })
// ...
fireEvent.change(document.querySelector('input[type="time"]') as HTMLInputElement, { target: { value: '10:00' } })
```
with:
```ts
fireEvent.change(screen.getAllByTestId('places-input-fallback')[0], { target: { value: 'Tokyo' } })
// ...
fireEvent.change(screen.getByLabelText('Departure time'), { target: { value: '10:00' } })
```

In test `'does not show required errors when all required fields are filled'` (line 91–100), same replacements.

In test `'passes lat and lng to the store when submitting with coordinates'` (line 149–178), same replacements.

**Add 5 new tests** at the end of the `describe` block:

```tsx
  it('transport type shows two place inputs (From and To)', () => {
    renderSheet()  // default type is transport
    expect(screen.getByPlaceholderText(/From: departure/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/To: arrival/)).toBeInTheDocument()
  })

  it('transport type shows arrival time field', () => {
    renderSheet()
    expect(screen.getByLabelText('Arrival time')).toBeInTheDocument()
  })

  it('non-transport type shows single place input, no To, no arrival time', () => {
    renderSheet()
    fireEvent.click(screen.getByText('Stay'))
    expect(screen.queryByPlaceholderText(/From: departure/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Arrival time')).not.toBeInTheDocument()
    expect(screen.getByTestId('places-input-fallback')).toBeInTheDocument()
  })

  it('placeTo being empty does not trigger a validation error', () => {
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/Flight GRU/), { target: { value: 'My Flight' } })
    fireEvent.change(screen.getAllByTestId('places-input-fallback')[0], { target: { value: 'GRU Airport' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('Departure time'), { target: { value: '08:00' } })
    // Leave To (placeTo) blank
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.queryByText('Place is required')).not.toBeInTheDocument()
  })

  it('opening edit sheet for transport event pre-fills placeTo and arrivalTime', () => {
    const editEvent: TripEvent = {
      id: 'ev-1',
      destinationId: DEST_ID,
      type: 'transport',
      title: 'Flight',
      place: 'GRU',
      placeId: 'gru-id',
      lat: -23.0,
      lng: -46.0,
      placeTo: 'Narita',
      placeIdTo: 'nrt-id',
      latTo: 35.0,
      lngTo: 139.0,
      date: '2026-03-15',
      time: '08:00',
      arrivalTime: '23:00',
      createdAt: '',
    }
    renderSheet({ editEvent })
    expect(screen.getByDisplayValue('Narita')).toBeInTheDocument()
    expect(screen.getByDisplayValue('23:00')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests — verify 5 new tests fail, 3 fixed tests may fail too**

```bash
pnpm exec vitest run src/components/sheets/AddEventSheet.test.tsx
```

Expected: 5 new FAIL. The 3 fixed tests may also fail if the current implementation doesn't have two inputs yet — that's expected.

- [ ] **Step 3: Replace `src/components/sheets/AddEventSheet.tsx`**

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
  const [lat, setLat] = useState<number | undefined>()
  const [lng, setLng] = useState<number | undefined>()
  const [placeTo, setPlaceTo] = useState('')
  const [placeIdTo, setPlaceIdTo] = useState<string | undefined>()
  const [latTo, setLatTo] = useState<number | undefined>()
  const [lngTo, setLngTo] = useState<number | undefined>()
  const [arrivalTime, setArrivalTime] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isEdit = !!editEvent

  useEffect(() => {
    if (open && editEvent) {
      setType(editEvent.type)
      setTitle(editEvent.title)
      setPlace(editEvent.place)
      setPlaceId(editEvent.placeId)
      setLat(editEvent.lat)
      setLng(editEvent.lng)
      setPlaceTo(editEvent.placeTo ?? '')
      setPlaceIdTo(editEvent.placeIdTo)
      setLatTo(editEvent.latTo)
      setLngTo(editEvent.lngTo)
      setArrivalTime(editEvent.arrivalTime ?? '')
      setDate(editEvent.date)
      setTime(editEvent.time)
      setValue(editEvent.value?.toString() ?? '')
      setNotes(editEvent.notes ?? '')
    } else if (open && !editEvent) {
      setType('transport')
      setTitle('')
      setPlace('')
      setPlaceId(undefined)
      setLat(undefined)
      setLng(undefined)
      setPlaceTo('')
      setPlaceIdTo(undefined)
      setLatTo(undefined)
      setLngTo(undefined)
      setArrivalTime('')
      setDate('')
      setTime('')
      setValue('')
      setNotes('')
    }
    setErrors({})
    setConfirmDelete(false)
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
      lat,
      lng,
      ...(type === 'transport' ? {
        placeTo: placeTo.trim() || undefined,
        placeIdTo: placeTo.trim() ? placeIdTo : undefined,
        latTo: placeTo.trim() ? latTo : undefined,
        lngTo: placeTo.trim() ? lngTo : undefined,
        arrivalTime: arrivalTime || undefined,
      } : {}),
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
    setConfirmDelete(true)
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

        {/* Place — transport gets From + To, others get single input */}
        {type === 'transport' ? (
          <>
            <div>
              <GooglePlacesInput
                value={place}
                onChange={(p, id, la, ln) => { setPlace(p); setPlaceId(id); setLat(la); setLng(ln) }}
                placeholder="🛫 From: departure place"
                className={inputClass(errors.place)}
              />
              {errors.place && <p className="text-red-500 text-xs mt-1">{errors.place}</p>}
            </div>
            <div className="text-center text-[#C75B2A] text-lg leading-none" aria-hidden="true">↓</div>
            <div>
              <GooglePlacesInput
                value={placeTo}
                onChange={(p, id, la, ln) => { setPlaceTo(p); setPlaceIdTo(id); setLatTo(la); setLngTo(ln) }}
                placeholder="🛬 To: arrival place"
                className={inputClass()}
              />
            </div>
          </>
        ) : (
          <div>
            <GooglePlacesInput
              value={place}
              onChange={(p, id, la, ln) => { setPlace(p); setPlaceId(id); setLat(la); setLng(ln) }}
              placeholder="📍 Search place"
              className={inputClass(errors.place)}
            />
            {errors.place && <p className="text-red-500 text-xs mt-1">{errors.place}</p>}
          </div>
        )}

        {/* Date + Departure time */}
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
              aria-label={type === 'transport' ? 'Departure time' : 'Event time'}
              className={cn(
                'w-full bg-input-bg border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary',
                errors.time ? 'border-red-500' : 'border-border'
              )}
            />
            {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
          </div>
        </div>

        {/* Arrival time — transport only */}
        {type === 'transport' && (
          <div>
            <input
              type="time"
              value={arrivalTime}
              onChange={e => setArrivalTime(e.target.value)}
              aria-label="Arrival time"
              className="w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              placeholder="Arrival time (optional)"
            />
          </div>
        )}

        {/* Value */}
        <div>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Cost (optional)"
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
        {isEdit && !confirmDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full text-red-500 text-sm font-medium py-1 hover:text-red-600 transition-colors"
          >
            Delete event
          </button>
        )}
        {isEdit && confirmDelete && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { deleteEvent(destinationId, editEvent!.id); onClose() }}
              className="flex-1 bg-red-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-600 transition-colors"
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 bg-input-bg text-foreground rounded-xl py-3 text-sm font-bold hover:bg-border transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </BottomSheet>
  )
}
```

- [ ] **Step 4: Run AddEventSheet tests — verify all pass**

```bash
pnpm exec vitest run src/components/sheets/AddEventSheet.test.tsx
```

Expected: All tests pass (original 10 + 5 new = 15 total, or count may vary by existing test count).

- [ ] **Step 5: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/sheets/AddEventSheet.tsx src/components/sheets/AddEventSheet.test.tsx
git commit -m "feat: add transport From/To/arrival-time fields to AddEventSheet"
```

---

### Task 7: Update TripDetailPage — date grouping with TDD

**Files:**
- Modify: `src/pages/TripDetailPage.tsx`
- Modify: `src/pages/TripDetailPage.test.tsx`

- [ ] **Step 1: Add 3 failing tests to `TripDetailPage.test.tsx`**

Add after the last existing test inside the `describe('TripDetailPage', ...)` block:

```tsx
  it('renders a date header for each distinct event date', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'a', date: '2026-03-15', time: '08:00', title: 'Flight' }),
          makeEvent({ id: 'b', date: '2026-03-16', time: '14:00', title: 'Hotel' }),
        ],
      })],
    })
    renderPage()
    expect(screen.getByText('Sun, 15 Mar 2026')).toBeInTheDocument()
    expect(screen.getByText('Mon, 16 Mar 2026')).toBeInTheDocument()
  })

  it('date header appears before its events in the DOM', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'a', date: '2026-03-15', time: '08:00', title: 'Flight' }),
        ],
      })],
    })
    renderPage()
    const header = screen.getByText('Sun, 15 Mar 2026')
    const event = screen.getByText('Flight')
    expect(header.compareDocumentPosition(event) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('GAP warning appears after the afterEventId event within its date group', () => {
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
    const dateHeader = screen.getByText('Sun, 15 Mar 2026')
    const gapAlert = screen.getByRole('alert')
    // Gap (afterEventId=a1, date=15th) appears after the 15th date header
    expect(dateHeader.compareDocumentPosition(gapAlert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
```

- [ ] **Step 2: Run tests — verify 3 new tests fail**

```bash
pnpm exec vitest run src/pages/TripDetailPage.test.tsx
```

Expected: 9 existing PASS, 3 new FAIL (no date headers rendered yet).

- [ ] **Step 3: Replace `src/pages/TripDetailPage.tsx`**

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Calendar, ChevronLeft } from 'lucide-react'
import { useTripsStore } from '@/stores/tripsStore'
import { detectGaps } from '@/lib/gapDetection'
import { useTimelineGroups } from '@/lib/useTimelineGroups'
import { formatDate } from '@/lib/formatDate'
import TimelineEvent from '@/components/TimelineEvent'
import TimelineDateHeader from '@/components/TimelineDateHeader'
import GapWarningCard from '@/components/GapWarningCard'
import ViewToggle from '@/components/ViewToggle'
import MapView from '@/components/MapView'
import AddEventSheet from '@/components/sheets/AddEventSheet'
import BottomNav from '@/components/BottomNav'
import type { TripEvent } from '@/types/trip'
import type { View } from '@/components/ViewToggle'

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const destination = useTripsStore(s => s.destinations.find(d => d.id === id))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<TripEvent | undefined>()
  const [view, setView] = useState<View>('timeline')

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
  const groups = useTimelineGroups(sortedEvents, gaps)

  function openAddSheet() {
    setEditEvent(undefined)
    setSheetOpen(true)
  }

  function openEditSheet(event: TripEvent) {
    setEditEvent(event)
    setSheetOpen(true)
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/trips')}
          className="flex items-center gap-1 text-primary text-sm font-semibold shrink-0 px-2 py-1 rounded-lg hover:bg-primary/10 active:bg-primary/20 transition-colors"
        >
          <ChevronLeft size={16} />
          Trips
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold text-foreground truncate">
            {destination.emoji} {destination.title}
          </h1>
          <p className="text-xs text-muted flex items-center gap-1">
            <Calendar size={11} aria-hidden="true" />
            {formatDate(destination.startDate)} – {formatDate(destination.endDate)} · {destination.events.length} event{destination.events.length !== 1 ? 's' : ''}
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

      {/* View Toggle */}
      <div className="px-4 pb-3">
        <ViewToggle active={view} onChange={setView} />
      </div>

      {/* Body */}
      {view === 'timeline' ? (
        <div className="flex-1 overflow-auto px-4">
          {sortedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <div className="text-4xl mb-3" aria-hidden="true">📅</div>
              <p className="text-sm text-muted">No events yet. Tap + to add your first.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border" aria-hidden="true" />
              <div className="pl-5">
                {groups.map(group => (
                  <div key={group.date}>
                    <TimelineDateHeader label={group.label} />
                    <div className="space-y-3 mb-2">
                      {group.items.map(item =>
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
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <MapView events={sortedEvents} gaps={gaps} onEdit={openEditSheet} />
      )}

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

- [ ] **Step 4: Run TripDetailPage tests — verify all 12 pass**

```bash
pnpm exec vitest run src/pages/TripDetailPage.test.tsx
```

Expected: `12 passed`.

- [ ] **Step 5: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/TripDetailPage.tsx src/pages/TripDetailPage.test.tsx
git commit -m "feat: add date-grouped timeline to TripDetailPage using useTimelineGroups"
```

---

## Chunk 4: MapView Sidebar

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/MapView.tsx` | Rewrite | Add left sidebar + arrival-pin pass |
| `src/components/MapView.test.tsx` | Modify | Update stubGoogleMaps + add sidebar tests |

---

### Task 8: Update MapView — sidebar and arrival pins (TDD)

**Files:**
- Rewrite: `src/components/MapView.tsx`
- Modify: `src/components/MapView.test.tsx`

- [ ] **Step 1: Update `stubGoogleMaps` to include `panTo` and `setZoom`, then add 4 failing tests**

In `src/components/MapView.test.tsx`, update the `stubGoogleMaps` function:

```ts
function stubGoogleMaps() {
  vi.stubGlobal('google', {
    maps: {
      Map: vi.fn(function () {
        return { fitBounds: vi.fn(), setCenter: vi.fn(), panTo: vi.fn(), setZoom: vi.fn() }
      }),
      Marker: vi.fn(function () { return { addListener: vi.fn(), setMap: vi.fn() } }),
      Polyline: vi.fn(function () { return { setMap: vi.fn() } }),
      LatLngBounds: vi.fn(function () { return { extend: vi.fn(), isEmpty: vi.fn(function () { return false }) } }),
      SymbolPath: { CIRCLE: 0 },
      event: { clearInstanceListeners: vi.fn() },
    },
  })
}
```

Then add 4 new tests inside the `describe('with API key', ...)` block, after the existing 4 tests:

```tsx
    it('sidebar renders event titles', async () => {
      const events = [
        makeEvent({ id: 'a', title: 'My Flight', lat: 35.0, lng: 139.0 }),
      ]
      render(<MapView events={events} gaps={[]} onEdit={() => {}} />)
      await act(async () => {})
      expect(screen.getByText('My Flight')).toBeInTheDocument()
    })

    it('clicking sidebar item calls map.panTo with event coordinates', async () => {
      let capturedPanTo: ReturnType<typeof vi.fn> | null = null
      vi.mocked(google.maps.Map).mockImplementation(function () {
        const panTo = vi.fn()
        capturedPanTo = panTo
        return { fitBounds: vi.fn(), setCenter: vi.fn(), panTo, setZoom: vi.fn() }
      })
      const events = [
        makeEvent({ id: 'a', title: 'My Flight', lat: 35.0, lng: 139.0 }),
      ]
      render(<MapView events={events} gaps={[]} onEdit={() => {}} />)
      await act(async () => {})

      fireEvent.click(screen.getByRole('button', { name: 'My Flight' }))
      expect(capturedPanTo).toHaveBeenCalledWith({ lat: 35.0, lng: 139.0 })
    })

    it('clicking sidebar item with no coordinates does not throw', async () => {
      const events = [
        makeEvent({ id: 'a', title: 'No Coords Event' }),  // no lat/lng
      ]
      render(<MapView events={events} gaps={[]} onEdit={() => {}} />)
      await act(async () => {})

      expect(() =>
        fireEvent.click(screen.getByRole('button', { name: 'No Coords Event' }))
      ).not.toThrow()
    })

    it('transport event with latTo/lngTo renders two markers', async () => {
      const events = [
        makeEvent({
          id: 'a',
          type: 'transport',
          lat: 35.0,
          lng: 139.0,
          latTo: 10.0,
          lngTo: 10.0,
        }),
      ]
      render(<MapView events={events} gaps={[]} onEdit={() => {}} />)
      await act(async () => {})

      expect(google.maps.Marker).toHaveBeenCalledTimes(2)
    })
```

Also add `fireEvent` to the import at line 1:

```ts
import { render, screen, act, fireEvent } from '@testing-library/react'
```

- [ ] **Step 2: Run MapView tests — verify 4 new tests fail, 4 existing pass**

```bash
pnpm exec vitest run src/components/MapView.test.tsx
```

Expected: 4 existing PASS + 4 new FAIL.

- [ ] **Step 3: Rewrite `src/components/MapView.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { buildMapSegments, GAP_COLOR, TYPE_COLORS } from '@/lib/buildMapSegments'
import { useTimelineGroups } from '@/lib/useTimelineGroups'
import TimelineDateHeader from '@/components/TimelineDateHeader'
import GapWarningCard from '@/components/GapWarningCard'
import { cn } from '@/lib/utils'
import type { TripEvent } from '@/types/trip'
import type { GapWarning } from '@/lib/gapDetection'

interface Props {
  events: TripEvent[]
  gaps: GapWarning[]
  onEdit: (event: TripEvent) => void
}

export default function MapView({ events, gaps, onEdit }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const onEditRef = useRef(onEdit)
  const [error, setError] = useState(false)
  const [activeEventId, setActiveEventId] = useState<string | null>(null)

  const sortedEvents = [...events].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  )
  const groups = useTimelineGroups(sortedEvents, gaps)

  const positionedEvents = events.filter(
    (e): e is TripEvent & { lat: number; lng: number } =>
      e.lat !== undefined && e.lng !== undefined
  )
  const missingCoordCount = events.length - positionedEvents.length

  useEffect(() => { onEditRef.current = onEdit }, [onEdit])

  useEffect(() => {
    if (!apiKey || !mapRef.current) return

    setOptions({ key: apiKey, v: 'weekly' })

    importLibrary('maps')
      .then(() => {
        if (!mapRef.current) return

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            zoom: 10,
            center: { lat: 0, lng: 0 },
          })
        }

        const map = mapInstanceRef.current

        markersRef.current.forEach(m => {
          google.maps.event.clearInstanceListeners(m)
          m.setMap(null)
        })
        polylinesRef.current.forEach(p => {
          google.maps.event.clearInstanceListeners(p)
          p.setMap(null)
        })
        markersRef.current = []
        polylinesRef.current = []

        const bounds = new google.maps.LatLngBounds()

        // Primary pass: one pin per positioned event (departure location)
        positionedEvents.forEach(event => {
          const marker = new google.maps.Marker({
            position: { lat: event.lat, lng: event.lng },
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: TYPE_COLORS[event.type],
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8,
            },
          })
          marker.addListener('click', () => onEditRef.current(event))
          markersRef.current.push(marker)
          bounds.extend({ lat: event.lat, lng: event.lng })
        })

        // Arrival pass: extra pin for transport events with explicit destination
        const transportWithDest = events.filter(
          (e): e is TripEvent & { latTo: number; lngTo: number } =>
            e.type === 'transport' && e.latTo !== undefined && e.lngTo !== undefined
        )
        transportWithDest.forEach(event => {
          const marker = new google.maps.Marker({
            position: { lat: event.latTo, lng: event.lngTo },
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: TYPE_COLORS['transport'],
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8,
            },
          })
          marker.addListener('click', () => onEditRef.current(event))
          markersRef.current.push(marker)
          bounds.extend({ lat: event.latTo, lng: event.lngTo })
        })

        const segments = buildMapSegments(events, gaps)
        segments.forEach(segment => {
          const polyline = segment.isGap
            ? new google.maps.Polyline({
                path: [segment.from, segment.to],
                strokeColor: GAP_COLOR,
                strokeWeight: 3,
                strokeOpacity: 0,
                icons: [{
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: GAP_COLOR,
                    fillOpacity: 1,
                    strokeColor: GAP_COLOR,
                    strokeOpacity: 1,
                    scale: 3,
                  },
                  offset: '0',
                  repeat: '8px',
                }],
                map,
              })
            : new google.maps.Polyline({
                path: [segment.from, segment.to],
                strokeColor: segment.color,
                strokeWeight: 3,
                strokeOpacity: 1,
                map,
              })
          polylinesRef.current.push(polyline)
        })

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds)
        }
      })
      .catch(() => {
        setError(true)
      })

    return () => {
      if (typeof google === 'undefined') return
      markersRef.current.forEach(m => {
        google.maps.event.clearInstanceListeners(m)
        m.setMap(null)
      })
      polylinesRef.current.forEach(p => {
        google.maps.event.clearInstanceListeners(p)
        p.setMap(null)
      })
    }
  }, [events, gaps])  // eslint-disable-line react-hooks/exhaustive-deps

  function handleSidebarClick(event: TripEvent) {
    setActiveEventId(event.id)
    if (mapInstanceRef.current && event.lat !== undefined && event.lng !== undefined) {
      mapInstanceRef.current.panTo({ lat: event.lat, lng: event.lng })
      mapInstanceRef.current.setZoom(14)
    }
  }

  if (!apiKey) {
    return (
      <div
        data-testid="map-unavailable"
        className="flex-1 min-h-0 flex items-center justify-center bg-input-bg text-center px-6"
      >
        <p className="text-sm text-muted">
          Map unavailable — add VITE_GOOGLE_MAPS_API_KEY to .env to enable.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        data-testid="map-error"
        className="flex-1 min-h-0 flex items-center justify-center bg-input-bg text-center px-6"
      >
        <p className="text-sm text-muted">Failed to load map</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-row">
      {/* Left sidebar */}
      <div className="w-[38%] flex flex-col border-r border-border overflow-hidden bg-background">
        <div className="overflow-y-auto flex-1 px-2 py-1">
          {groups.map(group => (
            <div key={group.date}>
              <TimelineDateHeader label={group.label} />
              {group.items.map(item =>
                item.kind === 'event' ? (
                  <div
                    key={item.event.id}
                    className={cn(
                      'rounded-md px-2 py-1.5 mb-1 cursor-pointer border-l-2 transition-colors',
                      activeEventId === item.event.id ? 'bg-input-bg' : 'bg-white'
                    )}
                    style={{ borderLeftColor: TYPE_COLORS[item.event.type] }}
                    onClick={() => handleSidebarClick(item.event)}
                    role="button"
                    aria-label={item.event.title}
                  >
                    <div className="text-xs font-semibold text-foreground truncate">{item.event.title}</div>
                    <div className="text-[10px] text-muted">{item.event.time}</div>
                  </div>
                ) : (
                  <GapWarningCard key={item.key} message={item.message} />
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        <div ref={mapRef} className="flex-1 min-h-0" />
        {missingCoordCount > 0 && (
          <div
            data-testid="map-no-location-banner"
            className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-2"
          >
            {missingCoordCount} event(s) not shown — no location data
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run MapView tests — verify all 8 pass**

```bash
pnpm exec vitest run src/components/MapView.test.tsx
```

Expected: `8 passed`.

- [ ] **Step 5: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Full build check**

```bash
pnpm build
```

Expected: Builds cleanly with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/MapView.tsx src/components/MapView.test.tsx
git commit -m "feat: add left sidebar and arrival pins to MapView"
```

---

## Summary

When all chunks are complete:

- `pnpm exec vitest run` — all tests pass across all test files
- `pnpm build` — TypeScript compiles cleanly
- Timeline view shows events grouped under date headers ("Sun, 15 Mar 2026")
- Map view has a left sidebar showing the grouped timeline; clicking an item pans the map
- Transport events capture From + To locations (both with lat/lng) and separate arrival time
- Transport events with explicit origin/destination show correct two-point segments on the map
- Editing a transport event pre-fills all five new fields correctly
