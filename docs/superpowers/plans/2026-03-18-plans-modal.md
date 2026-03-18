# Plans Modal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Upgrade to Premium/Pro" button on ProfilePage with a "Plans" button that opens a modal showing all three subscription tiers with billing toggle.

**Architecture:** Two files only — a new `PlansModal` component (self-contained, all local state) and a small modification to `ProfilePage` to wire the button and modal. No store changes, no Supabase calls, no Stripe integration (stubs only).

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-03-18-plans-modal-design.md`

---

## Chunk 1: PlansModal component + ProfilePage wiring

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/PlansModal.tsx` | Create | Full-screen modal with billing toggle and three plan cards |
| `src/components/PlansModal.test.tsx` | Create | 11 tests covering rendering, toggle, closing, focus, CTA states |
| `src/pages/ProfilePage.tsx` | Modify | Button label → "Plans", add showPlans state, wire modal |

---

### Task 1: Create PlansModal with TDD

**Files:**
- Create: `src/components/PlansModal.tsx`
- Create: `src/components/PlansModal.test.tsx`

- [ ] **Step 1: Write failing tests — create `src/components/PlansModal.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PlansModal from './PlansModal'

function renderModal(props: Partial<React.ComponentProps<typeof PlansModal>> = {}) {
  return render(
    <PlansModal
      open={true}
      onClose={vi.fn()}
      currentPlan="free"
      {...props}
    />
  )
}

describe('PlansModal', () => {
  it('renders all three plan cards', () => {
    renderModal()
    expect(screen.getByText('FREE')).toBeInTheDocument()
    expect(screen.getByText('PREMIUM')).toBeInTheDocument()
    expect(screen.getByText(/PRO/)).toBeInTheDocument()
  })

  it('focuses the close button when opened', () => {
    renderModal()
    expect(document.activeElement).toBe(screen.getByLabelText('Close'))
  })

  it('returns focus to previously focused element on unmount', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const { unmount } = renderModal()
    unmount()
    expect(document.activeElement).toBe(trigger)
    document.body.removeChild(trigger)
  })

  it('shows annual prices by default', () => {
    renderModal()
    expect(screen.getByText('R$159')).toBeInTheDocument()
    expect(screen.getByText('R$329')).toBeInTheDocument()
  })

  it('switches to monthly prices when Monthly toggle is clicked', () => {
    renderModal()
    fireEvent.click(screen.getByText('Monthly'))
    expect(screen.getByText('R$19')).toBeInTheDocument()
    expect(screen.getByText('R$39')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows disabled "Current plan" on Free card when currentPlan is free', () => {
    renderModal({ currentPlan: 'free' })
    const btn = screen.getByRole('button', { name: /current plan/i })
    expect(btn).toBeDisabled()
  })

  it('shows disabled "Current plan" on Premium card when currentPlan is premium', () => {
    renderModal({ currentPlan: 'premium' })
    // Premium card has "Current plan", Free card has no CTA
    const currentPlanBtns = screen.getAllByRole('button', { name: /current plan/i })
    expect(currentPlanBtns).toHaveLength(1)
    // Free card CTA is absent
    expect(screen.queryByRole('button', { name: /get premium/i })).not.toBeInTheDocument()
  })

  it('shows "Get Pro" button for both currentPlan values', () => {
    const { rerender } = renderModal({ currentPlan: 'free' })
    expect(screen.getByRole('button', { name: /get pro/i })).toBeInTheDocument()

    rerender(<PlansModal open={true} onClose={vi.fn()} currentPlan="premium" />)
    expect(screen.getByRole('button', { name: /get pro/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify they ALL fail**

```bash
pnpm exec vitest run src/components/PlansModal.test.tsx 2>&1
```

Expected: All 11 tests FAIL with "Cannot find module './PlansModal'".

- [ ] **Step 3: Create `src/components/PlansModal.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'

interface PlansModalProps {
  open: boolean
  onClose: () => void
  currentPlan: 'free' | 'premium'
}

const PRICES = {
  monthly: { premium: 'R$19', pro: 'R$39' },
  annual:  { premium: 'R$159', pro: 'R$329' },
}

const ANNUAL_EQUIV = { premium: 'R$13,25/mês', pro: 'R$27,40/mês' }

export default function PlansModal({ open, onClose, currentPlan }: PlansModalProps) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<Element | null>(null)

  // Save the element that had focus before the modal opened
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement
      // Focus the close button on open
      closeRef.current?.focus()
    } else {
      // Return focus on close
      ;(returnFocusRef.current as HTMLElement | null)?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      // Return focus when unmounted while open
      ;(returnFocusRef.current as HTMLElement | null)?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      {/* Modal panel — stop click propagation so backdrop click doesn't trigger from panel */}
      <div
        className="relative w-full max-w-md rounded-2xl bg-[#1a1a2e] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          ref={closeRef}
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-300 text-lg leading-none"
        >
          ✕
        </button>

        {/* Header */}
        <h2 className="text-white text-lg font-bold mb-1">Choose your plan</h2>
        <p className="text-gray-400 text-xs mb-5">Upgrade anytime. Cancel anytime.</p>

        {/* Billing toggle */}
        <div className="flex bg-black/40 rounded-full p-1 w-fit mb-6">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              billing === 'monthly' ? 'bg-[#4f8ef7] text-white' : 'text-gray-400'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              billing === 'annual' ? 'bg-[#4f8ef7] text-white' : 'text-gray-400'
            }`}
          >
            Annual{' '}
            <span className={`text-[10px] ${billing === 'annual' ? 'bg-white/20' : 'bg-gray-700'} rounded-full px-1.5 py-0.5`}>
              −30%
            </span>
          </button>
        </div>

        {/* Plan cards — desktop: 3 columns; mobile: stacked */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-start sm:pt-4 overflow-visible">

          {/* Free card */}
          <div className="sm:flex-[0.8] sm:mt-6 bg-[#222236] rounded-xl p-4">
            <span className="text-[10px] font-bold tracking-wider text-gray-400 bg-gray-700 rounded-full px-2 py-0.5">
              FREE
            </span>
            <div className="text-white text-2xl font-extrabold mt-3 mb-0.5">R$0</div>
            <div className="text-gray-500 text-xs mb-4">sempre grátis</div>
            <ul className="text-xs text-gray-400 space-y-1.5 mb-4">
              <li>✓ 1 viagem</li>
              <li>✓ Até 10 eventos por viagem</li>
            </ul>
            {currentPlan === 'free' ? (
              <button disabled className="w-full bg-gray-600 text-gray-400 rounded-lg py-2 text-xs font-semibold cursor-not-allowed">
                Current plan
              </button>
            ) : null}
          </div>

          {/* Premium card — featured center */}
          <div className="sm:flex-[1.15] relative bg-[#0d1f3f] border-2 border-[#4f8ef7] rounded-xl p-4">
            {/* Most popular badge */}
            <div className="hidden sm:block absolute -top-3 left-1/2 -translate-x-1/2 bg-[#4f8ef7] text-white text-[9px] font-extrabold tracking-widest rounded-full px-3 py-1 whitespace-nowrap">
              MOST POPULAR
            </div>
            <span className="text-[10px] font-bold tracking-wider text-[#4f8ef7] bg-[#1a3a6e] rounded-full px-2 py-0.5">
              PREMIUM
            </span>
            <div className="text-white text-2xl font-extrabold mt-3 mb-0.5">
              {PRICES[billing].premium}
              {billing === 'annual' ? <span className="text-xs text-gray-400 font-normal"> /ano</span> : <span className="text-xs text-gray-400 font-normal"> /mês</span>}
            </div>
            {billing === 'annual' && (
              <div className="text-[#4f8ef7] text-[10px] mb-4">= {ANNUAL_EQUIV.premium} · economize R$69</div>
            )}
            {billing === 'monthly' && <div className="mb-4" />}
            <ul className="text-xs text-gray-300 space-y-1.5 mb-4">
              <li>✓ Até 10 viagens</li>
              <li>✓ Até 30 eventos por viagem</li>
              <li>✓ Compartilhar viagens</li>
            </ul>
            {currentPlan === 'premium' ? (
              <button disabled className="w-full bg-[#4f8ef7]/40 text-[#4f8ef7] rounded-lg py-2 text-xs font-semibold cursor-not-allowed">
                Current plan
              </button>
            ) : (
              <button
                onClick={() => console.log('checkout: premium')}
                className="w-full bg-[#4f8ef7] text-white rounded-lg py-2 text-xs font-bold hover:bg-[#3a7de0] transition-colors"
              >
                Get Premium
              </button>
            )}
          </div>

          {/* Pro card */}
          <div className="sm:flex-[0.8] sm:mt-6 bg-[#1e1408] border border-[#92400e] rounded-xl p-4">
            <span className="text-[10px] font-bold tracking-wider text-[#d97706] bg-[#451a03] rounded-full px-2 py-0.5">
              PRO ✦
            </span>
            <div className="text-white text-2xl font-extrabold mt-3 mb-0.5">
              {PRICES[billing].pro}
              {billing === 'annual' ? <span className="text-xs text-gray-400 font-normal"> /ano</span> : <span className="text-xs text-gray-400 font-normal"> /mês</span>}
            </div>
            {billing === 'annual' && (
              <div className="text-[#d97706] text-[10px] mb-4">= {ANNUAL_EQUIV.pro} · economize R$139</div>
            )}
            {billing === 'monthly' && <div className="mb-4" />}
            <ul className="text-xs text-gray-400 space-y-1.5 mb-4">
              <li>✓ Até 30 viagens</li>
              <li>✓ Eventos ilimitados</li>
              <li>✓ Compartilhar viagens</li>
            </ul>
            <button
              onClick={() => console.log('checkout: pro')}
              className="w-full bg-gradient-to-r from-amber-600 to-amber-400 text-white rounded-lg py-2 text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Get Pro
            </button>
          </div>

        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-[10px] mt-5">
          Pagamento seguro via Stripe · Cancele quando quiser
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify all 11 pass**

```bash
pnpm exec vitest run src/components/PlansModal.test.tsx 2>&1
```

Expected: `11 passed`.

- [ ] **Step 5: Run all tests to verify nothing broken**

```bash
pnpm exec vitest run 2>&1
```

Expected: All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlansModal.tsx src/components/PlansModal.test.tsx
git commit -m "feat: add PlansModal — plans pricing modal with billing toggle"
```

---

### Task 2: Wire PlansModal into ProfilePage

**Files:**
- Modify: `src/pages/ProfilePage.tsx`

- [ ] **Step 1: Read current ProfilePage**

Read `src/pages/ProfilePage.tsx` in full.

- [ ] **Step 2: Modify ProfilePage**

Make these changes to `src/pages/ProfilePage.tsx`:

1. Add import at the top:
```tsx
import { useState } from 'react'
import PlansModal from '@/components/PlansModal'
```

2. Inside the component, add state:
```tsx
const [showPlans, setShowPlans] = useState(false)
```

3. Replace the upgrade card button (the `<Button className="w-full">` that says "Upgrade to..."):
```tsx
<Button className="w-full" onClick={() => setShowPlans(true)}>
  Plans
</Button>
```

4. After the upgrade card `</div>` (still inside the outer `<div className="w-full max-w-sm...">`), add the modal:
```tsx
{showPlans && (
  <PlansModal
    open={showPlans}
    onClose={() => setShowPlans(false)}
    currentPlan={plan === 'pro' ? 'free' : plan}
  />
)}
```

> Note: `plan` is currently hardcoded as `'free'` so the cast `plan === 'pro' ? 'free' : plan` is a safety measure for when Plan 4 wires real plan data — it prevents passing `'pro'` to PlansModal since Pro users should never see the Plans button anyway. The button is already hidden for `pro` via `{plan !== 'pro' && (...)}`.

- [ ] **Step 3: Build to verify TypeScript**

```bash
pnpm build 2>&1
```

Expected: No TypeScript errors.

- [ ] **Step 4: Run all tests**

```bash
pnpm exec vitest run 2>&1
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProfilePage.tsx
git commit -m "feat: wire Plans button and PlansModal into ProfilePage"
```

---

## Summary

When complete:
- `pnpm exec vitest run` → All tests pass (PlansModal × 11 + all existing)
- `pnpm build` → No TypeScript errors
- ProfilePage "Plans" button opens modal with Free / Premium (featured) / Pro cards
- Billing toggle switches between monthly and annual prices (annual default)
- Modal closes on ✕, backdrop click, and Escape key
- Badge colors on ProfilePage unchanged (gray / blue / amber gradient)
