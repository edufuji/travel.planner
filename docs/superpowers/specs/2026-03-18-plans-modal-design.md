# TripMate Plans Modal — Design Spec

## Overview

Replace the "Upgrade to Premium" / "Upgrade to Pro" button on ProfilePage with a single **"Plans" button** that opens a full-screen modal displaying all three subscription tiers side-by-side. The modal uses a center-featured layout (layout B) with Premium highlighted as the most popular plan. A billing toggle lets the user switch between monthly and annual pricing (annual = 30% discount).

---

## Subscription Tiers

| Plan | Monthly | Annual | Savings |
|------|---------|--------|---------|
| Free | R$0 | R$0 | — |
| Premium | R$19/mo | R$159/year (= R$13.25/mo) | ~R$69/year |
| Pro | R$39/mo | R$329/year (= R$27.4/mo) | ~R$139/year |

### Feature bullets per plan

**Free**
- 1 trip
- Up to 10 events per trip

**Premium**
- Up to 10 trips
- Up to 30 events per trip
- Share trips

**Pro**
- Up to 30 trips
- Unlimited events per trip
- Share trips

---

## Components

### `src/components/PlansModal.tsx` — new

A modal overlay component with the following structure:

```
PlansModal
├── Backdrop (dark overlay, click to close)
└── Modal panel
    ├── Close button (✕, top-right)
    ├── Header: "Choose your plan" + subtitle
    ├── BillingToggle (Monthly | Annual −30%)
    └── PlanCards row
        ├── FreeCard    (flex: 0.8, offset down 24px, gray theme)
        ├── PremiumCard (flex: 1.15, centered, blue theme, "MOST POPULAR" badge)
        └── ProCard     (flex: 0.8, offset down 24px, amber theme)
```

**Props:**
```ts
interface PlansModalProps {
  open: boolean
  onClose: () => void
  currentPlan: 'free' | 'premium'  // 'pro' excluded — modal is never opened for Pro users
}
```

**Billing toggle state:** local `useState<'monthly' | 'annual'>`, defaults to `'annual'`.

**Card structure (per plan):**
- Colored badge label (FREE / PREMIUM / PRO ✦)
- Price display (switches with billing toggle)
- Per-month equivalent line when annual is selected
- Feature bullets with ✓ checkmarks
- CTA button (see CTA Behavior below)

**Visual themes:**

| Plan | Background | Border | Label color |
|------|-----------|--------|-------------|
| Free | `#222236` | none | gray `#555` |
| Premium | `#0d1f3f` | `2px solid #4f8ef7` | blue `#4f8ef7` |
| Pro | `#1e1408` | `1px solid #92400e` | amber `#d97706` |

**"MOST POPULAR" badge:** absolute positioned (`top: -11px`, `left: 50%`, `translateX(-50%)`), centered on top edge of Premium card, blue background. The cards row must have `overflow: visible` and `padding-top: 16px` to prevent clipping.

**CTA button behavior:**

| Card | `currentPlan='free'` | `currentPlan='premium'` |
|------|---------------------|------------------------|
| Free | Disabled "Current plan" gray button | No button (downgrade path is not surfaced — intentional) |
| Premium | "Get Premium" → `console.log('checkout: premium')` | Disabled "Current plan" blue button |
| Pro | "Get Pro" → `console.log('checkout: pro')` | "Get Pro" → `console.log('checkout: pro')` |

No downgrade path is exposed anywhere in the modal. This is intentional.

**Footer:** "Secure payment via Stripe · Cancel anytime" — small, centered, muted text.

**Closing:** clicking the backdrop or ✕ button calls `onClose()`. `Escape` key also closes the modal. Focus is trapped inside the modal while open (focus returns to the trigger button on close).

**Mounting:** the modal is conditionally rendered — `{showPlans && <PlansModal ... />}`. This means local state (billing toggle) resets to `'annual'` every time the modal is opened. This is intentional.

**Responsive layout:** on screens narrower than 480px the three cards stack vertically (Free on top, Premium in middle, Pro at bottom). The "MOST POPULAR" badge and card size differences are removed in the stacked layout — all cards are equal width. The modal itself is full-width with `mx-4` padding on mobile.

**Billing toggle "−30%":** this is a fixed label string, not dynamically computed.

---

### `src/pages/ProfilePage.tsx` — modified

**Button changes:**
- Label: always `"Plans"` (was `"Upgrade to Premium"` / `"Upgrade to Pro"`)
- Shown for: `free` and `premium` plans only — hidden for `pro` (Pro users have no upgrade path in the UI)
- On click: sets `showPlans = true` (local `useState`)

**PlansModal integration:**
```tsx
const [showPlans, setShowPlans] = useState(false)

// In JSX:
<Button onClick={() => setShowPlans(true)}>Plans</Button>
<PlansModal open={showPlans} onClose={() => setShowPlans(false)} currentPlan={plan} />
```

**Plan badge colors** (no change needed — already correct):
- Free: `bg-stone-500` (gray)
- Premium: `bg-blue-500` (blue)
- Pro: `bg-gradient-to-r from-amber-400 to-amber-600` (amber gradient)

---

## Data Flow

```
ProfilePage
  └── plan (hardcoded 'free' until Plan 4 adds useProfileStore)
  └── showPlans: boolean (local state)
      └── PlansModal
            └── billingCycle: 'monthly' | 'annual' (local state)
            └── onClose → setShowPlans(false)
            └── CTA buttons → console.log for now (Plan 4: POST /checkout)
```

No store changes. No Supabase calls. Entirely local UI state.

---

## Error Handling

None required for this scope — the CTA buttons are stubs. Plan 4 will add error handling when Stripe checkout is wired.

---

## Testing

- `PlansModal.test.tsx` (all tests use `currentPlan='free'` unless stated):
  - Renders all three plan cards
  - Billing toggle switches displayed prices (annual by default, monthly on toggle click)
  - Close button (✕) calls `onClose`
  - Backdrop click calls `onClose`
  - Escape key calls `onClose`
  - Free card shows disabled "Current plan" button when `currentPlan='free'`
  - Premium card shows disabled "Current plan" button when `currentPlan='premium'`
  - Free card shows no CTA button when `currentPlan='premium'`
  - Pro card CTA "Get Pro" visible for both `currentPlan='free'` and `currentPlan='premium'`

---

## Out of Scope

- Actual Stripe checkout (Plan 4)
- Reading real plan from Supabase `profiles` table (Plan 4)
- Business plan contact flow (Plan 4)
- Animations/transitions on modal open/close

---

## File Map

| File | Action |
|------|--------|
| `src/components/PlansModal.tsx` | Create |
| `src/pages/ProfilePage.tsx` | Modify — button label + modal state |
