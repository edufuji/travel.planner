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
| Marker API | `google.maps.Marker` (legacy) | Avoids `mapId` requirement of `AdvancedMarkerElement`; simpler mock in tests; acceptable for Phase 3 |
| Gap color | `#C75B2A` | Matches `GapWarningCard` and DestinationRow GAP badge — intentional consistency |

---

## Dependencies

`@types/google.maps` is already installed as a dev dependency (added in Phase 2). No new dependencies required.

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

**Cleanup:** Remove the debug `console.log('111111111111111111111', apiKey)` line from the `useEffect`.

Add `'geometry'` to the `fields` array passed to `google.maps.places.Autocomplete`:

```ts
fields: ['name', 'place_id', 'geometry']
```

Update the `onChange` prop type:

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

- Add `lat` and `lng` to local form state (both `number | undefined`, reset to `undefined` on sheet open)
- Update the `GooglePlacesInput` `onChange` handler to capture lat/lng: `(p, id, lat, lng) => { setPlace(p); setPlaceId(id); setLat(lat); setLng(lng) }`
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

Full-width pill with two equal segments. Active segment: `bg-primary text-white`. Inactive: `bg-input-bg text-muted`. Icons: `List` (lucide-react) for Timeline, `Map` (lucide-react) for Map. Each button has `aria-pressed` set to its active state.

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

1. Filter `sortedEvents` to only events that have both `lat` and `lng` defined → `positioned[]`
2. Build a lookup: `eventById = Map<string, TripEvent>` over all (unsorted) events
3. For each consecutive pair `(a, b)` in `positioned`:
   - Compute `aDateTime = a.date + ' ' + a.time` and `bDateTime = b.date + ' ' + b.time`
   - A gap warning `g` applies to this segment if the event referenced by `g.afterEventId` has a datetime in the range `[aDateTime, bDateTime)` — i.e., `eventById.get(g.afterEventId)` exists and its `date + ' ' + time >= aDateTime` AND `< bDateTime`
   - If any such gap exists → emit `{ from: {lat: a.lat, lng: a.lng}, to: {lat: b.lat, lng: b.lng}, color: '#C75B2A', isGap: true }`
   - Otherwise → emit `{ from: ..., to: ..., color: TYPE_COLORS[a.type], isGap: false }`
4. Return all segments

**TYPE_COLORS** (same as `TimelineEvent.tsx`):
```ts
const TYPE_COLORS: Record<EventType, string> = {
  transport: '#4A90D9',
  accommodation: '#7C3AED',
  ticket: '#059669',
  restaurant: '#F59E0B',
}
```

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

- If `VITE_GOOGLE_MAPS_API_KEY` is not set: renders a `<div data-testid="map-unavailable">` with message "Map unavailable — add VITE_GOOGLE_MAPS_API_KEY to .env to enable."
- On first render with API key: calls `setOptions({ key: apiKey, v: 'weekly' })` + `importLibrary('maps')` (same pattern as `GooglePlacesInput`)
- Renders a `<div ref={mapRef}>` with explicit height. Use a CSS flex approach: the `TripDetailPage` body area (`min-h-screen bg-background pb-20`) uses a flex column; the map div gets `flex: 1` and `min-height: 0`. This avoids hardcoded pixel math and adapts to all screen heights.
- Creates one `google.maps.Marker` per event with `lat`/`lng`, using `icon` with `fillColor` set to `TYPE_COLORS[event.type]` (SVG circle path)
- Calls `buildMapSegments(events, gaps)` and renders one `google.maps.Polyline` per segment:
  - Normal (`isGap: false`): `{ strokeColor: segment.color, strokeWeight: 3, strokeOpacity: 1 }`
  - Gap (`isGap: true`): dashed pattern using `icons` with `strokeColor: '#C75B2A'`, `strokeWeight: 3`, `strokeOpacity: 0` on the base, with a `SymbolPath.CIRCLE` icon repeated every 8px at full opacity
- Auto-fits map to all markers using `google.maps.LatLngBounds` on mount and when `events` prop changes (use `useEffect` with `events` dependency)
- Each marker has a click listener → calls `onEdit(event)`
- If any events lack coordinates: shows `<div data-testid="map-no-location-banner">N event(s) not shown — no location data</div>` as an overlay at the bottom edge of the map
- **Cleanup:** On unmount, calls `google.maps.event.clearInstanceListeners` on all markers and polylines, and stores them in refs

---

### `src/pages/TripDetailPage.tsx` — Modify

- Add `view: 'timeline' | 'map'` state (default `'timeline'`)
- Add `<ViewToggle value={view} onChange={setView} />` as a second row in the header section, below the existing title row: `<div className="px-4 pb-3"><ViewToggle ... /></div>`
- Render body conditionally:
  - `view === 'timeline'` → existing timeline JSX (unchanged)
  - `view === 'map'` → `<MapView events={sortedEvents} gaps={gaps} onEdit={openEditSheet} />`
- The `+` add-event button stays in the header row in both views
- When map view is active, remove `pb-20` from the root div (bottom nav still renders via `<BottomNav />`) so the map fills to the bottom nav naturally — or keep `pb-20` and let the map container account for it

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `src/lib/buildMapSegments.ts` | Pure segment builder — testable without Maps |
| `src/lib/buildMapSegments.test.ts` | Unit tests for segment logic |
| `src/components/ViewToggle.tsx` | Segmented control (Timeline / Map) |
| `src/components/ViewToggle.test.tsx` | Unit tests for ViewToggle |
| `src/components/MapView.tsx` | Google Maps component with markers, polylines, gap visualization |
| `src/components/MapView.test.tsx` | Tests with mocked `google.maps` |

### Modified Files

| File | Change |
|------|--------|
| `src/types/trip.ts` | Add `lat?`, `lng?` to `TripEvent` |
| `src/components/GooglePlacesInput.tsx` | Remove debug log; add geometry capture; update `onChange` signature |
| `src/components/sheets/AddEventSheet.tsx` | Pass lat/lng through to store |
| `src/pages/TripDetailPage.tsx` | Add view state + ViewToggle + MapView rendering |
| `src/pages/TripDetailPage.test.tsx` | Add view-switching tests |

---

## Testing Strategy

### Pure unit tests — `src/lib/buildMapSegments.test.ts`

No Maps mock needed. Test cases:
- No events → `[]`
- One positioned event → `[]` (no segments from a single point)
- Two positioned events, no gap → one segment, `isGap: false`, color = starting event's type color
- Two positioned events, gap between them → one segment, `isGap: true`, color = `#C75B2A`
- Two positioned events, events between them have no coords → gap still detected correctly
- Three positioned events: (A, B) no gap, (B, C) gap → two segments with correct `isGap` values
- Events without coords are excluded from segment endpoints but still checked for gap membership

### Component tests — `src/components/ViewToggle.test.tsx`

- Renders "Timeline" and "Map" buttons
- "Timeline" button has `aria-pressed="true"` when `value === 'timeline'`
- "Map" button has `aria-pressed="true"` when `value === 'map'`
- Clicking "Map" calls `onChange('map')`
- Clicking "Timeline" calls `onChange('timeline')`

### Component tests — `src/components/MapView.test.tsx`

Establish a minimal `google.maps` mock in this test file (or in a shared `src/test/googleMapsMock.ts`):

```ts
// Minimum mock shape needed:
vi.stubGlobal('google', {
  maps: {
    Map: vi.fn(() => ({ fitBounds: vi.fn(), setCenter: vi.fn() })),
    Marker: vi.fn(() => ({ addListener: vi.fn(), setMap: vi.fn() })),
    Polyline: vi.fn(() => ({ setMap: vi.fn() })),
    LatLngBounds: vi.fn(() => ({ extend: vi.fn(), isEmpty: vi.fn(() => false) })),
    SymbolPath: { CIRCLE: 0 },
    event: { clearInstanceListeners: vi.fn() },
  },
})
```

Tests:
- Shows `data-testid="map-unavailable"` when `VITE_GOOGLE_MAPS_API_KEY` is not set
- Creates one `Marker` per event with lat/lng (verify `Marker` constructor call count)
- Creates no `Marker` for events without lat/lng
- Shows `data-testid="map-no-location-banner"` when events lack coords
- Creates a `Polyline` for each segment (verify count matches `buildMapSegments` output)
- Calls `onEdit` when a marker's click listener fires

### `src/pages/TripDetailPage.test.tsx` additions

- Default view renders timeline content (existing tests still pass)
- Clicking "Map" in `ViewToggle` hides timeline, shows `MapView`
- Clicking "Timeline" in `ViewToggle` restores timeline

### `src/components/GooglePlacesInput` test update

- Existing test updated: `onChange` mock verifies it is called with `(place, placeId, lat, lng)` when a place with geometry is selected (mock `place.geometry.location.lat()` / `.lng()` in the test)

---

## Graceful Degradation

| Scenario | Behavior |
|----------|---------|
| No API key | MapView shows `data-testid="map-unavailable"` placeholder; Places input stays as plain text |
| Event has placeId but no lat/lng (created before this feature) | Skipped on map; counted in "not shown" banner |
| Event entered as plain text (no placeId, no coords) | Skipped on map; counted in "not shown" banner |
| All events lack coords | Map renders (empty) with banner; no crash |
| Google Maps `importLibrary` rejects | `.catch()` handler → MapView shows error state `data-testid="map-error"` with message "Failed to load map" |
