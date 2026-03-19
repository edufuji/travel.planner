# Animations Design — TripMate

**Date:** 2026-03-19
**Status:** Approved

## Overview

Add playful, spring-based animations to TripMate using Framer Motion. Four layers: micro-interactions on interactive elements, page transitions between routes, staggered list entrances, and status badge pop-ins. No reduced-motion handling (intentional — user decision).

## Dependency

Install `framer-motion` as a production dependency.

## Animation Primitives

All springs use one of three presets to keep the feel consistent:

- **Snappy spring** (buttons/taps): `{ type: "spring", stiffness: 400, damping: 17 }`
- **Page spring** (route transitions): `{ type: "spring", stiffness: 300, damping: 30 }`
- **Badge spring** (pop-in): `{ type: "spring", stiffness: 500, damping: 15 }`

## Layer 1 — Micro-interactions

Replace `<div role="button">` / `<button>` with `<motion.button>` or `<motion.div>` where applicable. Apply `whileTap` and `whileHover` props — no state changes needed.

### Buttons (standard)
- `whileHover={{ scale: 1.04 }}`
- `whileTap={{ scale: 0.93 }}`
- Spring: snappy

**Targets:**
- `TripsPage` — "New" header button, "Plan first trip" empty-state button
- `TripDetailPage` — back `<button>` (ChevronLeft), `<AddEventSheet>` trigger button
- `ProfilePage` — language switcher buttons (already `<button>`)

### BottomNav tabs
- `whileTap={{ scale: 0.85, y: 2 }}`
- Spring: snappy
- Slightly more exaggerated than regular buttons — finger-on-glass feel

### Cards (DestinationRow, TimelineEvent)
- `whileHover={{ y: -2, scale: 1.01 }}`
- `whileTap={{ scale: 0.97 }}`
- Spring: snappy
- Applied to the root `<div role="button">` of each card

### ViewToggle buttons
- `whileTap={{ scale: 0.9 }}`
- Spring: snappy

### "Plan new destination" dashed row (TripsPage)
- `whileHover={{ borderColor: ... }}` — skip, Tailwind handles color
- `whileTap={{ scale: 0.98 }}`

## Layer 2 — Page Transitions

Wrap `<Routes>` in `App.tsx` with `<AnimatePresence mode="wait">`. Use `useLocation()` as the key so `AnimatePresence` detects route changes.

Each page root element becomes a `<motion.div>` with:

```
initial={{ x: "100%", opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
exit={{ x: "-30%", opacity: 0 }}
transition={{ type: "spring", stiffness: 300, damping: 30 }}
```

**Pages to wrap:** `TripsPage`, `TripDetailPage`, `ProfilePage`, `LoginPage`, `SignupPage`.

The back navigation (TripDetailPage → TripsPage) naturally uses the same exit animation since `AnimatePresence` fires `exit` on unmount.

## Layer 3 — List Stagger

Use Framer Motion's `variants` + `staggerChildren` to animate lists on mount.

### Container variant
```js
const listContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } }
}
```

### Item variant
```js
const listItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
}
```

**Targets:**
- `TripsPage` destination list — wrap the `destinations.map(...)` container `<div className="px-4 space-y-2">` with `<motion.div variants={listContainer} initial="hidden" animate="visible">`, each `<DestinationRow>` wrapped in `<motion.div variants={listItem}>`
- `TripDetailPage` timeline — each `TimelineEvent` and `TimelineDateHeader` rendered inside the groups loop gets `variants={listItem}`. The outer groups container gets `variants={listContainer}`.

## Layer 4 — Status Badge Pop-in

`DestinationRow` GAP and OK badges animate on mount:

```
initial={{ scale: 0, opacity: 0 }}
animate={{ scale: 1, opacity: 1 }}
transition={{ type: "spring", stiffness: 500, damping: 15 }}
```

Replace the badge `<span>` with `<motion.span>`.

## Layer 5 — TimelineDateHeader Entrance

`TimelineDateHeader` is rendered inside the Layer 3 stagger container in `TripDetailPage`. It receives `variants={listItem}` as a stagger child — the same fade+slide-up as `TimelineEvent`. No standalone `initial`/`animate` props needed on the component itself.

Replace root `<div>` in `TimelineDateHeader` with `<motion.div variants={listItem}>` (variants passed from parent stagger context).

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `framer-motion` dependency |
| `src/App.tsx` | Add `AnimatePresence` + `useLocation` for page transitions |
| `src/pages/TripsPage.tsx` | Page motion wrapper, list stagger container, button micro-interactions, dashed row tap |
| `src/pages/TripDetailPage.tsx` | Page motion wrapper, back button tap, timeline stagger container |
| `src/pages/ProfilePage.tsx` | Page motion wrapper |
| `src/pages/LoginPage.tsx` | Page motion wrapper |
| `src/pages/SignupPage.tsx` | Page motion wrapper |
| `src/components/BottomNav.tsx` | Nav tab whileTap |
| `src/components/DestinationRow.tsx` | Card hover/tap, badge pop-in |
| `src/components/TimelineEvent.tsx` | Card hover/tap |
| `src/components/TimelineDateHeader.tsx` | Fade+slide entrance |
| `src/components/ViewToggle.tsx` | Button whileTap |

## Testing

- Existing tests are unaffected: Framer Motion's `motion.*` elements render as their underlying HTML elements in jsdom — no mock needed
- No new tests required for animation behavior (visual, not logic)
- Run `pnpm exec vitest run` after implementation to confirm 188/188 still pass
