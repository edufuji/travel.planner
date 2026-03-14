# Spec: "Arrived on Foot" flag replaces walking EventType

**Date:** 2026-03-14
**Status:** Approved

## Summary

Replace the `'walking'` event type with an `arrivedOnFoot?: boolean` flag on `TripEvent`. The flag can be set on any event type and signals that the user arrived at that event's location on foot (no transport needed). Gap detection uses the flag on the destination accommodation to decide whether a gap exists between two stays.

## Motivation

"On Foot" is not a standalone event — it is metadata about how the user arrived at an existing event. Modelling it as a separate event type creates confusion (it appears as a pill alongside Transport, Stay, Ticket, Food) and requires a separate event entry rather than annotating the destination directly.

## Data Model

### `src/types/trip.ts`

Remove `'walking'` from `EventType`:

```ts
export type EventType = 'transport' | 'accommodation' | 'ticket' | 'restaurant'
```

Add optional field to `TripEvent`:

```ts
arrivedOnFoot?: boolean  // true = user arrived at this event's location on foot
```

### Atomicity requirement

All `Record<EventType, ...>` objects must be updated in the same commit to avoid TypeScript errors:

| File | Object |
|------|--------|
| `src/lib/buildMapSegments.ts` | `TYPE_COLORS` |
| `src/components/TimelineEvent.tsx` | `TYPE_COLORS`, `TYPE_LABELS` |
| `src/components/sheets/AddEventSheet.tsx` | `TYPE_PLACEHOLDERS` |
| `src/components/MapView.tsx` | `TYPE_ICONS` (also remove `Footprints` import from lucide-react) |

Each must drop the `walking` key.

## Gap Detection

### `src/lib/gapDetection.ts`

Replace the time-window scan for a `walking`-type event with a direct flag check on the destination accommodation (`b`):

```ts
const hasWalkingRoute = b.arrivedOnFoot === true
```

The `sorted.some(...)` time-window scanning call and the `aDateTime`/`bDateTime` variables can be removed. The `sorted` array itself must remain — it is used to derive the ordered `accommodations` list.

Gap message unchanged: `No walking route between "${a.title}" check-in and "${b.title}" check-in`

### `src/lib/gapDetection.test.ts`

Replace all `type: 'walking'` event fixtures:
- Walking event fixtures are removed entirely
- The destination accommodation (Stay B / `acc-2`) gets `arrivedOnFoot: true` instead
- Example migration: a test that previously added a `{ type: 'walking', ... }` event to clear a gap must instead set `arrivedOnFoot: true` on the `acc-2` accommodation fixture and remove the walking event from the events array

Time-window boundary tests (currently testing strict `>` / `<` window logic) must be replaced with equivalent tests for the new mechanism. Since the flag is on Stay B itself (no time window), the two replacement tests are:
- "gap is cleared when Stay B has `arrivedOnFoot: true`"
- "gap is NOT cleared when only a non-accommodation event has `arrivedOnFoot: true`" (regression for flag-on-wrong-event)

Additional tests:
- Add regression: transport event between two stays does NOT clear the gap
- Update out-of-order test: remove walking event fixture, set `arrivedOnFoot: true` on `acc-2`; the test still verifies unsorted input is handled correctly (sort by date/time is still done for the accommodation pair ordering)

## AddEventSheet UI

### `src/components/sheets/AddEventSheet.tsx`

- Remove `{ value: 'walking', label: 'On Foot' }` from `EVENT_TYPES` array (4 pills remain)
- Remove `walking` from `TYPE_PLACEHOLDERS`
- Add `arrivedOnFoot` boolean state, default `false`
- In the `useEffect` open handler:
  - Edit branch: `setArrivedOnFoot(editEvent.arrivedOnFoot ?? false)`
  - New-event branch: `setArrivedOnFoot(false)` (prevents stale state from a previous edit session)
- Render an "Arrived on foot" checkbox row below the place field, visible for all event types:
  ```tsx
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
- Include in submitted data: `arrivedOnFoot: arrivedOnFoot || undefined` (omit when false)

### `src/components/sheets/AddEventSheet.test.tsx`

Remove both tests that depend on the `walking` pill:
- The test that asserts "On Foot" appears in the type selector pill list
- The test that clicks "On Foot" and checks form behaviour (single place field)

Add new tests:
- "Arrived on foot checkbox is unchecked by default"
- "checking Arrived on foot submits arrivedOnFoot: true"
- "editing event with arrivedOnFoot: true shows checkbox checked"

## Map Rendering

### `src/lib/buildMapSegments.ts`

Add `arrivedOnFoot?: boolean` to `MapPoint` interface:

```ts
interface MapPoint {
  lat: number
  lng: number
  sourceEventId: string
  isArrival: boolean
  eventType: EventType
  eventDate: string
  eventTime: string
  arrivedOnFoot?: boolean   // NEW
}
```

Populate only in the departure-point push (not in the synthetic arrival-point push):

```ts
mapPoints.push({
  lat: event.lat,
  lng: event.lng,
  sourceEventId: event.id,
  isArrival: false,
  eventType: event.type,
  eventDate: event.date,
  eventTime: event.time,
  arrivedOnFoot: event.arrivedOnFoot,  // NEW
})
```

Change `isWalkingSegment` check:

```ts
// old
const isWalkingSegment = J.eventType === 'walking' && !J.isArrival

// new
const isWalkingSegment = J.arrivedOnFoot === true && !J.isArrival
```

Remove `walking` from `TYPE_COLORS`. The walking polyline colour is now referenced via a named constant to avoid the deleted key:

```ts
const WALKING_COLOR = '#22C55E'

export const TYPE_COLORS: Record<EventType, string> = {
  transport: '#4A90D9',
  accommodation: '#7C3AED',
  ticket: '#059669',
  restaurant: '#F59E0B',
}
```

In the `isWalkingSegment` branch replace `TYPE_COLORS['walking']` with `WALKING_COLOR`:

```ts
} else if (isWalkingSegment) {
  color = WALKING_COLOR
  isWalking = true
}
```

### `src/lib/buildMapSegments.test.ts`

- Remove tests that use `type: 'walking'` event fixtures or assert `isWalking: true` via the old walking EventType
- Add test: accommodation event with `arrivedOnFoot: true` produces segment with `isWalking: true`
- Add test: accommodation event without `arrivedOnFoot` flag produces segment with `isWalking: false`

### `src/components/MapView.tsx`

Remove `walking: Footprints` from `TYPE_ICONS` and remove the `Footprints` import from `lucide-react`. `MapSegment.isWalking` field and dotted green polyline rendering code are otherwise unchanged.

## Timeline display

### `src/components/TimelineEvent.tsx`

- Remove `walking` from `TYPE_COLORS` and `TYPE_LABELS`

## Files changed

| File | Change |
|------|--------|
| `src/types/trip.ts` | Remove `'walking'` from `EventType`; add `arrivedOnFoot?: boolean` to `TripEvent` |
| `src/lib/gapDetection.ts` | Replace walking-event scan with `b.arrivedOnFoot === true` check; remove time-window scan |
| `src/lib/gapDetection.test.ts` | Replace walking fixtures with arrivedOnFoot flag on Stay B; replace boundary tests |
| `src/lib/buildMapSegments.ts` | Add `arrivedOnFoot` to `MapPoint`; update `isWalkingSegment` logic; introduce `WALKING_COLOR` constant; remove `walking` from `TYPE_COLORS` |
| `src/lib/buildMapSegments.test.ts` | Update tests for new walking segment logic |
| `src/components/sheets/AddEventSheet.tsx` | Remove walking pill; add arrivedOnFoot checkbox; reset in both useEffect branches |
| `src/components/sheets/AddEventSheet.test.tsx` | Remove two walking-pill tests; add three arrivedOnFoot tests |
| `src/components/TimelineEvent.tsx` | Remove `walking` entries from `TYPE_COLORS` and `TYPE_LABELS` |
| `src/components/MapView.tsx` | Remove `walking: Footprints` from `TYPE_ICONS`; remove `Footprints` import |
| `src/pages/TripDetailPage.test.tsx` | Update `type: 'walking'` fixture → `arrivedOnFoot: true` on destination accommodation |
| `src/pages/TripsPage.test.tsx` | Update `type: 'walking'` fixture → `arrivedOnFoot: true` on destination accommodation |
