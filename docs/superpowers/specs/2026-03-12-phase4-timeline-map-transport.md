# Phase 4 — Timeline Date Grouping, Map Sidebar, Transport Origin/Destination

## Overview

Three interrelated enhancements to the trip timeline and map view:

1. **Timeline grouped by date** — events are rendered under date headers instead of a flat list
2. **Map sidebar** — the map view gains a left sidebar showing the timeline; clicking an item pans the map to that location
3. **Transport origin + destination** — transport events capture both a departure place (From) and an arrival place (To), each with lat/lng, plus a separate arrival time field

These three features are designed and implemented together because they share the same data model changes and rendering logic. The grouped-by-date timeline is used in both the standalone timeline view and the map sidebar.

---

## Feature 1: Timeline Grouped by Date

### Behaviour

- Events in `TripDetailPage` (timeline view) are sorted by `date + time` ascending and grouped under date headers.
- Date header format: `"Sat, 15 Mar 2026"` (short weekday, day, short month, 4-digit year).
- GAP warning cards remain inline immediately after the specific `afterEventId` event, within that event's date group. If Hotel A (day 3) is the `afterEventId` event, the gap card appears right after Hotel A's item in the day-3 group, before any subsequent day-3 events.
- If all events on a given date fall before gap warnings, the date header is still rendered.

### `useTimelineGroups` hook

A new pure hook extracted to `src/lib/useTimelineGroups.ts`:

```ts
export interface TimelineGroup {
  date: string   // YYYY-MM-DD — used as React key
  label: string  // "Sat, 15 Mar 2026"
  items: RenderItem[]
}

export type RenderItem =
  | { kind: 'event'; event: TripEvent }
  | { kind: 'gap'; message: string; key: string }
```

`useTimelineGroups(sortedEvents, gaps)` returns `TimelineGroup[]`. It:
1. Groups `sortedEvents` by `event.date`.
2. Within each group, inserts gap warnings immediately after the event whose `id` matches `gap.afterEventId` (preserving the current flat-list inline behaviour, now scoped to a group).
3. Returns groups in ascending date order.

This hook is consumed by both `TripDetailPage` (timeline view) and `MapView` (sidebar). Extracting it keeps both components free of duplicate sorting/grouping logic.

`TripDetailPage` currently defines `RenderItem` as a local type. This local definition is **removed** and replaced by the import from `useTimelineGroups`. The inline item-building logic in `TripDetailPage` is also removed and replaced by a call to `useTimelineGroups`.

### Date Header Component

`src/components/TimelineDateHeader.tsx` — renders a single date group header:

```tsx
<div className="pt-4 pb-1 first:pt-0">
  <span className="text-xs font-bold text-primary uppercase tracking-wide">
    {label}
  </span>
</div>
```

No interaction; purely presentational.

---

## Feature 2: Map View Left Sidebar

### Layout

`MapView` adopts a horizontal split layout when there are events to display:

```
┌─────────────────────────────────────────────────────┐
│  Timeline sidebar (38% fixed)  │  Google Map (flex-1) │
│  ─────────────────────────────  │                      │
│  📅 Sat, 15 Mar 2026           │                      │
│    ✈️ Flight GRU→NRT  08:00   │      🗺️             │
│  📅 Sun, 16 Mar 2026           │                      │
│    🏨 Hotel Tokyo   14:00      │                      │
│    🎭 TeamLab       18:00      │                      │
│  ⚠️ No transport between...   │                      │
│  📅 Thu, 20 Mar 2026           │                      │
│    🚅 Shinkansen    09:00      │                      │
└─────────────────────────────────────────────────────┘
```

The sidebar is always visible (not togglable) when the map view is active.

### Sidebar Timeline Items

Each event card in the sidebar is a compact presentation:
- Colored left border (matches `TYPE_COLORS[event.type]`)
- Event title (truncated)
- Time (HH:mm)
- Clicking calls `map.panTo({ lat, lng })` and sets zoom to 14
- The currently "active" item (most recently clicked) gets a highlighted background (`bg-input-bg`)

Transport events: clicking pans to the **origin** (`lat/lng`). If the event has no coordinates, clicking is a no-op (no crash).

GAP warning cards in the sidebar are non-clickable and appear between events as usual (same inline placement as the timeline view).

### Map Interaction

- On initial load, `MapView` fits bounds to all positioned event coordinates (same as current behaviour).
- Clicking a sidebar item overrides the fit-bounds and pans+zooms to that event's location.
- A subsequent re-render that changes the events list resets to fit-bounds.

### `missingCoordCount` banner

The banner `"N event(s) not shown — no location data"` counts **events** without `lat/lng` — not pins. A transport event that has `lat/lng` (departure) but no `latTo/lngTo` (arrival) counts as **positioned** (not missing) because it contributes a departure pin. The banner logic does not need to change.

Note: after Phase 4, the map may display more pins than `positionedEvents.length` (because transport events with `latTo/lngTo` add an arrival pin). The banner count will still read "N event(s) not shown" based on events missing a departure pin, which is the correct and meaningful number to surface.

### Props unchanged

`MapView` props remain:

```ts
interface MapViewProps {
  events: TripEvent[]
  gaps: GapWarning[]
  onEdit: (event: TripEvent) => void
}
```

In Phase 4, clicking sidebar items only pans the map; editing is only possible via the map pin popup (existing behaviour).

---

## Feature 3: Transport Origin + Destination

### Data Model

`TripEvent` in `src/types/trip.ts` gains five new optional fields:

```ts
// Transport-only: destination (arrival) location
placeTo?: string      // display name of destination
placeIdTo?: string    // Google Place ID of destination
latTo?: number        // WGS84 latitude of destination
lngTo?: number        // WGS84 longitude of destination

// Transport-only: arrival time
arrivalTime?: string  // HH:mm (24h); separate from `time` (departure)
```

`lat` and `lng` on a transport event continue to represent the **departure** location. `latTo`/`lngTo` represent the **arrival** location. All five new fields are optional so that existing events continue to work without migration.

Non-transport events (`accommodation`, `ticket`, `restaurant`) never use these fields.

### AddEventSheet — Transport Form

When `type === 'transport'`, the single place input is replaced with two GooglePlacesInputs:

```
[ From: 📍 Search departure place ]
        ↓
[ To:   📍 Search arrival place   ]

[ 🛫 Departure time ]  [ 🛬 Arrival time ]
[ 📅 Date           ]
```

The existing `place` / `placeId` / `lat` / `lng` fields map to the departure location. The new `placeTo` / `placeIdTo` / `latTo` / `lngTo` fields map to the arrival location. `arrivalTime` is a new optional field.

**Validation rules:**
- `place` (From) is required for transport.
- `placeTo` (To) is **optional** — no validation error if empty.
- `time` (departure time) is required.
- `arrivalTime` is optional.
- No changes to `FormErrors` type are needed for these rules (no new validation errors are added).

For all other event types, the form is unchanged (single place input).

**Edit-mode hydration:** The `useEffect` that hydrates form state from `editEvent` must also initialize `placeTo`, `placeIdTo`, `latTo`, `lngTo`, and `arrivalTime` when `editEvent` is a transport event. If omitted, editing an existing transport event would silently discard destination and arrival time data.

**Add-new reset:** The same `useEffect` branch that resets the form for a new event (`open && !editEvent`) must also reset `placeTo`, `placeIdTo`, `latTo`, `lngTo`, and `arrivalTime` to empty/undefined. This prevents stale state from a previously edited transport event appearing in a freshly opened add form.

### TimelineEvent — Place display for all types

Phase 4 adds a `place` row to `TimelineEvent` for all event types (currently only `TYPE_LABELS[event.type]` and value are shown).

**For non-transport events:** Show `📍 {event.place}` if `event.place` is non-empty.

**For transport events with `placeTo`:** Show `📍 {event.place} → {event.placeTo}`.

**For transport events without `placeTo`:** Show `📍 {event.place}` (same as non-transport).

**Departure + arrival time row (transport only):** When `event.arrivalTime` is set, show:
```
🛫 {event.time}  ·  🛬 {event.arrivalTime}
```
Otherwise show only `{event.time}` (current behaviour).

### buildMapSegments — Transport Expansion

**Gap detection is unchanged.** `detectGaps()` and the gap-checking logic in `buildMapSegments` operate only on the original `sortedEvents` array. The expansion described below is purely for segment and pin rendering.

**Expansion logic:** When building the chain of map points, a transport event with both `lat/lng` (origin) and `latTo/lngTo` (destination) expands into **two consecutive map points**:

1. Point A: `{ lat: event.lat, lng: event.lng, sourceEventId: event.id, isArrival: false, eventDate: event.date, eventTime: event.time, eventType: event.type }`
2. Point B: `{ lat: event.latTo, lng: event.lngTo, sourceEventId: event.id, isArrival: true, eventDate: event.date, eventTime: event.arrivalTime ?? event.time, eventType: event.type }`

The segment from A → B is always colored `TYPE_COLORS['transport']` (`#4A90D9`) and is never gap-colored (it is an explicit transport leg).

**Map point type used inside `buildMapSegments`:**

```ts
interface MapPoint {
  lat: number
  lng: number
  sourceEventId: string
  isArrival: boolean   // true only for the synthetic arrival point of a transport event
  eventType: EventType
  eventDate: string
  eventTime: string
}
```

**Gap detection per segment (between consecutive points I and J):**
- Skip gap detection if the **left** point (`I`) has `isArrival: true`. Rationale: the arrival point marks where the transport ended; the segment after it is already in "transported" territory and `detectGaps` will not have emitted a gap there because the transport event exists.
- Otherwise use the existing datetime-range check: does any `gap.afterEventId` event have datetime in `[I.eventDate I.eventTime, J.eventDate J.eventTime)`?

**Color rule per segment (between consecutive points I → J):**
- If `I.isArrival === false && J.isArrival === true && I.sourceEventId === J.sourceEventId`: this is the intra-transport leg (origin → arrival). Color it `TYPE_COLORS['transport']` and skip gap detection.
- Otherwise, if gap detection fires (see above): `GAP_COLOR`.
- Otherwise: `TYPE_COLORS[I.eventType]`.

Example chain for "Hotel A → Flight GRU→NRT → Hotel B" (no gap because transport exists):

```
Hotel A (lat/lng)       →[accommodation purple]→  Flight origin (lat/lng)
Flight origin            →[transport blue]→         Flight destination (latTo/lngTo)  [isArrival=true]
Flight destination       →[accommodation purple]→   Hotel B (lat/lng)
  [gap check skipped because left point isArrival=true]
```

### Map Pins — Rendering Responsibility

`MapView` is responsible for rendering all map pins. It does two passes:

1. **Primary pass:** All events with `lat !== undefined && lng !== undefined` → one pin each.
2. **Arrival pass:** Transport events with `latTo !== undefined && lngTo !== undefined` → one additional pin at `(latTo, lngTo)`.

Both passes use the same marker style (transport color, `#4A90D9`) in Phase 4. The `MapView.test.tsx` must include a test that a transport event with `latTo/lngTo` produces two markers.

---

## Testing

### `useTimelineGroups.test.ts` — unit tests

- Returns empty array for no events
- Single event in single group
- Multiple events on same date in one group
- Events on different dates produce separate groups in date order
- Gap warning appears immediately after the `afterEventId` event within its date group (not at end of group)
- Gap card lands in the date group of the `afterEventId` event
- Events given out of order are sorted within groups

### `MapView.test.tsx` — additional tests

- Sidebar renders event titles
- Clicking sidebar item calls `map.panTo` with event coordinates
- Clicking sidebar item with no coordinates does not throw
- GAP warning card appears in sidebar between correct events
- Transport event with `latTo/lngTo` renders two markers on the map

### `AddEventSheet.test.tsx` — transport-specific tests

- Transport type shows two place inputs (From and To)
- Transport type shows arrival time field
- Non-transport types show one place input (no To, no arrival time)
- `placeTo` being empty does not trigger a validation error
- Submitting valid transport form calls `addEvent` with all transport fields
- Opening edit sheet for existing transport event pre-fills `placeTo` and `arrivalTime`

### `buildMapSegments.test.ts` — transport expansion tests

- Transport event with `latTo/lngTo` produces two segments: origin→destination (blue) and destination→next-event
- Transport event without `latTo/lngTo` behaves as current single-point event
- Segment between two synthetic arrival points is never gap-colored
- Gap color still applied correctly between accommodations when transport event has no explicit destination

### `TripDetailPage.test.tsx` — date grouping tests

- Date headers appear for each distinct date
- Events are grouped under correct date header
- Correct DOM order: date header before its events
- GAP warning appears immediately after the `afterEventId` event within its date group

---

## Out of Scope for Phase 4

- Distinct marker icons for transport origin vs destination
- Sidebar toggle (hide/show)
- Map clustering for overlapping pins
- Multi-day transport events (overnight trains, etc.)
- Editing from the sidebar (clicking only pans; edit requires tapping the map pin)
