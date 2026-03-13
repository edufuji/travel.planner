# On Foot Event Type, Gap Detection Fix & Map Improvements — Spec

## Overview

Five coordinated improvements to TripMate:

1. **"On Foot" event type** — new explicit walking event that replaces implicit transport-clears-gap logic
2. **Gap detection fix** — remove incorrect auto-clear behavior; only walking events clear gaps
3. **Timeline spacing** — more breathing room between event cards
4. **Map sidebar polish** — bordered cards with type icons, time, and cost
5. **Google Maps dark theme** — styled map matches app dark mode

---

## Feature 1: "On Foot" Event Type

### Type Definition

Add `'walking'` to `EventType` in `src/types/trip.ts`:

```ts
export type EventType = 'transport' | 'accommodation' | 'ticket' | 'restaurant' | 'walking'
```

**Important — atomicity:** Four records in the codebase are typed as `Record<EventType, string>`. TypeScript will error the moment `'walking'` is added to `EventType` if any of these records are not simultaneously updated. All four edits must be made in the same save pass:

| Record | File | New entry |
|--------|------|-----------|
| `TYPE_COLORS` | `src/lib/buildMapSegments.ts` | `walking: '#22C55E'` |
| `TYPE_COLORS` | `src/components/TimelineEvent.tsx` | `walking: '#22C55E'` |
| `TYPE_LABELS` | `src/components/TimelineEvent.tsx` | `walking: 'On Foot'` |
| `TYPE_PLACEHOLDERS` | `src/components/sheets/AddEventSheet.tsx` | `walking: 'e.g. Walk to hotel'` |

### AddEventSheet

A 5th pill "On Foot" appears in the type selector row alongside Transport, Stay, Ticket, Food.

Update `EVENT_TYPES` array to include:
```ts
{ value: 'walking', label: 'On Foot' }
```

Fields shown for `walking` events:
- **Title** (required) — placeholder from `TYPE_PLACEHOLDERS`: "e.g. Walk to hotel"
- **Place** (required) — single location via GooglePlacesInput, using the existing `📍 Search place` placeholder (same as accommodation/ticket/restaurant)
- **Date** (required)
- **Time** (required)
- **Cost** (optional)
- **Notes** (optional)

No `placeTo`/`latTo`/`lngTo`/`arrivalTime` fields — walking events have a single location, not origin+destination. The existing `type !== 'transport'` condition in `AddEventSheet.tsx` that hides those fields already covers `walking` without additional changes.

**Test updates in `AddEventSheet.test.tsx`:**
- Rename `renders type selector pills: Transport, Stay, Ticket, Food` to `renders type selector pills: Transport, Stay, Ticket, Food, On Foot` and add `expect(screen.getByText('On Foot')).toBeInTheDocument()`.
- Add test: `On Foot type shows single place input and no destination fields` — click On Foot pill, assert only one `places-input-fallback` is present (`screen.getByTestId('places-input-fallback')`) and no destination input (`expect(screen.queryByPlaceholderText(/To: arrival/)).not.toBeInTheDocument()`).

### Gap Detection Integration

A `walking` event between two accommodations clears the gap between them (time-window logic: `toDateTime(e.date, e.time) > aDateTime && toDateTime(e.date, e.time) < bDateTime`).

### Map Rendering — Segment Shape

`buildMapSegments.ts` exports a `MapSegment` interface. Walking segments need to be distinguishable from both normal transport segments and gap segments. Add an `isWalking` boolean field to `MapSegment`:

```ts
export interface MapSegment {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  color: string
  isGap: boolean
  isWalking: boolean
}
```

All existing segments get `isWalking: false`. Normal segments: `isGap: false, isWalking: false`. Gap segments: `isGap: true, isWalking: false`.

**Existing tests in `buildMapSegments.test.ts`:** The current tests access segment properties individually (`.isGap`, `.color`, `.from`, `.to`) — none use full `toEqual` on a segment object. No existing test needs modification for the new `isWalking` field.

### Walking Segment Logic in buildMapSegments

A `walking` event produces a single `MapPoint` (one location, no synthetic arrival). The segment FROM the previous map point TO a walking event's point is the "on foot journey" and should be rendered as a green dotted polyline.

**Rule: `isWalking = true` when the destination point J has `eventType === 'walking'`.**

Update the segment color/flag logic in `buildMapSegments.ts`:

```ts
const isWalkingSegment = J.eventType === 'walking' && !J.isArrival

let color: string
let isGap = false
let isWalking = false

if (isTransportLeg) {
  color = TYPE_COLORS['transport']
} else if (isWalkingSegment) {
  color = TYPE_COLORS['walking']
  isWalking = true
} else if (I.isArrival) {
  color = TYPE_COLORS[I.eventType]
} else if (eventById !== null) {
  // existing gap detection branch...
  if (hasGap) {
    color = GAP_COLOR
    isGap = true
  } else {
    color = TYPE_COLORS[I.eventType]
  }
} else {
  color = TYPE_COLORS[I.eventType]
}

segments.push({ from: ..., to: ..., color, isGap, isWalking })
```

The segment FROM a walking event TO the next event uses `I.eventType === 'walking'`, giving it solid green color — this is correct (the gap detection branch also handles it if a gap exists between them).

**New tests to add in `buildMapSegments.test.ts`:**
- `walking event produces isWalking: true segment from previous point to walking point` — two events (accommodation + walking), expect 1 segment with `isWalking: true`, `color: '#22C55E'`, `isGap: false`.
- `segment from walking event to next event is solid green, not isWalking` — three events (accommodation + walking + accommodation), expect 2 segments: first `isWalking: true`, second `isWalking: false`.

### Map Rendering — Walking Polyline in MapView

In `MapView.tsx`, the polyline rendering block gains a third branch for `isWalking` (checked before `isGap`):

```ts
segment.isWalking
  ? new google.maps.Polyline({
      path: [segment.from, segment.to],
      strokeColor: TYPE_COLORS['walking'],
      strokeWeight: 3,
      strokeOpacity: 0,
      icons: [{
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: TYPE_COLORS['walking'],
          fillOpacity: 1,
          strokeColor: TYPE_COLORS['walking'],
          strokeOpacity: 1,
          scale: 3,
        },
        offset: '0',
        repeat: '8px',
      }],
      map,
    })
  : segment.isGap
  ? /* existing gap polyline — unchanged */
  : /* existing solid polyline — unchanged */
```

Note: `MapView.tsx` already imports `TYPE_COLORS` from `@/lib/buildMapSegments`. Use that import rather than hardcoding `'#22C55E'`.

No separate arrival pin for walking events.

---

## Feature 2: Gap Detection Fix

### Current Bug

`detectGaps` clears a gap whenever ANY `e.type === 'transport'` event falls between two accommodations — regardless of whether it connects them. This is incorrect: a flight from Tokyo to Osaka does not mean you have transport from Hotel A in Kyoto to Hotel B in Nara.

### Fix

Remove `e.type === 'transport'` from the gap-clearing condition entirely. Replace with `e.type === 'walking'`:

```ts
const hasResolution = sorted.some(
  e =>
    e.type === 'walking' &&
    toDateTime(e.date, e.time) > aDateTime &&
    toDateTime(e.date, e.time) < bDateTime
)

if (!hasResolution) {
  gaps.push({ ... })
}
```

`transport` events have no effect on gap detection. Only an explicit `walking` event between two accommodations resolves the gap.

### Gap Warning Message

Change message copy from:
```
`No transport between "${a.title}" check-in and "${b.title}" check-in`
```
to:
```
`No transport or walking route between "${a.title}" check-in and "${b.title}" check-in`
```

### Test Updates in gapDetection.test.ts

The following existing tests currently pass `type: 'transport'` events and expect 0 gaps — under the fix those transports no longer clear gaps, so they must be updated:

1. **`returns no gaps when two accommodations have transport between them`** — Change the event's `type` from `'transport'` to `'walking'`. Rename the test to `returns no gaps when two accommodations have a walking event between them`. This becomes the explicit positive case for walking gap resolution.

2. **`works correctly when events are given out of order`** — Change the event's `type` from `'transport'` to `'walking'`. Test logic (out-of-order input → sorted correctly → no gap) remains valid.

3. **`does not count transport at exactly the same time as first accommodation as "between"`** — Change `type: 'transport'` to `type: 'walking'`. **Keep the walking event's time at `14:00`** (same time as `acc-1` at `14:00`) — this is intentional: the boundary test verifies that `>` (strictly greater than) excludes events at the exact same timestamp. Rename to `does not count walking event at exactly the same time as first accommodation as "between"`.

Add new tests:
- `transport event between two accommodations does NOT clear the gap` — regression test: two accommodations + transport between them → expect 1 gap.

The existing test `ignores ticket and restaurant events when detecting gaps` remains valid as-is and does not need modification.

---

## Feature 3: Timeline Spacing

In `TripDetailPage.tsx`, increase `space-y-3` to `space-y-5` on the per-group items wrapper — `<div className="space-y-3">` inside `groups.map(group => ...)`. This is the only `space-y-3` in the file. (The nearby `pl-5` is on the parent `<div>`, not the same element.)

---

## Feature 4: Map Sidebar Polish

Replace the current plain `<button>` list items in the `MapView.tsx` left sidebar with bordered cards that show richer event information.

### Card Layout

Each event item becomes:

```
┌─────────────────────────────────────────┐
│ [dot] Title                      [icon] │
│       HH:mm                       $000  │
└─────────────────────────────────────────┘
```

- **Left dot**: `w-2 h-2 rounded-full shrink-0` with inline `style={{ backgroundColor: TYPE_COLORS[event.type] }}`
- **Middle column** (flex-1): title on top (`text-sm font-semibold text-foreground truncate`), time below (`text-xs text-muted`)
- **Right column** (`flex flex-col items-end shrink-0`): Lucide icon at `size={14}` with `className="text-muted"`, cost below (`text-xs text-muted`) with `$` prefix, shown only if `event.value` is set

### Type Icons (Lucide)

| EventType     | Lucide import  |
|---------------|----------------|
| transport     | `Plane`        |
| accommodation | `BedDouble`    |
| ticket        | `Ticket`       |
| restaurant    | `Utensils`     |
| walking       | `Footprints`   |

`MapView.tsx` currently imports only `TripEvent` from `@/types/trip`. Update the import to also include `EventType` (required for the `Record<EventType, ...>` type annotation):

```ts
import type { TripEvent, EventType } from '@/types/trip'
```

Define a `TYPE_ICONS` record in `MapView.tsx`:

```ts
import { Plane, BedDouble, Ticket, Utensils, Footprints } from 'lucide-react'

const TYPE_ICONS: Record<EventType, React.ComponentType<{ size?: number; className?: string }>> = {
  transport: Plane,
  accommodation: BedDouble,
  ticket: Ticket,
  restaurant: Utensils,
  walking: Footprints,
}
```

### Card Styling

Replace the existing `<button>` with:

```tsx
<button
  key={item.event.id}
  aria-label={item.event.title}
  onClick={() => handleSidebarClick(item.event)}
  className="mx-2 my-1 w-[calc(100%-16px)] text-left border border-border rounded-lg px-3 py-2 hover:bg-input-bg transition-colors flex items-center gap-2"
>
  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[item.event.type] }} />
  <div className="flex-1 min-w-0">
    <div className="text-sm font-semibold text-foreground truncate">{item.event.title}</div>
    <div className="text-xs text-muted">{item.event.time}</div>
  </div>
  <div className="flex flex-col items-end shrink-0">
    {(() => { const Icon = TYPE_ICONS[item.event.type]; return <Icon size={14} className="text-muted" /> })()}
    {item.event.value != null && (
      <span className="text-xs text-muted">${item.event.value}</span>
    )}
  </div>
</button>
```

### Gap Items in Sidebar

`GapWarningCard` items in the sidebar must be wrapped in a `<div className="mx-2 my-1">` to align with card spacing. Move the `key` prop to the outer `<div>`:

```tsx
<div key={item.key} className="mx-2 my-1">
  <GapWarningCard message={item.message} />
</div>
```

---

## Feature 5: Google Maps Dark Theme

### The Correct Approach

The map instance is created once (guarded by `if (!mapInstanceRef.current)`). Dark styles cannot be passed only to the constructor, because subsequent `useEffect` runs reuse the existing instance. The correct approach:

1. Pass styles at map creation time
2. Also call `map.setOptions({ styles: ... })` on every `useEffect` run, immediately after the `const map = mapInstanceRef.current` line

```ts
const isDark = document.documentElement.classList.contains('dark')

if (!mapInstanceRef.current) {
  mapInstanceRef.current = new google.maps.Map(mapRef.current, {
    zoom: 10,
    center: { lat: 0, lng: 0 },
    styles: isDark ? DARK_MAP_STYLES : [],
  })
}

const map = mapInstanceRef.current
map.setOptions({ styles: isDark ? DARK_MAP_STYLES : [] })
```

### Dark Style Constant

Define at module level (outside the component) to avoid recreation on every render:

```ts
const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
]
```

### Re-application Behavior

Toggling dark mode updates the map on the next `useEffect` trigger (when events/gaps change or the component remounts). No real-time dark-mode observer is needed for Phase 2.

---

## Affected Files

| File | Change |
|------|--------|
| `src/types/trip.ts` | Add `'walking'` to `EventType` |
| `src/lib/gapDetection.ts` | Fix gap-clear condition: `walking` only, update message |
| `src/lib/gapDetection.test.ts` | Convert transport tests to walking, add regression test |
| `src/lib/buildMapSegments.ts` | Add `isWalking` to `MapSegment`, add `walking` to `TYPE_COLORS`, handle walking segments |
| `src/lib/buildMapSegments.test.ts` | Add walking segment tests |
| `src/components/sheets/AddEventSheet.tsx` | 5th "On Foot" pill, add `walking` to `TYPE_PLACEHOLDERS` |
| `src/components/sheets/AddEventSheet.test.tsx` | Rename + update pill test, add On Foot test |
| `src/components/TimelineEvent.tsx` | Add `walking` to `TYPE_COLORS` and `TYPE_LABELS` |
| `src/pages/TripDetailPage.tsx` | `space-y-3` → `space-y-5` |
| `src/components/MapView.tsx` | Sidebar card layout + `TYPE_ICONS`, walking polyline branch, dark mode via `map.setOptions` |

---

## Out of Scope

- Walking directions API (polyline is straight-line, not routed)
- Dark mode observer (real-time map theme without events/gaps change)
- Transport events affecting gap detection in any way
- Backend or auth changes
