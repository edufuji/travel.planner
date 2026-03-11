# TripMate Phase 2 — Core Timeline Design Spec

**Date:** 2026-03-11
**Phase:** 2 — Core Timeline (UI-only, localStorage persistence)
**Builds on:** Phase 1 (login screen, design system, app shell)

---

## Goal

Add the core trip-planning feature: users can create **Destinations** (trip containers), add **Timeline Events** to each one (flights, hotels, tickets, restaurants), and see inline **GAP warnings** when transport is missing between accommodation changes. Data persists in localStorage via Zustand. No backend required.

---

## Scope

**In scope:**
- Destinations CRUD (create, view list, delete)
- Timeline events CRUD (create, edit, delete)
- GAP detection logic and inline warnings
- Google Maps Places Autocomplete for the location field
- Navigation shell (2-tab bottom nav: Trips + Profile)
- Profile page stub

**Out of scope (future phases):**
- Real authentication / user accounts
- Backend / cloud persistence (Phase 3: Supabase/Firebase)
- Sharing timelines (Phase 4)
- Push notifications / following the plan (Phase 5)
- Account tiers enforcement (Phase 4)

---

## Architecture

### State Management

**Library:** `zustand` with `persist` middleware (writes to `localStorage`).

**Storage key:** `tripmate-trips`

```ts
// src/types/trip.ts

export type EventType = 'transport' | 'accommodation' | 'ticket' | 'restaurant'

// UI label → EventType mapping (used in AddEventSheet type selector pills):
//   "Transport" → 'transport'
//   "Stay"      → 'accommodation'
//   "Ticket"    → 'ticket'
//   "Food"      → 'restaurant'

export interface TripEvent {
  id: string            // uuid v4
  destinationId: string
  type: EventType
  title: string
  place: string         // display name from Google Places
  placeId?: string      // Google Place ID (optional, for future map use)
  date: string          // ISO date: YYYY-MM-DD
  time: string          // HH:mm (24h)
  value?: number        // optional cost (no currency yet — Phase 3)
  notes?: string        // optional free text
  createdAt: string     // ISO timestamp
}

export interface Destination {
  id: string            // uuid v4
  title: string
  emoji: string         // auto-assigned from travel emoji set
  startDate: string     // ISO date: YYYY-MM-DD
  endDate: string       // ISO date: YYYY-MM-DD
  events: TripEvent[]
  createdAt: string     // ISO timestamp
}
```

**Store shape** (`src/stores/tripsStore.ts`):
```ts
interface TripsState {
  destinations: Destination[]
  addDestination: (d: Omit<Destination, 'id' | 'events' | 'createdAt'>) => void
  // Note: updateDestination intentionally omits 'events' — events are managed
  // via addEvent / updateEvent / deleteEvent only.
  updateDestination: (id: string, patch: Partial<Omit<Destination, 'id' | 'events'>>) => void
  deleteDestination: (id: string) => void
  addEvent: (destinationId: string, e: Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>) => void
  updateEvent: (destinationId: string, eventId: string, patch: Partial<Omit<TripEvent, 'id' | 'destinationId'>>) => void
  deleteEvent: (destinationId: string, eventId: string) => void
}
```

### GAP Detection

Runs as a pure function — `detectGaps(events: TripEvent[]): GapWarning[]`

**Algorithm:**

> **Note:** `TripEvent` has no separate checkout date/time. The event's `date+time` represents the check-in of an accommodation. Gap detection works on check-in timestamps only — it asks "is there any transport registered between these two check-ins?"

1. Sort all events ascending by `date` + `time` (lexicographic on `YYYY-MM-DD HH:mm` is sufficient).
2. Extract only `accommodation` events from the sorted list.
3. For each consecutive pair of accommodation events `(A, B)`:
   - Find any `transport` event whose `date+time` is strictly greater than A's `date+time` and strictly less than B's `date+time`.
   - If no such transport event exists → produce a `GapWarning` with `afterEventId = A.id`, `beforeEventId = B.id`.
4. Return all produced `GapWarning[]`.

```ts
// src/lib/gapDetection.ts
// Note: GapWarning is defined here (not in src/types/trip.ts) because it is
// a result type of the detection function and not a stored data type.
export interface GapWarning {
  afterEventId: string   // the accommodation event before the gap
  beforeEventId: string  // the accommodation event after the gap
  message: string        // human-readable description
}

export function detectGaps(events: TripEvent[]): GapWarning[]
```

This function is pure (no side effects) and fully unit-tested.

### Google Maps Integration

**Library:** `@googlemaps/js-api-loader`

**API key:** Stored in `.env` as `VITE_GOOGLE_MAPS_API_KEY`.

**Setup:**
1. User creates a Google Cloud project, enables **Places API (New)**, and creates an API key.
2. Adds `VITE_GOOGLE_MAPS_API_KEY=<key>` to `.env` in the project root.
3. `.env` is already in `.gitignore`.

**Component:** `src/components/GooglePlacesInput.tsx` — a controlled input that loads the Maps JS SDK on mount and attaches the `Autocomplete` widget. Emits `{ place: string, placeId: string }` on selection.

If `VITE_GOOGLE_MAPS_API_KEY` is not set, the component falls back to a plain text input (so the app is usable without a key).

### Auto-Emoji Assignment

`src/lib/travelEmojis.ts` — a small pool of travel emojis (`✈️ 🏖️ 🗺️ 🏔️ 🌴 🗽 🏯 🌍 🎒 🚢`). On destination creation, an emoji is picked from the pool based on `(destinations.length % pool.length)` — deterministic, avoids repeats for first 10 trips.

---

## Routing

Updated `src/App.tsx`:

| Route | Component | Notes |
|-------|-----------|-------|
| `/` | `<Navigate to="/trips" replace />` | Redirect (replace prevents broken back-button loop) |
| `/login` | `LoginPage` | Phase 1 (unchanged) |
| `/trips` | `TripsPage` | Destinations list |
| `/trips/:id` | `TripDetailPage` | Timeline for one destination |
| `/profile` | `ProfilePage` | Stub — just shows "Profile coming soon" |

---

## Screens

### 1. `/trips` — Destinations List (TripsPage)

**Layout:** White background, minimal 2-tab bottom nav fixed at bottom.

**Header:**
- Left: "My Trips" (H1) + "{N} destinations" subtitle
- Right: "**+ New**" pill button (primary orange, opens New Destination sheet)

**Destination rows** (compact list):
- Emoji icon (24px) | Title (bold) + date range (small muted) | Gap/OK badge (right)
- Gap badge: orange `⚠️ GAP` if `detectGaps(destination.events).length > 0`
- OK badge: green `✓ OK` if events exist and no gaps
- No badge: if destination has 0 events
- Long press or swipe-right → shows delete option. Confirmation uses `window.confirm("Delete this destination and all its events?")` — no custom dialog component needed.
- Tap row → navigate to `/trips/:id`

**Empty state:** If no destinations, show a centered illustration placeholder + "Plan your first trip" CTA that opens the New Destination sheet.

---

### 2. `/trips/:id` — Timeline (TripDetailPage)

**Header:**
- Back arrow + "Trips" label → navigates back to `/trips`
- Destination emoji + title (bold) + date range + event count (muted)
- `+` circle button (primary orange) → opens Add Event sheet

**Timeline:**
- Vertical line (2px, `--border` color) runs the full height
- Each event: colored dot on the line + white card to the right
  - Dot colors: Transport `#4A90D9` | Accommodation `#7C3AED` | Ticket `#059669` | Restaurant `#F59E0B`
  - Card: date+time (small muted top), title (bold), type + optional value (small muted bottom)
  - Tap card → opens Edit Event sheet (pre-filled with existing data)
- GAP warning cards: orange dashed border card inserted between the two accommodation events causing the gap. Shows "⚠️ No transport between [hotel A] checkout and [hotel B] check-in"
- Events sorted ascending by date+time
- Empty state: "No events yet. Tap + to add your first." centered in timeline area.

---

### 3. New Destination Sheet (bottom sheet)

Slides up from bottom. Drag handle at top. Tap outside or drag down to dismiss.

**Fields:**
- Auto-assigned emoji displayed large (center, read-only) with "Auto-assigned icon" caption
- **Title** — text input (required). Placeholder: "e.g. Japan 2026"
- **Start Date** — date picker (required)
- **End Date** — date picker (required, must be ≥ start date)

**Validation:**
- Title required
- End date must be ≥ start date

**Primary CTA:** "Create Destination" button (full width, primary orange). On submit: add to store → close sheet → new destination appears at top of list.

---

### 4. Add / Edit Event Sheet (bottom sheet)

Slides up. Same dismiss behavior.

**Type selector:** 4 pills at top — Transport / Stay / Ticket / Food. Selected pill is orange, others are `input-bg`. Tapping changes the type. Default: Transport.

**Fields (all types):**
| Field | Required | Notes |
|-------|----------|-------|
| Title | Yes | Placeholder varies by type (e.g. "Flight GRU → NRT", "Hotel name", "Museum or experience", "Restaurant name") |
| Place | Yes | `GooglePlacesInput` — autocomplete from Google Maps. Falls back to plain text if no API key. |
| Date | Yes | Date picker |
| Time | Yes | Time picker (HH:mm) |
| Value | No | Number input. Placeholder: "Cost (optional)" |
| Notes | No | Multiline text. Placeholder: "Any notes..." |

**CTA:** "Add to Timeline" (create mode) / "Save Changes" (edit mode). Full width, primary orange.

**Delete (edit mode only):** "Delete event" text link in red below the CTA. Confirmation uses `window.confirm("Delete this event?")` before removing.

**Validation:**
- Title, Place, Date, Time required
- Value must be a positive number if filled

---

### 5. `/profile` — Profile Page

Stub screen. Shows:
- User avatar placeholder (circle)
- "Profile" heading
- "Account features coming soon" subtext

No functionality. Bottom nav shows Profile tab as active.

---

## File Map

```
src/
  types/
    trip.ts                      Create  — Destination + TripEvent types (not GapWarning — see gapDetection.ts)
  stores/
    tripsStore.ts                Create  — Zustand store with persist middleware
    tripsStore.test.ts           Create  — unit tests for store actions and localStorage persistence
  lib/
    gapDetection.ts              Create  — detectGaps() pure function
    gapDetection.test.ts         Create  — unit tests for gap logic
    travelEmojis.ts              Create  — emoji pool + auto-assign function
    utils.ts                     Existing (unchanged)
  components/
    BottomNav.tsx                Create  — 2-tab nav (Trips, Profile)
    DestinationRow.tsx           Create  — single row in destinations list
    TimelineEvent.tsx            Create  — single event card in timeline
    GapWarningCard.tsx           Create  — orange gap warning card (named GapWarningCard to avoid collision with GapWarning interface from gapDetection.ts)
    GooglePlacesInput.tsx        Create  — Google Places Autocomplete input
    sheets/
      NewDestinationSheet.tsx    Create  — bottom sheet: create destination
      AddEventSheet.tsx          Create  — bottom sheet: add/edit event
      AddEventSheet.test.tsx     Create  — tests for form validation
    GlassCard.tsx                Existing (unchanged)
  pages/
    TripsPage.tsx                Create  — /trips route
    TripsPage.test.tsx           Create  — tests for destinations list
    TripDetailPage.tsx           Create  — /trips/:id route
    TripDetailPage.test.tsx      Create  — tests for timeline view
    ProfilePage.tsx              Create  — /profile stub
    LoginPage.tsx                Existing (unchanged)
    LoginPage.test.tsx           Existing (unchanged)
  App.tsx                        Modify  — add new routes
```

---

## Dependencies to Install

```bash
pnpm install zustand @googlemaps/js-api-loader
pnpm install -D @types/google.maps
```

---

## Google Maps Setup Instructions

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable **Places API (New)** in APIs & Services → Library
4. Create an API key in APIs & Services → Credentials
5. (Recommended) Restrict the key to your localhost domain
6. Create `.env` in project root:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_key_here
   ```
7. `.env` is in `.gitignore` — never commit the key

If the key is missing, the Place field falls back to a plain text input. The app is fully usable without a key (place is stored as text).

---

## Testing Strategy

**Unit tests (Vitest):**
- `gapDetection.test.ts` — pure function, comprehensive cases:
  - No events → no gaps
  - Single accommodation → no gap
  - Two accommodations with transport between → no gap
  - Two accommodations without transport → 1 gap
  - Multiple consecutive gaps
  - Transport on same day as checkout but wrong time → still a gap vs. not

**Component tests (@testing-library/react):**
- `TripsPage.test.tsx` — renders empty state, renders destination rows, gap badge shown when gaps exist
- `TripDetailPage.test.tsx` — renders events sorted by date/time, renders GAP warning card between correct events
- `AddEventSheet.test.tsx` — form validation (title required, place required, date required, time required, value optional numeric)

**Store tests** (`tripsStore.test.ts` — create this file):
- `addDestination` creates a destination with correct id, emoji, and empty events array
- `deleteDestination` removes the destination and all its events
- `addEvent` appends to the correct destination's events
- `deleteEvent` removes only the specified event
- Persist: after calling store actions, the stored value in `localStorage` under `tripmate-trips` reflects the updated state

**Not tested:** `GooglePlacesInput` (requires real API key / external SDK — skip in unit tests, mock with plain input)

---

## Verification Checklist

1. `pnpm dev` — app opens, redirects `/` → `/trips`
2. `/trips` shows empty state when no destinations
3. Create a destination → appears in list with auto-emoji + correct dates
4. Open destination → empty timeline
5. Add a transport event → appears as blue dot in timeline
6. Add two accommodation events with no transport between → orange GAP warning appears between them
7. Add a transport event between the two accommodations → GAP warning disappears
8. Edit an event → sheet opens pre-filled, save updates the timeline
9. Delete an event → removed from timeline
10. Delete a destination → removed from list
11. Refresh page → all data persists (localStorage)
12. Google Places field: without API key (`VITE_GOOGLE_MAPS_API_KEY` unset), shows plain text input (fallback — testable without secrets)
13. Google Places field: with a valid API key set, typing an address shows autocomplete suggestions
14. `pnpm exec vitest run` → all tests pass
15. `pnpm build` → TypeScript compiles cleanly
