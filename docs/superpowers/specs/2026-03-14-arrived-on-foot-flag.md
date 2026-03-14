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

All four `Record<EventType, string>` objects must be updated in the same commit to avoid TypeScript errors:

| File | Object |
|------|--------|
| `src/lib/buildMapSegments.ts` | `TYPE_COLORS` |
| `src/components/TimelineEvent.tsx` | `TYPE_COLORS`, `TYPE_LABELS` |
| `src/components/sheets/AddEventSheet.tsx` | `TYPE_PLACEHOLDERS` |

Each must drop the `walking` key.

## Gap Detection

### `src/lib/gapDetection.ts`

Replace the time-window scan for a `walking`-type event with a direct flag check on the destination accommodation (`b`):

```ts
const hasWalkingRoute = b.arrivedOnFoot === true
```

Gap message unchanged: `No walking route between "${a.title}" check-in and "${b.title}" check-in`

### `src/lib/gapDetection.test.ts`

Update tests:
- Replace all `type: 'walking'` event fixtures with `type: 'accommodation', arrivedOnFoot: true` (on the destination stay)
- Rename test descriptions to reflect the new mechanism
- Add regression: transport event between two stays does NOT clear the gap
- Add regression: `arrivedOnFoot: true` on a non-accommodation event between two stays does NOT clear the gap
- Add boundary: `arrivedOnFoot: true` on Stay B clears gap regardless of time

## AddEventSheet UI

### `src/components/sheets/AddEventSheet.tsx`

- Remove `{ value: 'walking', label: 'On Foot' }` from `EVENT_TYPES` array (4 pills remain)
- Remove `walking` from `TYPE_PLACEHOLDERS`
- Add `arrivedOnFoot` boolean state, default `false`
- Hydrate from `editEvent.arrivedOnFoot ?? false` on edit open
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

- Remove "On Foot pill" test
- Add test: "Arrived on foot checkbox is unchecked by default"
- Add test: "checking Arrived on foot submits arrivedOnFoot: true"
- Add test: "editing event with arrivedOnFoot: true shows checkbox checked"

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

Populate when building map points:

```ts
mapPoints.push({
  ...
  arrivedOnFoot: event.arrivedOnFoot,
})
```

Change `isWalkingSegment` check:

```ts
// old
const isWalkingSegment = J.eventType === 'walking' && !J.isArrival

// new
const isWalkingSegment = J.arrivedOnFoot === true && !J.isArrival
```

Remove `walking` from `TYPE_COLORS`.

### `src/lib/buildMapSegments.test.ts`

- Remove "walking event produces isWalking: true segment" test (replace with new mechanism)
- Add test: event with `arrivedOnFoot: true` produces segment with `isWalking: true`
- Add test: event without flag produces segment with `isWalking: false`
- Update existing fixtures that use `type: 'walking'` to remove them

### `src/components/MapView.tsx`

No changes needed — `MapSegment.isWalking` field and dotted green polyline rendering are unchanged.

## Timeline display

### `src/components/TimelineEvent.tsx`

- Remove `walking` from `TYPE_COLORS` and `TYPE_LABELS`
- Optionally: show a small "on foot" indicator (e.g. 👟 or footprints icon) next to the event title when `event.arrivedOnFoot === true`. This is a nice-to-have; not required for the gap feature to work.

## Files changed

| File | Change |
|------|--------|
| `src/types/trip.ts` | Remove `'walking'` from `EventType`; add `arrivedOnFoot?: boolean` to `TripEvent` |
| `src/lib/gapDetection.ts` | Replace walking-event scan with `b.arrivedOnFoot === true` check |
| `src/lib/gapDetection.test.ts` | Update fixtures and test descriptions |
| `src/lib/buildMapSegments.ts` | Add `arrivedOnFoot` to `MapPoint`; update `isWalkingSegment` logic; remove `walking` from `TYPE_COLORS` |
| `src/lib/buildMapSegments.test.ts` | Update tests for new walking segment logic |
| `src/components/sheets/AddEventSheet.tsx` | Remove walking pill; add arrivedOnFoot checkbox |
| `src/components/sheets/AddEventSheet.test.tsx` | Update tests |
| `src/components/TimelineEvent.tsx` | Remove `walking` entries from `TYPE_COLORS` and `TYPE_LABELS` |
| `src/pages/TripDetailPage.test.tsx` | No change expected (gap message unchanged) |
| `src/components/MapView.tsx` | No change |
