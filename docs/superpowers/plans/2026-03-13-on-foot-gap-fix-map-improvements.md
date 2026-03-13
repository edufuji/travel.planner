# On Foot Event Type, Gap Detection Fix & Map Improvements — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "On Foot" walking event type, fix gap detection to only clear gaps via walking events, improve timeline spacing, polish the map sidebar, and add Google Maps dark theme support.

**Architecture:** The `walking` EventType is added to the type union first, triggering TypeScript to enforce updates in all four `Record<EventType, string>` maps atomically. Gap detection is then fixed (walking-only logic). Map segments gain an `isWalking` flag. UI changes (sidebar cards, dark map, spacing) are layered on top.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, Vitest + @testing-library/react, Google Maps JS API via `@googlemaps/js-api-loader`, Lucide React

**Spec:** `docs/superpowers/specs/2026-03-13-on-foot-gap-fix-map-improvements.md`

---

## Chunk 1: Type System + Gap Detection

### File Map

| File | Action | Change |
|------|--------|--------|
| `src/types/trip.ts` | Modify | Add `'walking'` to `EventType` |
| `src/lib/buildMapSegments.ts` | Modify | Add `walking` to `TYPE_COLORS`, add `isWalking` to `MapSegment` |
| `src/components/TimelineEvent.tsx` | Modify | Add `walking` to `TYPE_COLORS` and `TYPE_LABELS` |
| `src/components/sheets/AddEventSheet.tsx` | Modify | Add `walking` to `TYPE_PLACEHOLDERS`, add to `EVENT_TYPES` |
| `src/lib/gapDetection.ts` | Modify | Fix gap-clearing: only `walking` events clear gaps, update message |
| `src/lib/gapDetection.test.ts` | Modify | Update transport tests → walking, add regression test |

---

### Task 1: Add `walking` EventType and update all Record maps atomically

Four files have `Record<EventType, string>` or `EventType`-keyed records. Adding `'walking'` to `EventType` causes TypeScript errors in all four simultaneously. All edits must be made and saved before running `pnpm build`.

**Files:**
- Modify: `src/types/trip.ts`
- Modify: `src/lib/buildMapSegments.ts`
- Modify: `src/components/TimelineEvent.tsx`
- Modify: `src/components/sheets/AddEventSheet.tsx`

- [ ] **Step 1: Update `src/types/trip.ts`** — add `'walking'` to the union

```ts
export type EventType = 'transport' | 'accommodation' | 'ticket' | 'restaurant' | 'walking'
```

- [ ] **Step 2: Update `src/lib/buildMapSegments.ts`** — add `walking` to `TYPE_COLORS` and `isWalking` to `MapSegment`

Replace the existing `MapSegment` interface:
```ts
export interface MapSegment {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  color: string    // hex — matches TYPE_COLORS of the starting event (or transport blue for legs)
  isGap: boolean   // true → render as dashed orange polyline
  isWalking: boolean  // true → render as dotted green polyline
}
```

Add `walking` to `TYPE_COLORS`:
```ts
export const TYPE_COLORS: Record<EventType, string> = {
  transport: '#4A90D9',
  accommodation: '#7C3AED',
  ticket: '#059669',
  restaurant: '#F59E0B',
  walking: '#22C55E',
}
```

Update every `segments.push(...)` call (there is one, at the bottom of the for loop) to include `isWalking: false` as a default. Do not change any logic yet — that is Task 3:
```ts
segments.push({
  from: { lat: I.lat, lng: I.lng },
  to: { lat: J.lat, lng: J.lng },
  color,
  isGap,
  isWalking: false,
})
```

- [ ] **Step 3: Update `src/components/TimelineEvent.tsx`** — add `walking` to both records

```ts
const TYPE_COLORS: Record<EventType, string> = {
  transport: '#4A90D9',
  accommodation: '#7C3AED',
  ticket: '#059669',
  restaurant: '#F59E0B',
  walking: '#22C55E',
}

const TYPE_LABELS: Record<EventType, string> = {
  transport: 'Transport',
  accommodation: 'Accommodation',
  ticket: 'Ticket',
  restaurant: 'Restaurant',
  walking: 'On Foot',
}
```

- [ ] **Step 4: Update `src/components/sheets/AddEventSheet.tsx`** — add to `EVENT_TYPES` array and `TYPE_PLACEHOLDERS`

Append to `EVENT_TYPES`:
```ts
const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'transport', label: 'Transport' },
  { value: 'accommodation', label: 'Stay' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'restaurant', label: 'Food' },
  { value: 'walking', label: 'On Foot' },
]
```

Add `walking` to `TYPE_PLACEHOLDERS`:
```ts
const TYPE_PLACEHOLDERS: Record<EventType, string> = {
  transport: 'e.g. Flight GRU → NRT',
  accommodation: 'Hotel name',
  ticket: 'Museum or experience',
  restaurant: 'Restaurant name',
  walking: 'e.g. Walk to hotel',
}
```

No other changes to AddEventSheet — the existing `type !== 'transport'` branch already renders a single place input and hides `placeTo`/`arrivalTime` fields for `walking`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: Build succeeds with no errors. The "On Foot" pill now appears in the Add Event sheet.

- [ ] **Step 6: Run all existing tests — verify nothing broken**

```bash
pnpm exec vitest run
```

Expected: All existing tests pass. (The `AddEventSheet` pill test `renders type selector pills: Transport, Stay, Ticket, Food` still passes because it checks only for the 4 existing pills — the On Foot pill is additive.)

- [ ] **Step 7: Commit**

```bash
git add src/types/trip.ts src/lib/buildMapSegments.ts src/components/TimelineEvent.tsx src/components/sheets/AddEventSheet.tsx
git commit -m "feat: add 'walking' EventType — update all Record<EventType> maps and AddEventSheet pill"
```

---

### Task 2: Fix gap detection (TDD)

**Files:**
- Modify: `src/lib/gapDetection.ts`
- Modify: `src/lib/gapDetection.test.ts`

- [ ] **Step 1: Update failing tests in `src/lib/gapDetection.test.ts`**

These three tests currently pass `type: 'transport'` to clear gaps. After the fix, transport no longer clears gaps, so they will produce wrong results. Change them first so they fail, confirming the fix is needed.

Replace test at line 29 (`returns no gaps when two accommodations have transport between them`):
```ts
it('returns no gaps when two accommodations have a walking event between them', () => {
  const events = [
    makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
    makeEvent({ id: 'walk-1', type: 'walking', title: 'Walk to hotel', date: '2026-03-18', time: '09:00' }),
    makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
  ]
  expect(detectGaps(events)).toEqual([])
})
```

Replace test at line 60 (`does not count transport at exactly the same time as first accommodation as "between"`):
```ts
it('does not count walking event at exactly the same time as first accommodation as "between"', () => {
  // Walking event at A's exact timestamp is NOT strictly greater → still a gap
  const events = [
    makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
    makeEvent({ id: 'walk-1', type: 'walking', title: 'Morning walk', date: '2026-03-15', time: '14:00' }),
    makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
  ]
  expect(detectGaps(events)).toHaveLength(1)
})
```

Replace test at line 79 (`works correctly when events are given out of order`):
```ts
it('works correctly when events are given out of order', () => {
  const events = [
    makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    makeEvent({ id: 'walk-1', type: 'walking', title: 'Walk to hotel', date: '2026-03-18', time: '09:00' }),
    makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
  ]
  expect(detectGaps(events)).toEqual([])
})
```

Add new regression test at the end of the `describe` block:
```ts
it('transport event between two accommodations does NOT clear the gap', () => {
  const events = [
    makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
    makeEvent({ id: 'tr-1', type: 'transport', title: 'Train', date: '2026-03-18', time: '09:00' }),
    makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
  ]
  expect(detectGaps(events)).toHaveLength(1)
})
```

- [ ] **Step 2: Run tests — verify the updated tests fail**

```bash
pnpm exec vitest run src/lib/gapDetection.test.ts
```

Expected: 4 tests fail — the 3 updated walking tests fail because the implementation still checks for `transport`, and the new regression test fails because transport still (incorrectly) clears the gap.

- [ ] **Step 3: Fix `src/lib/gapDetection.ts`** — replace transport check with walking

Replace the `hasTransport` variable and the gap push with:
```ts
const hasResolution = sorted.some(
  e =>
    e.type === 'walking' &&
    toDateTime(e.date, e.time) > aDateTime &&
    toDateTime(e.date, e.time) < bDateTime
)

if (!hasResolution) {
  gaps.push({
    afterEventId: a.id,
    beforeEventId: b.id,
    message: `No transport or walking route between "${a.title}" check-in and "${b.title}" check-in`,
  })
}
```

The full updated function body in `src/lib/gapDetection.ts`:
```ts
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

    const hasResolution = sorted.some(
      e =>
        e.type === 'walking' &&
        toDateTime(e.date, e.time) > aDateTime &&
        toDateTime(e.date, e.time) < bDateTime
    )

    if (!hasResolution) {
      gaps.push({
        afterEventId: a.id,
        beforeEventId: b.id,
        message: `No transport or walking route between "${a.title}" check-in and "${b.title}" check-in`,
      })
    }
  }

  return gaps
}
```

- [ ] **Step 4: Run gap detection tests — verify all 8 pass**

```bash
pnpm exec vitest run src/lib/gapDetection.test.ts
```

Expected: `8 passed` (7 original tests, 3 of which were updated + 1 new regression test = 8 total).

- [ ] **Step 5: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/gapDetection.ts src/lib/gapDetection.test.ts
git commit -m "fix: gap detection now only clears via walking events, not any transport"
```

---

## Chunk 2: Map Segments + AddEventSheet Tests

### File Map

| File | Action | Change |
|------|--------|--------|
| `src/lib/buildMapSegments.ts` | Modify | Add `isWalkingSegment` branch to segment logic |
| `src/lib/buildMapSegments.test.ts` | Modify | Add walking segment tests |
| `src/components/sheets/AddEventSheet.test.tsx` | Modify | Update pill test, add On Foot test |

---

### Task 3: Walking segment logic in buildMapSegments (TDD)

**Files:**
- Modify: `src/lib/buildMapSegments.ts`
- Modify: `src/lib/buildMapSegments.test.ts`

- [ ] **Step 1: Write failing tests — add to `src/lib/buildMapSegments.test.ts`**

Append inside the `describe('buildMapSegments', ...)` block:

```ts
it('walking event produces isWalking: true segment from previous point to walking point', () => {
  const events = [
    makeEvent({ id: 'acc-1', type: 'accommodation', lat: 10.0, lng: 20.0, date: '2026-03-15', time: '14:00' }),
    makeEvent({ id: 'walk-1', type: 'walking', lat: 11.0, lng: 21.0, date: '2026-03-18', time: '09:00' }),
  ]
  const segments = buildMapSegments(events, [])
  expect(segments).toHaveLength(1)
  expect(segments[0].isWalking).toBe(true)
  expect(segments[0].color).toBe('#22C55E')
  expect(segments[0].isGap).toBe(false)
})

it('segment from walking event to next event is solid green, not isWalking', () => {
  const events = [
    makeEvent({ id: 'acc-1', type: 'accommodation', lat: 10.0, lng: 20.0, date: '2026-03-15', time: '14:00' }),
    makeEvent({ id: 'walk-1', type: 'walking', lat: 11.0, lng: 21.0, date: '2026-03-18', time: '09:00' }),
    makeEvent({ id: 'acc-2', type: 'accommodation', lat: 12.0, lng: 22.0, date: '2026-03-18', time: '15:00' }),
  ]
  const segments = buildMapSegments(events, [])
  expect(segments).toHaveLength(2)
  expect(segments[0].isWalking).toBe(true)   // acc→walk: dotted green
  expect(segments[1].isWalking).toBe(false)  // walk→acc: solid green (I.eventType = 'walking')
  expect(segments[1].color).toBe('#22C55E')  // still green from walking event's color
  expect(segments[1].isGap).toBe(false)
})
```

- [ ] **Step 2: Run tests — verify the two new tests fail**

```bash
pnpm exec vitest run src/lib/buildMapSegments.test.ts
```

Expected: 2 new tests fail (the walking segment has `isWalking: false` because the logic hasn't been updated yet). All existing tests still pass.

- [ ] **Step 3: Update segment logic in `src/lib/buildMapSegments.ts`**

In the for loop, add the `isWalkingSegment` check. Insert it as a new branch between `isTransportLeg` and `I.isArrival`. Here is the full updated loop body:

```ts
for (let i = 0; i < mapPoints.length - 1; i++) {
  const I = mapPoints[i]
  const J = mapPoints[i + 1]

  // Intra-transport leg: left point is origin, right point is arrival of same event
  const isTransportLeg =
    !I.isArrival && J.isArrival && I.sourceEventId === J.sourceEventId

  // Segment arriving at a walking event: render as green dotted polyline
  const isWalkingSegment = J.eventType === 'walking' && !J.isArrival

  let color: string
  let isGap = false
  let isWalking = false

  if (isTransportLeg) {
    // Origin → arrival of same transport event: always transport blue, never a gap
    color = TYPE_COLORS['transport']
  } else if (isWalkingSegment) {
    // Segment ending at a walking event: green dotted polyline
    color = TYPE_COLORS['walking']
    isWalking = true
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
    isWalking,
  })
}
```

- [ ] **Step 4: Run buildMapSegments tests — verify all pass**

```bash
pnpm exec vitest run src/lib/buildMapSegments.test.ts
```

Expected: All tests pass (existing 10 + 2 new = 12 passed).

- [ ] **Step 5: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/buildMapSegments.ts src/lib/buildMapSegments.test.ts
git commit -m "feat: add isWalking segment type to buildMapSegments with green dotted rendering"
```

---

### Task 4: Update AddEventSheet tests

**Files:**
- Modify: `src/components/sheets/AddEventSheet.test.tsx`

No implementation changes are needed — the "On Foot" pill was added in Task 1 and the `type !== 'transport'` branch already handles walking correctly. This task only updates the test file.

- [ ] **Step 1: Update pill test at line 43 — rename and add On Foot assertion**

Replace:
```ts
it('renders type selector pills: Transport, Stay, Ticket, Food', () => {
  renderSheet()
  expect(screen.getByText('Transport')).toBeInTheDocument()
  expect(screen.getByText('Stay')).toBeInTheDocument()
  expect(screen.getByText('Ticket')).toBeInTheDocument()
  expect(screen.getByText('Food')).toBeInTheDocument()
})
```

With:
```ts
it('renders type selector pills: Transport, Stay, Ticket, Food, On Foot', () => {
  renderSheet()
  expect(screen.getByText('Transport')).toBeInTheDocument()
  expect(screen.getByText('Stay')).toBeInTheDocument()
  expect(screen.getByText('Ticket')).toBeInTheDocument()
  expect(screen.getByText('Food')).toBeInTheDocument()
  expect(screen.getByText('On Foot')).toBeInTheDocument()
})
```

- [ ] **Step 2: Add On Foot test — append inside the `describe` block before the closing `}`**

```ts
it('On Foot type shows single place input and no destination fields', () => {
  renderSheet()
  fireEvent.click(screen.getByText('On Foot'))
  // Single place input (not two like transport)
  expect(screen.getByTestId('places-input-fallback')).toBeInTheDocument()
  // No "To: arrival place" input
  expect(screen.queryByPlaceholderText(/To: arrival/)).not.toBeInTheDocument()
  // No arrival time field
  expect(screen.queryByLabelText('Arrival time')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Run AddEventSheet tests — verify all pass**

```bash
pnpm exec vitest run src/components/sheets/AddEventSheet.test.tsx
```

Expected: All 16 tests pass (15 existing + 1 new On Foot test). The renamed pill test also passes.

- [ ] **Step 4: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/sheets/AddEventSheet.test.tsx
git commit -m "test: update AddEventSheet tests for On Foot pill"
```

---

## Chunk 3: UI Polish

### File Map

| File | Action | Change |
|------|--------|--------|
| `src/pages/TripDetailPage.tsx` | Modify | `space-y-3` → `space-y-5` |
| `src/components/MapView.tsx` | Modify | Walking polyline branch, sidebar cards, dark theme |

---

### Task 5: Timeline spacing

**Files:**
- Modify: `src/pages/TripDetailPage.tsx`

- [ ] **Step 1: Change `space-y-3` to `space-y-5`**

In `src/pages/TripDetailPage.tsx`, find the per-group items wrapper inside `groups.map(group => ...)`. There is exactly one `space-y-3` in this file (the `<div className="space-y-3">` inside the loop, NOT the parent `<div className="pl-5">`).

Change:
```tsx
<div className="space-y-3">
```
to:
```tsx
<div className="space-y-5">
```

- [ ] **Step 2: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass (this is a CSS-only change).

- [ ] **Step 3: Commit**

```bash
git add src/pages/TripDetailPage.tsx
git commit -m "style: increase timeline event card spacing from space-y-3 to space-y-5"
```

---

### Task 6: Map sidebar cards + walking polyline in MapView

**Files:**
- Modify: `src/components/MapView.tsx`

- [ ] **Step 1: Update imports in `src/components/MapView.tsx`**

Current import line:
```ts
import type { TripEvent } from '@/types/trip'
```

Replace with:
```ts
import type { TripEvent, EventType } from '@/types/trip'
```

Add Lucide imports (add after the existing imports near the top of the file):
```ts
import { Plane, BedDouble, Ticket, Utensils, Footprints } from 'lucide-react'
```

- [ ] **Step 2: Add `TYPE_ICONS` and `DARK_MAP_STYLES` constants at module level (outside the component function)**

Add these constants after the existing imports, before `interface Props`:

```ts
const TYPE_ICONS: Record<EventType, React.ComponentType<{ size?: number; className?: string }>> = {
  transport: Plane,
  accommodation: BedDouble,
  ticket: Ticket,
  restaurant: Utensils,
  walking: Footprints,
}

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

Note: `DARK_MAP_STYLES` references `google.maps.MapTypeStyle` which is a global type from `@types/google.maps`. It must be declared at module level (not inside the component) to avoid TypeScript errors about the `google` global not being available at parse time. If TypeScript complains, wrap the type as just `object[]` — the runtime value is what matters.

- [ ] **Step 3: Update the walking polyline branch in the `useEffect`**

In the `segments.forEach` block inside the `importLibrary('maps').then(...)` callback, the current code is:

```ts
const polyline = segment.isGap
  ? new google.maps.Polyline({ /* gap */ })
  : new google.maps.Polyline({ /* solid */ })
```

Replace with a three-way conditional:

```ts
const polyline = segment.isWalking
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
```

- [ ] **Step 4: Update the sidebar JSX — replace plain buttons with bordered cards**

In the JSX return, locate the sidebar's `group.items.map(item => ...)` block. Replace the entire inner mapping:

Current:
```tsx
{group.items.map(item => {
  if (item.kind === 'gap') {
    return (
      <GapWarningCard key={item.key} message={item.message} />
    )
  }
  return (
    <button
      key={item.event.id}
      aria-label={item.event.title}
      onClick={() => handleSidebarClick(item.event)}
      className="w-full text-left px-3 py-2 text-sm hover:bg-input-bg transition-colors truncate"
    >
      {item.event.title}
    </button>
  )
})}
```

Replace with:
```tsx
{group.items.map(item => {
  if (item.kind === 'gap') {
    return (
      <div key={item.key} className="mx-2 my-1">
        <GapWarningCard message={item.message} />
      </div>
    )
  }
  const Icon = TYPE_ICONS[item.event.type]
  return (
    <button
      key={item.event.id}
      aria-label={item.event.title}
      onClick={() => handleSidebarClick(item.event)}
      className="mx-2 my-1 w-[calc(100%-16px)] text-left border border-border rounded-lg px-3 py-2 hover:bg-input-bg transition-colors flex items-center gap-2"
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: TYPE_COLORS[item.event.type] }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">{item.event.title}</div>
        <div className="text-xs text-muted">{item.event.time}</div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <Icon size={14} className="text-muted" />
        {item.event.value != null && (
          <span className="text-xs text-muted">${item.event.value}</span>
        )}
      </div>
    </button>
  )
})}
```

- [ ] **Step 5: Add dark mode styles to the map — update the `useEffect`**

Inside the `importLibrary('maps').then(...)` callback, immediately after the `setOptions({ key: apiKey, v: 'weekly' })` call and before the `if (!mapInstanceRef.current)` block, add:

```ts
const isDark = document.documentElement.classList.contains('dark')
```

Then update the `new google.maps.Map(...)` constructor call to include styles:
```ts
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

Place `map.setOptions(...)` immediately after `const map = mapInstanceRef.current` (before the marker/polyline cleanup loop).

- [ ] **Step 6: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: Build succeeds. If TypeScript complains about `google.maps.MapTypeStyle` at module level, change the type annotation to just `const DARK_MAP_STYLES = [...]` (remove the type annotation — TypeScript will infer it correctly at runtime).

- [ ] **Step 7: Run all tests**

```bash
pnpm exec vitest run
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/MapView.tsx
git commit -m "feat: walking polyline, sidebar event cards with icons, and dark map theme"
```

---

## Summary

When all tasks are complete:

- `pnpm exec vitest run` → all tests pass
- `pnpm build` → TypeScript compiles cleanly
- Behavior changes:
  1. "On Foot" pill appears in Add Event sheet; walking events show single place input, no destination fields
  2. Gap warnings only clear when a walking event is added between two accommodations; transport events no longer affect gap detection
  3. Timeline event cards have more breathing room (`space-y-5`)
  4. Map sidebar shows bordered cards with type-colored dot, time, type icon, and optional cost
  5. Google Maps renders in dark palette when dark mode is active
