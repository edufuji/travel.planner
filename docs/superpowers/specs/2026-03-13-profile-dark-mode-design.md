# Profile Page & Dark Mode — Design Spec

**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Replace the placeholder `ProfilePage` with a functional profile screen showing the user's name, plan tier, a conditional upgrade button, and a persistent dark mode toggle. This spec covers two independent concerns that land in the same page: profile content and app-wide theming.

---

## 1. User Data

User data is **hardcoded mock values** for now. No store, no API. The profile page defines a local constant:

```ts
const USER = { name: 'John Doe', plan: 'free' as 'free' | 'premium' | 'pro' }
```

When backend/auth integration arrives in a future phase, this constant will be replaced by a store selector. The component shape stays the same.

---

## 2. Profile Page Layout (Layout A — Centered Card)

The page is a vertically centered column on the cream background (`bg-background`), padded for the bottom nav (`pb-20`). Elements from top to bottom:

### 2.1 Avatar

- 80×80px circle (`w-20 h-20 rounded-full`)
- Background: `bg-input-bg` (custom TripMate token — defined in `tailwind.config.js` as `'var(--input-bg)'`; not a standard Tailwind palette class), border: `border-2 border-border`
- Contains the `👤` emoji at `text-3xl`
- No image upload in this phase

### 2.2 Name

- User's display name in `text-xl font-extrabold text-foreground`
- Rendered from `USER.name`

### 2.3 Plan Badge

Pill-shaped badge using `text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full text-white`:

| Plan | Background |
|------|-----------|
| `free` | `bg-stone-500` (stone gray) |
| `premium` | `bg-blue-500` |
| `pro` | `bg-gradient-to-r from-amber-400 to-amber-600` + label "Pro ✦" |

### 2.4 Upgrade Card (conditional)

Shown only when `plan === 'free' || plan === 'premium'`. Hidden for `pro`.

A white card (`bg-white dark:bg-stone-800`) with `border border-border rounded-xl p-4 w-full text-center`:

- Subtitle: `"You're on the {Plan} plan"` in `text-xs text-muted`
- CTA button using the existing `Button` component (`variant="default"`, full width):
  - Free → label `"⬆ Upgrade to Premium"`
  - Premium → label `"⬆ Upgrade to Pro"`
  - The button has **no `onClick` handler** — wired up in a future Stripe/backend phase
  - `variant="default"` uses `bg-primary text-primary-foreground`. The `tailwind.config.js` does not currently map `primary.foreground` as a Tailwind color token, so `text-primary-foreground` produces no utility CSS. As part of this task:
    1. In `src/index.css`, override the shadcn-style `--primary-foreground` HSL channel value with a direct hex in the TripMate tokens section (inside `:root`):
       ```css
       --primary-foreground: #FFFFFF;
       ```
    2. In `tailwind.config.js`, add `foreground` to the `primary` object using the same `var(--token)` pattern as all other tokens:
       ```js
       primary: {
         DEFAULT: 'var(--primary)',
         dark: 'var(--primary-dark)',
         light: 'var(--primary-light)',
         foreground: 'var(--primary-foreground)',  // white text on orange button
       },
       ```
    This keeps all Tailwind color tokens consistently variable-backed. `--primary-foreground` stays white in dark mode (white on orange is readable in both modes), so no `.dark` override is needed.

### 2.5 Dark Mode Toggle Row

A white card (`bg-white dark:bg-stone-800`) with `border border-border rounded-xl px-4 py-3 w-full flex justify-between items-center`:

- Left label: `"Dark mode"` in `text-sm font-semibold text-foreground`
- Right: custom toggle switch (see section 3)

---

## 3. Dark Mode Toggle

### 3.1 Behavior

- Reads initial state from `localStorage.getItem('theme')` on mount (`useEffect`)
- **First visit default:** always light mode — system `prefers-color-scheme` is intentionally ignored for simplicity; a future phase may add OS preference detection
- Toggling adds/removes the `dark` class on `document.documentElement`
- Writes `'dark'` or `'light'` to `localStorage.setItem('theme', ...)`
- The toggle is a **self-contained component** `DarkModeToggle` in `src/components/DarkModeToggle.tsx`

### 3.2 Toggle Visual

Custom pill switch (no external library):

- Container: `relative w-10 h-[22px] rounded-full transition-colors cursor-pointer`
  - OFF: `bg-border` (gray)
  - ON: `bg-primary` (orange)
- Thumb: `absolute left-[2px] top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform`
  - OFF: `translate-x-0` (thumb at left, 2px inset)
  - ON: `translate-x-[18px]` (thumb at right, 2px inset — 2+18+2 = 22px ≤ 40px container ✓)
  - `bg-white` is intentional in both light and dark mode — white circle against the colored track provides clear contrast regardless of theme
- Accessible: `role="switch"`, `aria-checked={isDark}`, `aria-label="Toggle dark mode"`

### 3.3 Initialization (FOUC prevention)

Add the following **immediately after `<meta charset="UTF-8" />`** in `index.html` (not before it — charset must be parsed first):

```html
<script>
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark')
  }
</script>
```

This applies the `dark` class synchronously before React loads, preventing a flash of light-mode styles on users who have dark mode saved.

---

## 4. Dark Mode CSS Variables

Add a `.dark` block to `src/index.css` **inside the `@layer base { }` block**, immediately after the `:root` block (alongside it within the same `@layer base`):

```css
@layer base {
  :root {
    /* ... existing variables unchanged ... */
  }

  .dark {
    --background: #1C1917;       /* stone-900 */
    --foreground: #FAFAF9;       /* stone-50 */
    --muted: #A8A29E;            /* stone-400 */
    --input-bg: #292524;         /* stone-800 */
    --border: #44403C;           /* stone-700 */
  }
}
```

This block overrides only the **TripMate custom design tokens** (the hex values at the bottom of `:root`). It does not touch the shadcn-style HSL channel variables in the upper portion of `:root`. `--primary` (`#FF6B35`) is intentionally omitted — the brand orange stays the same in both modes.

---

## 5. BottomNav Dark Mode

`BottomNav.tsx` currently has `bg-white border-t border-border`. Only the background needs changing:

- Replace `bg-white` → `bg-background`

`bg-background` resolves to `var(--background)`, which the `.dark` block sets to `#1C1917`. The `border-border` class is already correct and requires no change — the `.dark` block overrides `--border` to `#44403C` automatically.

The `text-primary` / `text-muted` nav link classes use CSS variables and require no changes.

---

## 6. Files Changed

| File | Change |
|------|--------|
| `src/pages/ProfilePage.tsx` | Full replacement with centered card layout |
| `src/components/DarkModeToggle.tsx` | New component |
| `src/index.css` | Add `.dark` block inside `@layer base` after `:root`; add `--primary-foreground: #FFFFFF` to TripMate tokens in `:root` |
| `src/components/BottomNav.tsx` | `bg-white` → `bg-background` |
| `tailwind.config.js` | Add `primary.foreground: 'var(--primary-foreground)'` |
| `index.html` | Add FOUC-prevention script immediately after `<meta charset>` |

---

## 7. Out of Scope

- User avatar image upload
- Editable name
- Actual Stripe/payment integration (button renders but has no `onClick`)
- Auth/user store (mock constant only)
- System `prefers-color-scheme` detection (first-visit always light)
- Tests for `ProfilePage` (purely presentational, mock data — tested via visual review)
- Tests for `DarkModeToggle` (DOM manipulation via `document.documentElement` — integration tested manually)
