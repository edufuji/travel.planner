# Animations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add playful spring-based animations to TripMate — micro-interactions on all tappable elements, page transitions between routes, staggered list entrances, and status badge pop-ins using Framer Motion.

**Architecture:** Install `framer-motion` and replace `<div>`/`<button>` elements with `motion.*` equivalents where needed. Page transitions live in `App.tsx` via `AnimatePresence`. List stagger uses `variants` + `staggerChildren`. No new files created — all changes are surgical edits to existing components.

**Tech Stack:** React 19, Framer Motion, Tailwind CSS, TypeScript, Vite, Vitest

---

## Chunk 1: Install dependency + page transitions + micro-interactions (non-list)

### Task 1: Install framer-motion

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
pnpm add framer-motion
```

Expected: `framer-motion` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Verify tests still pass**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install framer-motion"
```

---

### Task 2: Page transitions in App.tsx

**Files:**
- Modify: `src/App.tsx`

The goal: wrap `<Routes>` with `<AnimatePresence mode="wait">` and key the routes on `location.pathname` so Framer Motion detects navigation and fires exit/enter animations. Each page handles its own `motion.div` wrapper (added in Tasks 3–7).

- [ ] **Step 1: Update App.tsx**

Replace the entire file content with:

```tsx
import { AnimatePresence } from 'framer-motion'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { useDestinationsSync } from '@/hooks/useDestinationsSync'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import TripsPage from '@/pages/TripsPage'
import TripDetailPage from '@/pages/TripDetailPage'
import ProfilePage from '@/pages/ProfilePage'

function AppRoutes() {
  useDestinationsSync()
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/trips" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/trips" element={<ProtectedRoute><TripsPage /></ProtectedRoute>} />
        <Route path="/trips/:id" element={<ProtectedRoute><TripDetailPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add AnimatePresence to App for page transitions"
```

---

### Task 3: Page motion wrapper — TripsPage

**Files:**
- Modify: `src/pages/TripsPage.tsx`

Wrap the page root `<div>` with `<motion.div>` for slide-in/out transitions. Also add `whileTap`/`whileHover` to the "New" button, "Plan first trip" button, and the dashed "plan new destination" row.

The spring constant to use for buttons: `{ type: "spring", stiffness: 400, damping: 17 }`.
Page transition props:
```
initial={{ x: "100%", opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
exit={{ x: "-30%", opacity: 0 }}
transition={{ type: "spring", stiffness: 300, damping: 30 }}
```

- [ ] **Step 1: Update TripsPage.tsx**

```tsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useTripsStore } from '@/stores/tripsStore'
import DestinationRow from '@/components/DestinationRow'
import NewDestinationSheet from '@/components/sheets/NewDestinationSheet'
import BottomNav from '@/components/BottomNav'
import LocalDataImport from '@/components/LocalDataImport'

const snappy = { type: 'spring', stiffness: 400, damping: 17 } as const

export default function TripsPage() {
  const { t } = useTranslation()
  const destinations = useTripsStore(s => s.destinations)
  const deleteDestination = useTripsStore(s => s.deleteDestination)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <motion.div
      className="min-h-screen bg-background pb-20"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-30%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t('trips.myTrips')}</h1>
          <p className="text-xs text-muted">
            {t('trips.destinationCount', { count: destinations.length })}
          </p>
        </div>
        <motion.button
          onClick={() => setSheetOpen(true)}
          className="bg-primary text-white rounded-full px-4 py-2 text-sm font-bold hover:bg-primary-dark transition-colors"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.93 }}
          transition={snappy}
        >
          {t('trips.newButton')}
        </motion.button>
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {destinations.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="text-5xl mb-4" aria-hidden="true">🗺️</div>
            <h2 className="text-lg font-bold text-foreground mb-1">{t('trips.emptyHeading')}</h2>
            <p className="text-sm text-muted mb-6">{t('trips.emptySubtext')}</p>
            <motion.button
              onClick={() => setSheetOpen(true)}
              className="bg-primary text-white rounded-full px-6 py-2.5 text-sm font-bold hover:bg-primary-dark transition-colors"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.93 }}
              transition={snappy}
            >
              {t('trips.planFirstTrip')}
            </motion.button>
          </div>
        ) : (
          <>
            {destinations.map(d => (
              <DestinationRow
                key={d.id}
                destination={d}
                onDelete={deleteDestination}
              />
            ))}
            <motion.div
              className="border-2 border-dashed border-border rounded-[10px] p-3 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSheetOpen(true)}
              role="button"
              whileTap={{ scale: 0.98 }}
              transition={snappy}
            >
              <span className="text-sm text-muted">{t('trips.planNewDestination')}</span>
            </motion.div>
          </>
        )}
      </div>

      <NewDestinationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <LocalDataImport />
      <BottomNav />
    </motion.div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/TripsPage.tsx
git commit -m "feat: page transition + button micro-interactions on TripsPage"
```

---

### Task 4: Page motion wrapper — TripDetailPage

**Files:**
- Modify: `src/pages/TripDetailPage.tsx`

Wrap root `<div>` with `<motion.div>`. Add `whileTap`/`whileHover` to the back button and the "+" add-event button.

- [ ] **Step 1: Add motion import and wrap root + buttons**

Change the import line at the top to add `motion`:
```tsx
import { motion } from 'framer-motion'
```

Replace the root `<div className="h-screen bg-background flex flex-col">` with:
```tsx
<motion.div
  className="h-screen bg-background flex flex-col"
  initial={{ x: '100%', opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: '-30%', opacity: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
```
(and close with `</motion.div>` at the end)

Replace the back `<button>` (line 64):
```tsx
<motion.button
  onClick={() => navigate('/trips')}
  className="flex items-center gap-1 text-primary text-sm font-semibold shrink-0 px-2 py-1 rounded-lg hover:bg-primary/10 active:bg-primary/20 transition-colors"
  whileHover={{ scale: 1.04 }}
  whileTap={{ scale: 0.93 }}
  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
>
  <ChevronLeft size={16} />
  {t('trip.tripsLink')}
</motion.button>
```

Replace the "+" add-event `<button>` (line 80):
```tsx
<motion.button
  onClick={openAddSheet}
  className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shrink-0 hover:bg-primary-dark transition-colors"
  aria-label={t('trip.addEvent')}
  whileHover={{ scale: 1.04 }}
  whileTap={{ scale: 0.93 }}
  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
>
  +
</motion.button>
```

- [ ] **Step 2: Run tests**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/TripDetailPage.tsx
git commit -m "feat: page transition + button micro-interactions on TripDetailPage"
```

---

### Task 5: Page motion wrappers + LanguageSwitcher micro-interactions — ProfilePage, LoginPage, SignupPage

**Files:**
- Modify: `src/pages/ProfilePage.tsx`
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/SignupPage.tsx`
- Modify: `src/components/LanguageSwitcher.tsx`

Page transition props for all three pages:
```
initial={{ x: '100%', opacity: 0 }}
animate={{ x: 0, opacity: 1 }}
exit={{ x: '-30%', opacity: 0 }}
transition={{ type: 'spring', stiffness: 300, damping: 30 }}
```

- [ ] **Step 1: Update ProfilePage.tsx**

Add `import { motion } from 'framer-motion'` at the top.

Replace root `<div className="min-h-screen bg-background pb-20 flex flex-col items-center justify-center px-6">` with:
```tsx
<motion.div
  className="min-h-screen bg-background pb-20 flex flex-col items-center justify-center px-6"
  initial={{ x: '100%', opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: '-30%', opacity: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
```
(close with `</motion.div>`)

- [ ] **Step 2: Update LoginPage.tsx**

Add `import { motion } from 'framer-motion'` at the top.

Replace outer root `<div className="relative min-h-screen flex items-center justify-center px-4"` with:
```tsx
<motion.div
  className="relative min-h-screen flex items-center justify-center px-4"
  style={{ background: 'linear-gradient(rgba(26,10,0,0.45), rgba(26,10,0,0.55)), linear-gradient(135deg, #C75B2A, #FF8C42, #F7C59F, #EFEFD0)' }}
  initial={{ x: '100%', opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: '-30%', opacity: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
```
(close with `</motion.div>` — remove the `style` prop from the existing `<div>` since it moves to `<motion.div>`)

- [ ] **Step 3: Update SignupPage.tsx**

Add `import { motion } from 'framer-motion'` at the top.

Replace outer root `<div`:
```tsx
<div
  className="relative min-h-screen flex items-center justify-center px-4"
  style={{
    background:
      'linear-gradient(rgba(26,10,0,0.45), rgba(26,10,0,0.55)), linear-gradient(135deg, #C75B2A, #FF8C42, #F7C59F, #EFEFD0)',
  }}
>
```
with:
```tsx
<motion.div
  className="relative min-h-screen flex items-center justify-center px-4"
  style={{
    background:
      'linear-gradient(rgba(26,10,0,0.45), rgba(26,10,0,0.55)), linear-gradient(135deg, #C75B2A, #FF8C42, #F7C59F, #EFEFD0)',
  }}
  initial={{ x: '100%', opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: '-30%', opacity: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
```
(close with `</motion.div>` at the end)

- [ ] **Step 4: Update LanguageSwitcher.tsx — add whileHover/whileTap to language buttons**

The spec requires language switcher buttons to have `whileHover={{ scale: 1.04 }}` / `whileTap={{ scale: 0.93 }}` with the snappy spring. `LanguageSwitcher` renders a `.map()` over `LANGUAGES` producing `<button>` elements — replace them with `<motion.button>`.

Full updated file:
```tsx
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const LANGUAGES = [
  { code: 'pt-BR', label: 'PT' },
  { code: 'en',   label: 'EN' },
  { code: 'es',   label: 'ES' },
]

const snappy = { type: 'spring', stiffness: 400, damping: 17 } as const

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  return (
    <div className="flex gap-1" role="group" aria-label={t('lang.label')}>
      {LANGUAGES.map(({ code, label }) => (
        <motion.button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          aria-pressed={i18n.language === code}
          className={cn(
            'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
            i18n.language === code
              ? 'bg-primary text-white'
              : 'text-muted hover:text-foreground'
          )}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.93 }}
          transition={snappy}
        >
          {label}
        </motion.button>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProfilePage.tsx src/pages/LoginPage.tsx src/pages/SignupPage.tsx src/components/LanguageSwitcher.tsx
git commit -m "feat: page transition wrappers on Profile/Login/Signup + LanguageSwitcher micro-interactions"
```

---

### Task 6: BottomNav tab micro-interactions

**Files:**
- Modify: `src/components/BottomNav.tsx`

Nav tabs get a more exaggerated tap animation for the finger-on-glass feel: `whileTap={{ scale: 0.85, y: 2 }}`.

`NavLink` renders an `<a>` element — wrap each `NavLink` with a `<motion.div>` to get the tap effect (since `motion(NavLink)` would require extra typing):

- [ ] **Step 1: Update BottomNav.tsx**

```tsx
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Map, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const snappy = { type: 'spring', stiffness: 400, damping: 17 } as const

export default function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40">
      <div className="flex justify-around items-center py-2">
        <motion.div whileTap={{ scale: 0.85, y: 2 }} transition={snappy}>
          <NavLink
            to="/trips"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-6 py-1 text-xs font-semibold transition-colors',
                isActive ? 'text-primary' : 'text-muted'
              )
            }
          >
            <Map size={20} />
            {t('nav.trips')}
          </NavLink>
        </motion.div>
        <motion.div whileTap={{ scale: 0.85, y: 2 }} transition={snappy}>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-6 py-1 text-xs font-semibold transition-colors',
                isActive ? 'text-primary' : 'text-muted'
              )
            }
          >
            <User size={20} />
            {t('nav.profile')}
          </NavLink>
        </motion.div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomNav.tsx
git commit -m "feat: bouncy tap animation on BottomNav tabs"
```

---

### Task 7: ViewToggle button micro-interactions

**Files:**
- Modify: `src/components/ViewToggle.tsx`

- [ ] **Step 1: Update ViewToggle.tsx**

```tsx
import { motion } from 'framer-motion'
import { List, Map } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type View = 'timeline' | 'map'

interface ViewToggleProps {
  active: View
  onChange: (view: View) => void
}

const btnBase = 'flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition-colors'
const snappy = { type: 'spring', stiffness: 400, damping: 17 } as const

export default function ViewToggle({ active, onChange }: ViewToggleProps) {
  const { t } = useTranslation()
  return (
    <div className="flex w-full bg-input-bg rounded-full p-0.5" role="group" aria-label={t('view.toggleLabel')}>
      <motion.button
        className={cn(btnBase, active === 'timeline' ? 'bg-primary text-white' : 'bg-input-bg text-muted')}
        aria-pressed={active === 'timeline'}
        onClick={() => onChange('timeline')}
        whileTap={{ scale: 0.9 }}
        transition={snappy}
      >
        <List size={14} />
        {t('view.timeline')}
      </motion.button>
      <motion.button
        className={cn(btnBase, active === 'map' ? 'bg-primary text-white' : 'bg-input-bg text-muted')}
        aria-pressed={active === 'map'}
        onClick={() => onChange('map')}
        whileTap={{ scale: 0.9 }}
        transition={snappy}
      >
        <Map size={14} />
        {t('view.map')}
      </motion.button>
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ViewToggle.tsx
git commit -m "feat: tap animation on ViewToggle buttons"
```

---

## Chunk 2: Card micro-interactions + list stagger + badge pop-in

### Task 8: DestinationRow — card hover/tap + badge pop-in

**Files:**
- Modify: `src/components/DestinationRow.tsx`

Replace the root `<div role="button">` with `<motion.div>` for hover/tap. Replace GAP and OK `<span>` badges with `<motion.span>` for pop-in on mount.

- [ ] **Step 1: Update DestinationRow.tsx**

```tsx
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { detectGaps } from '@/lib/gapDetection'
import { formatDate } from '@/lib/formatDate'
import type { Destination } from '@/types/trip'

interface Props {
  destination: Destination
  onDelete: (id: string) => void
}

const snappy = { type: 'spring', stiffness: 400, damping: 17 } as const
const badgeSpring = { type: 'spring', stiffness: 500, damping: 15 } as const

export default function DestinationRow({ destination, onDelete }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const gaps = detectGaps(destination.events)
  const hasGaps = gaps.length > 0
  const hasEvents = destination.events.length > 0

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(t('trips.deleteConfirm'))) {
      onDelete(destination.id)
    }
  }

  return (
    <motion.div
      className="bg-white dark:bg-transparent border border-border rounded-[10px] p-3 flex items-center gap-3 cursor-pointer active:bg-input-bg"
      onClick={() => navigate(`/trips/${destination.id}`)}
      onContextMenu={(e) => { e.preventDefault(); handleDelete(e) }}
      role="button"
      aria-label={destination.title}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
      transition={snappy}
    >
      <span className="text-2xl" aria-hidden="true">{destination.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-foreground text-sm truncate">{destination.title}</div>
        <div className="text-xs text-muted">
          {formatDate(destination.startDate)} – {formatDate(destination.endDate)}
        </div>
      </div>
      {hasGaps && (
        <motion.span
          className="text-xs font-bold bg-[#FFF7ED] dark:bg-transparent dark:border dark:border-[#C75B2A] text-[#C75B2A] rounded px-1.5 py-0.5 shrink-0"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={badgeSpring}
        >
          {t('status.gap')}
        </motion.span>
      )}
      {!hasGaps && hasEvents && (
        <motion.span
          className="text-xs font-bold bg-[#F0FDF4] dark:bg-transparent dark:border dark:border-[#059669] text-[#059669] rounded px-1.5 py-0.5 shrink-0"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={badgeSpring}
        >
          {t('status.ok')}
        </motion.span>
      )}
    </motion.div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/components/DestinationRow.tsx
git commit -m "feat: hover/tap animation + badge pop-in on DestinationRow"
```

---

### Task 9: TimelineEvent — card hover/tap

**Files:**
- Modify: `src/components/TimelineEvent.tsx`

Replace the inner card `<div role="button">` with `<motion.div>`.

- [ ] **Step 1: Update TimelineEvent.tsx**

Add import at top:
```tsx
import { motion } from 'framer-motion'
```

Add spring constant inside the component (before the return):
```tsx
const snappy = { type: 'spring', stiffness: 400, damping: 17 } as const
```

Replace the card `<div>` (currently `className="bg-white dark:bg-transparent border border-border rounded-lg px-3 py-2 cursor-pointer active:bg-input-bg"`):
```tsx
<motion.div
  className="bg-white dark:bg-transparent border border-border rounded-lg px-3 py-2 cursor-pointer active:bg-input-bg"
  onClick={() => onEdit(event)}
  role="button"
  aria-label={t('event.editLabel', { title: event.title })}
  whileHover={{ y: -2, scale: 1.01 }}
  whileTap={{ scale: 0.97 }}
  transition={snappy}
>
```
(close with `</motion.div>` instead of `</div>`)

- [ ] **Step 2: Run tests**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/components/TimelineEvent.tsx
git commit -m "feat: hover/tap animation on TimelineEvent card"
```

---

### Task 10: List stagger — TripsPage destination list

**Files:**
- Modify: `src/pages/TripsPage.tsx`

Add `listContainer` and `listItem` variants. Wrap the destinations list container with `<motion.div variants={listContainer}>`. Wrap each `<DestinationRow>` with `<motion.div variants={listItem}>`.

- [ ] **Step 1: Add variant constants and update list rendering**

Add these constants at module level (after the `snappy` const):
```tsx
const listContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

const listItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
}
```

The outer list container in TripsPage is `<div className="px-4 space-y-2">` — this wraps both the stagger container and the dashed row. Keep that outer `<div>` intact; only change what's inside it.

Replace the destinations list section (the `<>` fragment inside the else branch, which sits inside `<div className="px-4 space-y-2">`):
```tsx
<>
  <motion.div
    className="space-y-2"
    variants={listContainer}
    initial="hidden"
    animate="visible"
  >
    {destinations.map(d => (
      <motion.div key={d.id} variants={listItem}>
        <DestinationRow
          destination={d}
          onDelete={deleteDestination}
        />
      </motion.div>
    ))}
  </motion.div>
  <motion.div
    className="border-2 border-dashed border-border rounded-[10px] p-3 text-center cursor-pointer hover:border-primary/40 transition-colors"
    onClick={() => setSheetOpen(true)}
    role="button"
    whileTap={{ scale: 0.98 }}
    transition={snappy}
  >
    <span className="text-sm text-muted">{t('trips.planNewDestination')}</span>
  </motion.div>
</>
```

Note: `space-y-2` is retained on the stagger container so card spacing is preserved. The outer `<div className="px-4 space-y-2">` can have its `space-y-2` removed since the inner container now handles it, or left as-is (the extra spacing between the stagger container and dashed row is acceptable).

- [ ] **Step 2: Run tests**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/TripsPage.tsx
git commit -m "feat: stagger entrance animation on TripsPage destination list"
```

---

### Task 11: List stagger — TripDetailPage timeline + TimelineDateHeader

**Files:**
- Modify: `src/pages/TripDetailPage.tsx`
- Modify: `src/components/TimelineDateHeader.tsx`

The timeline groups loop renders both `TimelineDateHeader` and `TimelineEvent` items. Wrap the outer groups container with `listContainer` variants. Each item in the groups loop gets a `<motion.div variants={listItem}>` wrapper. Additionally, `TimelineDateHeader` itself must have its root `<div>` replaced with `<motion.div>` so it can accept `variants` from a parent context.

- [ ] **Step 1: Update TimelineDateHeader.tsx — replace root div with motion.div**

Full updated file:
```tsx
import { motion } from 'framer-motion'

interface Props {
  label: string
}

export default function TimelineDateHeader({ label }: Props) {
  return (
    <motion.div className="pt-4 pb-1 first:pt-0">
      <span className="text-xs font-bold text-primary uppercase tracking-wide">
        {label}
      </span>
    </motion.div>
  )
}
```

Note: no `initial`/`animate` props on the component itself — animation is driven by the parent stagger container in `TripDetailPage`.

- [ ] **Step 2: Add variant constants to TripDetailPage.tsx**

Add at module level (after the imports):
```tsx
const listContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

const listItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
}
```

Also add `motion` to the framer-motion import (add import at top):
```tsx
import { motion } from 'framer-motion'
```

- [ ] **Step 3: Wrap timeline groups with stagger container**

Replace the groups rendering section (currently starting with `<div className="pl-5">`):
```tsx
<motion.div
  className="pl-5"
  variants={listContainer}
  initial="hidden"
  animate="visible"
>
  {groups.map(group => (
    <div key={group.date} className="pb-4">
      <TimelineDateHeader label={group.label} />
      <div className="space-y-5">
        {group.items.map(item =>
          item.kind === 'event' ? (
            <motion.div key={item.event.id} variants={listItem}>
              <TimelineEvent
                event={item.event}
                onEdit={openEditSheet}
              />
            </motion.div>
          ) : (
            <motion.div key={item.key} variants={listItem}>
              <GapWarningCard fromTitle={item.fromTitle} toTitle={item.toTitle} />
            </motion.div>
          )
        )}
      </div>
    </div>
  ))}
</motion.div>
```

(`GapWarningCard` is already imported in `TripDetailPage.tsx` — no new import needed.)

- [ ] **Step 4: Run tests**

```bash
pnpm exec vitest run
```

Expected: `188 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TripDetailPage.tsx src/components/TimelineDateHeader.tsx
git commit -m "feat: stagger entrance animation on TripDetailPage timeline + TimelineDateHeader"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full test suite one last time**

```bash
pnpm exec vitest run
```

Expected: `188 passed | 0 failed`.

- [ ] **Step 2: Confirm build compiles cleanly**

```bash
pnpm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 3: Final commit (if any stray changes)**

```bash
git status
```

If clean, no commit needed. If any stray changes, stage and commit them.
