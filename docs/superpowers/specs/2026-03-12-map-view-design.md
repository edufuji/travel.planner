# TripMate Phase 3 — Map View Design

**Date:** 2026-03-12
**Status:** Approved

---

## Goal

Add a Map view to `TripDetailPage` that visually plots timeline events on a Google Map, connecting them with category-colored track lines and highlighting transport gaps as dashed orange segments. A segmented control in the page header lets the user switch between the existing Timeline view and the new Map view.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Coordinate source | Google Places geometry, captured at save time | Zero API calls when viewing the map; no fetch latency |
| Map library | Google Maps via `@googlemaps/js-api-loader` | Already installed; consistent with Places integration |
| View toggle placement | Segmented control in page header | Keeps header DRY; shares add-event state across both views |
| Architecture | MapView component inside TripDetailPage | No route duplication; shared sheet state; fits existing patterns |

---

## Data Model Changes

### `src/types/trip.ts`

Add two optional fields to `TripEvent`:

```ts
lat?: number   // WGS84 latitude, from Google Places geometry.location.lat()
lng?: number   // WGS84 longitude, from Google Places geometry.location.lng()
```

Both are optional. Events created before this feature (no coordinates) and events entered as plain text (no API key, no placeId) are handled gracefully — they are silently skipped in map view with a count banner.

---

## Component Changes

### `src/components/GooglePlacesInput.tsx` — Modify

Add `'geometry'` to the `fields` array passed to `google.maps.places.Autocomplete`:

```ts
fields: ['name', 'place_id', 'geometry']
```

Update the `onChange` callback signature:

```ts
onChange: (place: string, placeId?: string, lat?: number, lng?: number) => void
```

When `place_changed` fires, extract:

```ts
const loc = place.geometry?.location
onChange(place.name ?? '', place.place_id, loc?.lat(), loc?.lng())
```

The fallback plain-text input (no API key) continues to call `onChange(value)` — `lat`/`lng` remain undefined.

---

### `src/components/sheets/AddEventSheet.tsx` — Modify

- Add `lat` and `lng` to local form state (reset to `undefined` on sheet open)
- Update the `GooglePlacesInput` `onChange` handler to capture lat/lng
- Pre-fill lat/lng from `editEvent.lat` / `editEvent.lng` when opening in edit mode
- Pass `lat` and `lng` through to `addEvent` / `updateEvent` payload

---

### `src/components/ViewToggle.tsx` — Create

A small, reusable segmented control:

```ts
interface Props {
  value: 'timeline' | 'map'
  onChange: (v: 'timeline' | 'map') => void
}
```

Full-width pill with two equal segments. Active segment: `bg-primary text-white`. Inactive: `bg-input-bg text-muted`. Icons: `≡` (list) for Timeline, `🗺` (or `lucide-react` `Map` icon) for Map.

---

### `src/lib/buildMapSegments.ts` — Create

A pure function that takes sorted events and gap warnings and returns drawable segments:

```ts
export interface MapSegment {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  color: string      // hex — matches TYPE_COLORS of the starting event
  isGap: boolean     // true → render as dashed orange polyline
}

export function buildMapSegments(
  sortedEvents: TripEvent[],
  gaps: GapWarning[]
): MapSegment[]
```

**Algorithm:**
1. Filter to events that have both `lat` and `lng`
2. For each consecutive pair `(a, b)` of positioned events, determine if a gap warning exists where `afterEventId` falls between a and b (i.e., the accommodation before the gap is between a and b chronologically)
3. Emit a `MapSegment` with `isGap: true` (orange dashed) if a gap spans this connection, otherwise `isGap: false` with the starting event's type color

Gap detection on the map uses the same `GapWarning[]` already computed by `detectGaps()` — no new gap logic.

---

### `src/components/MapView.tsx` — Create

Props:

```ts
interface Props {
  events: TripEvent[]     // sorted ascending by date+time
  gaps: GapWarning[]
  onEdit: (event: TripEvent) => void
}
```

**Behavior:**

- If `VITE_GOOGLE_MAPS_API_KEY` is not set: renders a placeholder `<div>` with message "Map unavailable — add VITE_GOOGLE_MAPS_API_KEY to .env to enable."
- On first render with API key: calls `setOptions` + `importLibrary('maps')` (reuses the existing loader pattern from `GooglePlacesInput`)
- Renders a `<div ref={mapRef}>` that fills available height (`height: calc(100vh - 200px)` approximately, accounting for header + bottom nav)
- Creates one `google.maps.Marker` per event with `lat`/`lng`, colored by event type
- Calls `buildMapSegments()` and renders one `google.maps.Polyline` per segment:
  - Normal: solid, 3px, type color
  - Gap: dashed (`strokeOpacity: 0`, icons with `strokeColor: '#C75B2A'` repeated), 3px
- Auto-fits map bounds to all markers using `google.maps.LatLngBounds` on mount and when events change
- Each marker has a click listener → calls `onEdit(event)`
- If any events lack coordinates: shows a small banner at the bottom edge of the map: "N event(s) not shown — no location data"

**Cleanup:** On unmount, calls `google.maps.event.clearInstanceListeners` on all markers and polylines.

---

### `src/pages/TripDetailPage.tsx` — Modify

- Add `view: 'timeline' | 'map'` state (default `'timeline'`)
- Add `<ViewToggle value={view} onChange={setView} />` below the existing header row (second row, full-width, `px-4 pb-3`)
- Render body conditionally:
  - `view === 'timeline'` → existing timeline JSX (unchanged)
  - `view === 'map'` → `<MapView events={sortedEvents} gaps={gaps} onEdit={openEditSheet} />`
- The `+` add-event button stays in the header row in both views

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/lib/buildMapSegments.ts` | Pure segment builder — testable without Maps |
| `src/lib/buildMapSegments.test.ts` | Unit tests for segment logic |
| `src/components/ViewToggle.tsx` | Segmented control (Timeline / Map) |
| `src/components/MapView.tsx` | Google Maps component with markers, polylines, gap visualization |
| `src/components/MapView.test.tsx` | Tests with mocked `google.maps` |

## Modified Files

| File | Change |
|------|--------|
| `src/types/trip.ts` | Add `lat?`, `lng?` to `TripEvent` |
| `src/components/GooglePlacesInput.tsx` | Capture geometry; update `onChange` signature |
| `src/components/sheets/AddEventSheet.tsx` | Pass lat/lng through to store |
| `src/pages/TripDetailPage.tsx` | Add view state + ViewToggle + MapView rendering |
| `src/pages/TripDetailPage.test.tsx` | Add view-switching tests |

---

## Testing Strategy

### Pure unit tests (no Maps mock needed)

**`src/lib/buildMapSegments.test.ts`:**
- No events → empty array
- One event with coords → empty array (no segments from a single point)
- Two events with coords, no gap → one normal segment with starting event's color
- Two events with coords, gap between them → one segment with `isGap: true`
- Events without coords skipped — segment only drawn between those that have coords
- Mixed: some with coords, some without → segments only between coord-having events

### Component tests (mocked `google.maps`)

`vitest.setup.ts` or per-file mock establishes a minimal `google.maps` mock:
- `google.maps.Map` constructor spy
- `google.maps.Marker` constructor spy with `addListener` mock
- `google.maps.Polyline` constructor spy
- `google.maps.LatLngBounds` with `extend` and `isEmpty` mocks

**`src/components/MapView.test.tsx`:**
- Creates one Marker per event with lat/lng
- Creates no Marker for events without lat/lng
- Shows "N event(s) not shown" banner when events lack coords
- Shows "Map unavailable" placeholder when no API key
- Creates a dashed Polyline for gap segments
- Calls `onEdit` when a marker is clicked

**`src/components/ViewToggle.test.tsx`** (or inline in TripDetailPage test):
- Clicking "Map" calls `onChange('map')`
- Clicking "Timeline" calls `onChange('timeline')`
- Active segment has aria-pressed="true"

**`src/pages/TripDetailPage.test.tsx` additions:**
- Default view is timeline (existing timeline content visible)
- Clicking "Map" in ViewToggle renders MapView (timeline hidden)
- Clicking "Timeline" in ViewToggle restores timeline

### GooglePlacesInput

Existing test updated: verify `onChange` is called with `(place, placeId, lat, lng)` when a place with geometry is selected.

---

## Graceful Degradation

| Scenario | Behavior |
|----------|---------|
| No API key | MapView shows placeholder message; Places input stays as plain text (existing behavior) |
| Event has placeId but no lat/lng (created before this feature) | Skipped on map; counted in "not shown" banner |
| Event entered as plain text (no placeId, no coords) | Skipped on map; counted in "not shown" banner |
| All events lack coords | Map renders empty with banner; no crash |
| Google Maps fails to load | `importLibrary` `.catch()` → MapView shows error state |
