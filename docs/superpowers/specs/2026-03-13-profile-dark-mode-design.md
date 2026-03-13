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
- Background: `bg-input-bg`, border: `border-2 border-border`
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

### 2.5 Dark Mode Toggle Row

A white card (`bg-white dark:bg-stone-800`) with `border border-border rounded-xl px-4 py-3 w-full flex justify-between items-center`:

- Left label: `"Dark mode"` in `text-sm font-semibold text-foreground`
- Right: custom toggle switch (see section 3)

---

## 3. Dark Mode Toggle

### 3.1 Behavior

- Reads initial state from `localStorage.getItem('theme')` on mount (`useEffect`)
- Toggling adds/removes the `dark` class on `document.documentElement`
- Writes `'dark'` or `'light'` to `localStorage.setItem('theme', ...)`
- The toggle is a **self-contained component** `DarkModeToggle` in `src/components/DarkModeToggle.tsx`

### 3.2 Toggle Visual

Custom pill switch (no external library):

- Container: `w-10 h-[22px] rounded-full transition-colors cursor-pointer`
  - OFF: `bg-border` (gray)
  - ON: `bg-primary` (orange)
- Thumb: `w-[18px] h-[18px] rounded-full bg-white shadow-sm absolute transition-transform`
  - OFF: `translate-x-0` (left)
  - ON: `translate-x-[18px]` (right)
- Accessible: `role="switch"`, `aria-checked={isDark}`, `aria-label="Toggle dark mode"`

### 3.3 Initialization

`main.tsx` (or a small inline script tag in `index.html`) must apply the saved theme before React hydrates to avoid a flash of unstyled content (FOUC). Add to `index.html` `<head>` before any stylesheet:

```html
<script>
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.classList.add('dark')
  }
</script>
```

---

## 4. Dark Mode CSS Variables

Add a `.dark` block to `src/index.css` immediately after the `:root` block:

```css
.dark {
  --background: #1C1917;       /* stone-900 */
  --foreground: #FAFAF9;       /* stone-50 */
  --muted: #A8A29E;            /* stone-400 */
  --input-bg: #292524;         /* stone-800 */
  --border: #44403C;           /* stone-700 */
}
```

Primary orange (`#FF6B35`) stays the same in both modes — it's the brand color.

---

## 5. BottomNav Dark Mode

`BottomNav.tsx` currently has hardcoded `bg-white`. Add dark variants:

- `bg-white dark:bg-stone-900`
- `border-t border-border dark:border-stone-700`

The `text-primary` / `text-muted` classes already use CSS variables so they pick up dark values automatically.

---

## 6. Files Changed

| File | Change |
|------|--------|
| `src/pages/ProfilePage.tsx` | Full replacement with centered card layout |
| `src/components/DarkModeToggle.tsx` | New component |
| `src/index.css` | Add `.dark` CSS variable block |
| `src/components/BottomNav.tsx` | Add `dark:` classes |
| `index.html` | Add FOUC-prevention script in `<head>` |

---

## 7. Out of Scope

- User avatar image upload
- Editable name
- Actual Stripe/payment integration (button renders but has no `onClick`)
- Auth/user store (mock constant only)
- Tests for `ProfilePage` (purely presentational, mock data — tested via visual review)
- Tests for `DarkModeToggle` (DOM manipulation via `document.documentElement` — integration tested manually)
