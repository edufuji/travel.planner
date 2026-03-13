# Profile Page & Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder ProfilePage with a centered-card profile showing user name, plan badge, conditional upgrade button, and a persistent dark mode toggle backed by localStorage.

**Architecture:** Infrastructure changes (CSS variables, Tailwind token, FOUC script) land first so all subsequent components can rely on them. `DarkModeToggle` is a self-contained presentational component that owns its own localStorage/DOM interaction. `ProfilePage` composes all pieces together with hardcoded mock user data.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3 (`darkMode: ["class"]`), Zustand 5, Vitest

**Spec:** `docs/superpowers/specs/2026-03-13-profile-dark-mode-design.md`

---

## Chunk 1: CSS, Tailwind, FOUC, BottomNav

### Task 1: Add dark mode CSS variables and primary-foreground token

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`

No new tests — CSS and config changes. Verification is a clean build and the existing 96 tests still passing.

- [ ] **Step 1: Add `--primary-foreground` to TripMate tokens in `index.css`**

  In `src/index.css`, inside the `@layer base { :root { ... } }` block, append `--primary-foreground: #FFFFFF;` at the end of the TripMate design tokens section (after `--border: #E5E0DB;`). The result of that section should be:

  ```css
  /* TripMate design tokens */
  --primary: #FF6B35;
  --primary-dark: #C75B2A;
  --primary-light: #F7C59F;
  --background: #FEFAF6;
  --foreground: #1A0A00;
  --muted: #78716C;
  --input-bg: #F5F0EB;
  --border: #E5E0DB;
  --primary-foreground: #FFFFFF;
  ```

- [ ] **Step 2: Add `.dark` variable block inside `@layer base` in `index.css`**

  Immediately after the closing `}` of `:root` (still inside `@layer base`), add:

  ```css
  .dark {
    --background: #1C1917;
    --foreground: #FAFAF9;
    --muted: #A8A29E;
    --input-bg: #292524;
    --border: #44403C;
  }
  ```

  The full `@layer base` block should now look like:

  ```css
  @layer base {
    :root {
      --background: 0 0% 100%;
      --foreground: 222.2 47.4% 11.2%;
      --muted: 210 40% 96.1%;
      --muted-foreground: 215.4 16.3% 46.9%;
      --popover: 0 0% 100%;
      --popover-foreground: 222.2 47.4% 11.2%;
      --border: 214.3 31.8% 91.4%;
      --input: 214.3 31.8% 91.4%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 47.4% 11.2%;
      --primary: 222.2 47.4% 11.2%;
      --primary-foreground: 210 40% 98%;
      --secondary: 210 40% 96.1%;
      --secondary-foreground: 222.2 47.4% 11.2%;
      --accent: 210 40% 96.1%;
      --accent-foreground: 222.2 47.4% 11.2%;
      --destructive: 0 100% 50%;
      --destructive-foreground: 210 40% 98%;
      --ring: 215 20.2% 65.1%;
      --radius: 0.5rem;

      /* TripMate design tokens */
      --primary: #FF6B35;
      --primary-dark: #C75B2A;
      --primary-light: #F7C59F;
      --background: #FEFAF6;
      --foreground: #1A0A00;
      --muted: #78716C;
      --input-bg: #F5F0EB;
      --border: #E5E0DB;
      --primary-foreground: #FFFFFF;
    }

    .dark {
      --background: #1C1917;
      --foreground: #FAFAF9;
      --muted: #A8A29E;
      --input-bg: #292524;
      --border: #44403C;
    }
  }
  ```

- [ ] **Step 3: Add `primary.foreground` to `tailwind.config.js`**

  In `tailwind.config.js`, update the `primary` object under `theme.extend.colors` to add `foreground`:

  ```js
  primary: {
    DEFAULT: 'var(--primary)',
    dark: 'var(--primary-dark)',
    light: 'var(--primary-light)',
    foreground: 'var(--primary-foreground)',
  },
  ```

- [ ] **Step 4: Add FOUC-prevention script to `index.html`**

  In `index.html`, insert the following immediately after `<meta charset="UTF-8" />`:

  ```html
  <script>
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark')
    }
  </script>
  ```

  The `<head>` should now look like:

  ```html
  <head>
    <meta charset="UTF-8" />
    <script>
      if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.classList.add('dark')
      }
    </script>
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>myapp</title>
  </head>
  ```

- [ ] **Step 5: Run existing tests — all should still pass**

  ```bash
  pnpm exec vitest run
  ```

  Expected: `96 passed (96)` — no failures. These are CSS/config-only changes; no logic was touched.

- [ ] **Step 6: Run build to verify no TypeScript errors**

  ```bash
  pnpm build
  ```

  Expected: `✓ built in Xs` with no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add src/index.css tailwind.config.js index.html
  git commit -m "feat: add dark mode CSS variables, primary-foreground token, FOUC prevention"
  ```

---

### Task 2: Update BottomNav to use `bg-background`

**Files:**
- Modify: `src/components/BottomNav.tsx`

- [ ] **Step 1: Replace `bg-white` with `bg-background` in `BottomNav.tsx`**

  In `src/components/BottomNav.tsx`, change line 7:

  ```tsx
  // Before
  <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40">

  // After
  <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40">
  ```

  `bg-background` maps to `var(--background)` which the `.dark` block sets to `#1C1917`.

- [ ] **Step 2: Run tests — all should still pass**

  ```bash
  pnpm exec vitest run
  ```

  Expected: `96 passed (96)`.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/BottomNav.tsx
  git commit -m "feat: use bg-background in BottomNav for dark mode support"
  ```

---

## Chunk 2: DarkModeToggle Component

### Task 3: Create DarkModeToggle component

**Files:**
- Create: `src/components/DarkModeToggle.tsx`

No unit tests per spec (DOM class manipulation on `document.documentElement` is tested manually via visual review).

- [ ] **Step 1: Create `src/components/DarkModeToggle.tsx`**

  ```tsx
  import { useState, useEffect } from 'react'

  export default function DarkModeToggle() {
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
      setIsDark(localStorage.getItem('theme') === 'dark')
    }, [])

    function toggle() {
      const next = !isDark
      setIsDark(next)
      if (next) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
    }

    return (
      <button
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle dark mode"
        onClick={toggle}
        className={`relative w-10 h-[22px] rounded-full transition-colors cursor-pointer ${
          isDark ? 'bg-primary' : 'bg-border'
        }`}
      >
        <span
          className={`absolute left-[2px] top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${
            isDark ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </button>
    )
  }
  ```

- [ ] **Step 2: Run existing tests — no regressions**

  ```bash
  pnpm exec vitest run
  ```

  Expected: `96 passed (96)`.

- [ ] **Step 3: Run build**

  ```bash
  pnpm build
  ```

  Expected: clean build with no TypeScript errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/DarkModeToggle.tsx
  git commit -m "feat: add DarkModeToggle component with localStorage persistence"
  ```

---

## Chunk 3: ProfilePage

### Task 4: Replace ProfilePage with centered card layout

**Files:**
- Modify: `src/pages/ProfilePage.tsx`

No unit tests per spec (purely presentational with hardcoded mock data).

- [ ] **Step 1: Replace `src/pages/ProfilePage.tsx`**

  ```tsx
  import BottomNav from '@/components/BottomNav'
  import DarkModeToggle from '@/components/DarkModeToggle'
  import { Button } from '@/components/ui/button'

  const USER = { name: 'John Doe', plan: 'free' as 'free' | 'premium' | 'pro' }

  const PLAN_BADGE: Record<typeof USER.plan, { label: string; className: string }> = {
    free: { label: 'Free', className: 'bg-stone-500' },
    premium: { label: 'Premium', className: 'bg-blue-500' },
    pro: { label: 'Pro ✦', className: 'bg-gradient-to-r from-amber-400 to-amber-600' },
  }

  export default function ProfilePage() {
    const { name, plan } = USER
    const badge = PLAN_BADGE[plan]

    return (
      <div className="min-h-screen bg-background pb-20 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm flex flex-col items-center gap-4">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-input-bg border-2 border-border flex items-center justify-center">
            <span className="text-3xl">👤</span>
          </div>

          {/* Name */}
          <h1 className="text-xl font-extrabold text-foreground">{name}</h1>

          {/* Plan badge */}
          <span
            className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full text-white ${badge.className}`}
          >
            {badge.label}
          </span>

          {/* Upgrade card — hidden for pro */}
          {plan !== 'pro' && (
            <div className="bg-white dark:bg-stone-800 border border-border rounded-xl p-4 w-full text-center">
              <p className="text-xs text-muted mb-3">
                You're on the <span className="font-semibold">{badge.label}</span> plan
              </p>
              <Button className="w-full">
                ⬆ {plan === 'free' ? 'Upgrade to Premium' : 'Upgrade to Pro'}
              </Button>
            </div>
          )}

          {/* Dark mode row */}
          <div className="bg-white dark:bg-stone-800 border border-border rounded-xl px-4 py-3 w-full flex justify-between items-center">
            <span className="text-sm font-semibold text-foreground">Dark mode</span>
            <DarkModeToggle />
          </div>
        </div>

        <BottomNav />
      </div>
    )
  }
  ```

- [ ] **Step 2: Run existing tests — all 96 still pass**

  ```bash
  pnpm exec vitest run
  ```

  Expected: `96 passed (96)`.

- [ ] **Step 3: Run build**

  ```bash
  pnpm build
  ```

  Expected: clean build. Confirm no TypeScript errors in the new file.

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/ProfilePage.tsx
  git commit -m "feat: implement profile page with plan badge, upgrade button, and dark mode toggle"
  ```
