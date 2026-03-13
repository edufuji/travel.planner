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

### AddEventSheet

A 5th pill "On Foot" appears in the type selector row alongside Transport, Stay, Ticket, Food.

Fields shown for `walking` events:
- **Title** (required) — placeholder: "e.g. Walk to hotel"
- **Place** (required) — single location via GooglePlacesInput (where they walked to/from)
- **Date** (required)
- **Time** (required)
- **Cost** (optional)
- **Notes** (optional)

No `placeTo`/`latTo`/`lngTo` fields (walking events have a single location, not origin+destination).

### Gap Detection Integration

A `walking` event between two accommodations clears the gap between them (same time-window logic as before: `toDateTime(e.date, e.time) > aDateTime && toDateTime(e.date, e.time) < bDateTime`).

### Map Rendering

Walking events with coordinates render as a green dotted polyline from the previous positioned event's location to the walking event's location. Style:
- `strokeColor: '#22C55E'` (green-500)
- `strokeOpacity: 0`
- Dotted icon repeat pattern (same technique as existing gap polylines, scale 3, repeat 8px)
- No separate arrival pin

### Visual Styling

`TYPE_COLORS` entry for `walking`: `'#22C55E'` (green).

`buildMapSegments.ts` must handle `walking` type segments.

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

Change message copy from `"No transport between..."` to `"No transport or walking route between..."` to reflect the new semantics.

### Test Updates

All existing gap detection tests that rely on `type: 'transport'` clearing gaps must be updated. New tests added for `type: 'walking'` clearing gaps.

---

## Feature 3: Timeline Spacing

In `TripDetailPage.tsx`, increase the spacing between timeline items from `space-y-3` to `space-y-5` in the `<div>` that wraps the rendered items.

---

## Feature 4: Map Sidebar Polish

Replace the current plain `<button>` list items in the `MapView.tsx` left sidebar with bordered cards that show richer event information.

### Card Layout

Each event item becomes:

```
┌─────────────────────────────────────────┐
│ [colored dot] Title              [icon] │
│               HH:mm              $000   │
└─────────────────────────────────────────┘
```

- **Left dot**: 8×8 circle with `TYPE_COLORS[event.type]` fill (already used for map markers)
- **Title**: `text-sm font-semibold text-foreground`
- **Time**: `text-xs text-muted` below title
- **Right icon**: Lucide icon matching event type (see table below)
- **Cost**: `text-xs text-muted` with `$` prefix, shown only if `event.value` is set

### Type Icons (Lucide)

| EventType     | Lucide icon    |
|---------------|----------------|
| transport     | `Plane`        |
| accommodation | `BedDouble`    |
| ticket        | `Ticket`       |
| restaurant    | `Utensils`     |
| walking       | `Footprints`   |

### Card Styling

```tsx
<button className="mx-2 my-1 w-[calc(100%-16px)] text-left border border-border rounded-lg px-3 py-2 hover:bg-input-bg transition-colors flex items-center gap-2">
```

Clicking still calls `handleSidebarClick(item.event)` (pan + zoom to event on map).

### Gap Items in Sidebar

`GapWarningCard` items in the sidebar keep their existing styling but get `mx-2 my-1` margin to match card spacing.

---

## Feature 5: Google Maps Dark Theme

### Detection

On each map initialization, read `document.documentElement.classList.contains('dark')`.

### Styles

When dark mode is active, pass a `styles` array to `new google.maps.Map(...)`:

```ts
const darkStyles: google.maps.MapTypeStyle[] = [
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

When light mode, pass `styles: []` (default Google styles).

### Re-application

The map re-initializes on `[events, gaps]` change (existing behavior). Dark mode is read fresh each time, so toggling dark mode and then navigating away and back will pick up the new theme. No separate dark-mode observer needed for Phase 2.

---

## Affected Files

| File | Change |
|------|--------|
| `src/types/trip.ts` | Add `'walking'` to `EventType` |
| `src/lib/gapDetection.ts` | Fix gap-clear condition: `walking` only, update message |
| `src/lib/gapDetection.test.ts` | Update transport tests, add walking tests |
| `src/lib/buildMapSegments.ts` | Handle `walking` type segments (green dotted polyline) |
| `src/components/sheets/AddEventSheet.tsx` | 5th "On Foot" pill, conditional fields |
| `src/components/sheets/AddEventSheet.test.tsx` | Tests for On Foot pill and fields |
| `src/components/TimelineEvent.tsx` | Add `walking` to `TYPE_COLORS` and `TYPE_LABELS` |
| `src/pages/TripDetailPage.tsx` | `space-y-3` → `space-y-5` |
| `src/components/MapView.tsx` | Sidebar card layout, dark mode styles |

---

## Out of Scope

- Walking directions API (polyline is straight-line only, same as transport)
- Dark mode observer (auto-reapply map theme without page navigation)
- Transport events affecting gap detection in any way
- Backend or auth changes
