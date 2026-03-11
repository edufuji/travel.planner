# Travel App — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Vite + React + TypeScript travel planning app with a warm design system and a fully functional (UI-only) login screen.

**Architecture:** Single-page app with React Router. Design tokens defined as CSS custom properties wired into Tailwind v3. Login screen is a stateful React component with client-side validation and a mock loading state.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS v3, shadcn/ui, React Router v6, @fontsource/inter, react-icons, lucide-react, Vitest, @testing-library/react

**Spec:** `docs/superpowers/specs/2026-03-11-travel-app-phase1-design.md`

---

## Chunk 1: Project Setup

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Updated by Vite scaffold + installs |
| `vite.config.ts` | Modify | Add path alias + Vitest config |
| `tsconfig.json` | Modify | Add path alias |
| `tsconfig.app.json` | Modify | Add path alias (Vite template creates both) |
| `src/test-setup.ts` | Create | Import jest-dom matchers |
| `components.json` | Create | shadcn/ui config (auto-generated) |

---

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Scaffold the project**

```bash
pnpm create vite@latest . -- --template react-ts
```

Expected output: Files created — `package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `src/App.tsx`, etc.

- [ ] **Step 2: Install base dependencies**

```bash
pnpm install
```

Expected: `node_modules` created, no errors.

- [ ] **Step 3: Verify dev server starts**

```bash
pnpm dev
```

Expected: Server starts at `http://localhost:5173`. Open browser — default Vite React page visible. Stop with `Ctrl+C`.

---

### Task 2: Install and configure Tailwind CSS v3

**Files:**
- Create: `postcss.config.js`, `tailwind.config.js`
- Modify: `src/index.css`

- [ ] **Step 1: Install Tailwind v3**

```bash
pnpm install -D tailwindcss@3 postcss autoprefixer
```

Expected: tailwindcss@3.x installed.

- [ ] **Step 2: Generate Tailwind config**

```bash
npx tailwindcss init -p
```

Expected: `tailwind.config.js` and `postcss.config.js` created.

- [ ] **Step 3: Verify tailwind.config.js is .js not .ts**

The file should be named `tailwind.config.js`. If it was created as `.ts`, rename it:
```bash
mv tailwind.config.ts tailwind.config.js
```

- [ ] **Step 4: Set content paths in tailwind.config.js**

Replace the contents of `tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 5: Add Tailwind directives to src/index.css**

Replace all content in `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Verify Tailwind is working**

In `src/App.tsx`, temporarily add `className="bg-blue-500 text-white p-4"` to any element. Run `pnpm dev`. Blue background should appear. Remove the temp class after verifying.

---

### Task 3: Initialize shadcn/ui

**Files:**
- Create: `components.json`, `src/lib/utils.ts`
- Modify: `tailwind.config.js`, `src/index.css`

- [ ] **Step 1: Run shadcn init**

```bash
pnpm dlx shadcn-ui@latest init
```

When prompted:
- Style: **Default**
- Base color: **Slate** (we'll override with our own tokens after)
- CSS variables: **Yes**

Expected: `components.json` created, `src/lib/utils.ts` created, `tailwind.config.js` and `src/index.css` updated.

- [ ] **Step 2: Verify src/lib/utils.ts exists and exports cn()**

The file should contain:
```ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

If it does not look like this, shadcn init may have failed — re-run step 1.

---

### Task 4: Install remaining dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install app dependencies**

```bash
pnpm install react-router-dom @fontsource/inter react-icons lucide-react
```

Expected: All packages installed, no peer dep errors.

- [ ] **Step 2: Install test dependencies**

```bash
pnpm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Expected: Test packages installed.

---

### Task 5: Configure path alias (@/) and Vitest

**Files:**
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json` (or `tsconfig.json` if app-specific one doesn't exist)
- Create: `src/test-setup.ts`

- [ ] **Step 1: Update vite.config.ts**

Replace contents:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 2: Install @types/node**

```bash
pnpm install -D @types/node
```

- [ ] **Step 3: Add path alias to tsconfig.app.json**

Open `tsconfig.app.json`. In `compilerOptions`, add:

```json
"baseUrl": ".",
"paths": {
  "@/*": ["./src/*"]
}
```

If `tsconfig.app.json` doesn't exist, add to `tsconfig.json` instead.

- [ ] **Step 4: Create src/test-setup.ts**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Verify Vitest is wired up**

```bash
pnpm exec vitest run
```

Expected: "No test files found" or exits with 0 tests. No config errors. (Some Vitest versions exit with a non-zero code when no tests are found — this is expected and not a failure.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite+React+TS with Tailwind v3, shadcn/ui, Vitest"
```

---

## Chunk 2: Design System + App Shell

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `tailwind.config.js` | Modify | Add design tokens (colors, fontFamily) |
| `src/index.css` | Modify | Add CSS custom properties to :root |
| `src/main.tsx` | Rewrite | Font imports + mount app |
| `src/App.tsx` | Rewrite | React Router setup |

---

### Task 6: Configure design tokens

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Replace tailwind.config.js content**

```js
const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          dark: 'var(--primary-dark)',
          light: 'var(--primary-light)',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted: 'var(--muted)',
        'input-bg': 'var(--input-bg)',
        border: 'var(--border)',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

- [ ] **Step 2: Install tailwindcss-animate (shadcn dependency)**

```bash
pnpm install -D tailwindcss-animate
```

---

### Task 7: Add CSS custom properties

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Append design tokens to :root in src/index.css**

Open `src/index.css`. Find the `:root {` block that shadcn generated. Append our tokens **inside** the existing `:root {}` block (add after the last shadcn variable, before the closing `}`):

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
```

Also add/update the body rule (after `}` of `:root`):

```css
body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: 'Inter', sans-serif;
}
```

---

### Task 8: Configure main.tsx

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Replace src/main.tsx**

```tsx
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

---

### Task 9: Set up React Router in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace src/App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Create placeholder LoginPage so App compiles**

Create `src/pages/LoginPage.tsx`:

```tsx
// placeholder — replaced in Task 12
export default function LoginPage() {
  return <div>Login</div>
}
```

- [ ] **Step 3: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 4: Open http://localhost:5173 — verify browser redirects to /login and shows "Login". Stop server with Ctrl+C.**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add design system tokens and React Router shell"
```

---

## Chunk 3: Login Screen

### File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/GlassCard.tsx` | Create | Reusable frosted-glass card wrapper |
| `src/pages/LoginPage.tsx` | Rewrite | Full login screen with form, validation, loading |
| `src/pages/LoginPage.test.tsx` | Create | Tests for LoginPage behavior |

---

### Task 10: Create GlassCard component

**Files:**
- Create: `src/components/GlassCard.tsx`

- [ ] **Step 1: Create src/components/GlassCard.tsx**

```tsx
import { cn } from '@/lib/utils'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
}

export default function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn('relative z-10', className)}
      style={{
        background: 'rgba(255,250,246,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.5)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        borderRadius: '20px',
      }}
    >
      {children}
    </div>
  )
}
```

---

### Task 11: Write failing tests for LoginPage

**Files:**
- Create: `src/pages/LoginPage.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'
import LoginPage from './LoginPage'

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders "Welcome back" heading', () => {
    renderLoginPage()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })

  it('renders subheading copy', () => {
    renderLoginPage()
    expect(screen.getByText('Sign in to continue planning your adventures')).toBeInTheDocument()
  })

  it('renders email and password inputs', () => {
    renderLoginPage()
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('renders social login buttons', () => {
    renderLoginPage()
    expect(screen.getByText('Continue with Google')).toBeInTheDocument()
    expect(screen.getByText('Continue with Apple')).toBeInTheDocument()
  })

  it('shows errors when submitting with empty fields', () => {
    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(screen.getByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
  })

  it('shows error for invalid email format', () => {
    renderLoginPage()
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'notanemail' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
  })

  it('does not show errors on valid input', () => {
    renderLoginPage()
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
    expect(screen.queryByText('Password is required')).not.toBeInTheDocument()
  })

  it('disables the Sign In button during loading', () => {
    vi.useFakeTimers()
    renderLoginPage()
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('re-enables the button and restores Sign In text after 1 second', async () => {
    vi.useFakeTimers()
    renderLoginPage()
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    vi.advanceTimersByTime(1000)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    )
  })
})
```

- [ ] **Step 2: Run tests — verify they ALL fail**

```bash
pnpm exec vitest run src/pages/LoginPage.test.tsx
```

Expected: All 9 tests FAIL. The placeholder `LoginPage` returns `<div>Login</div>` so none of the assertions should pass. If any pass unexpectedly, investigate before proceeding.

---

### Task 12: Implement LoginPage

**Files:**
- Rewrite: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Replace src/pages/LoginPage.tsx**

```tsx
import { useState } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { FaApple } from 'react-icons/fa'
import { Loader2 } from 'lucide-react'
import GlassCard from '@/components/GlassCard'

interface FormErrors {
  email?: string
  password?: string
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!email) {
      errs.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Enter a valid email address'
    }
    if (!password) {
      errs.password = 'Password is required'
    }
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setLoading(true)
    setTimeout(() => setLoading(false), 1000)
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{
        background:
          'linear-gradient(rgba(26,10,0,0.45), rgba(26,10,0,0.55)), linear-gradient(135deg, #C75B2A, #FF8C42, #F7C59F, #EFEFD0)',
      }}
    >
      {/* Logo */}
      <div className="absolute top-5 left-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-base">
          ✈
        </div>
        <span className="text-white font-bold text-lg">TripMate</span>
      </div>

      {/* Tagline */}
      <div className="absolute bottom-6 left-6 hidden sm:block">
        <p className="text-white font-extrabold" style={{ fontSize: '28px' }}>
          Plan your trip. Your way.
        </p>
        <p className="text-white/55 text-sm">
          No agencies. No hassle. Just you and the world.
        </p>
      </div>

      {/* Glass Card */}
      <GlassCard className="w-full max-w-[400px] p-9 sm:rounded-[20px] rounded-none sm:min-h-0 min-h-screen sm:pt-9 pt-20 px-6 sm:px-9 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-extrabold text-foreground">
            Welcome back
          </h1>
          <p className="text-sm text-muted mt-1">
            Sign in to continue planning your adventures
          </p>
        </div>

        {/* Social buttons */}
        <div className="flex gap-2.5 mb-5">
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-border rounded-xl py-2.5 text-sm font-medium text-foreground hover:bg-input-bg transition-colors"
          >
            <FcGoogle size={16} />
            Continue with Google
          </button>
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-2 bg-white border border-border rounded-xl py-2.5 text-sm font-medium text-foreground hover:bg-input-bg transition-colors"
          >
            <FaApple size={16} />
            Continue with Apple
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted">or continue with email</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                errors.email ? 'border-red-500' : 'border-border'
              }`}
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-2">
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                errors.password ? 'border-red-500' : 'border-border'
              }`}
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* Forgot password */}
          <div className="text-right mb-5">
            <a href="#" className="text-xs text-primary font-medium">
              Forgot password?
            </a>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white rounded-xl py-3 text-[15px] font-bold shadow-[0_4px_14px_rgba(255,107,53,0.4)] hover:bg-primary-dark transition-colors disabled:opacity-70 flex items-center justify-center"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Sign up link */}
        <p className="text-center text-sm text-muted mt-5">
          Don't have an account?{' '}
          <a href="#" className="text-primary font-semibold">
            Create one
          </a>
        </p>
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests — verify all 9 pass**

```bash
pnpm exec vitest run src/pages/LoginPage.test.tsx
```

Expected: `9 passed`. If any fail, fix the component before proceeding.

- [ ] **Step 3: Run full build to check TypeScript**

```bash
pnpm build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Manual verification in browser**

```bash
pnpm dev
```

Check at `http://localhost:5173`:
1. Redirects to `/login`
2. Warm gradient background visible
3. "TripMate" logo top-left
4. "Plan your trip. Your way." tagline bottom-left (desktop only — use browser devtools to verify hidden on mobile)
5. Glass card centered with frosted-glass styling
6. Google and Apple buttons visible with icons
7. Email and password fields with correct labels and placeholders
8. Click "Sign In" with empty fields → red error messages appear under both fields
9. Fill valid email + any password → click "Sign In" → spinner appears in button for 1s → "Sign In" text returns, button re-enables
10. Resize to mobile width (<640px) → card fills screen, tagline hidden, card has no rounded corners

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement login screen with validation and loading state"
```

---

## Summary

When all chunks are complete:
- `pnpm dev` shows the login screen at `/login`
- `pnpm exec vitest run` — all 9 tests pass
- `pnpm build` — TypeScript compiles cleanly
- Login screen matches the design spec visually and behaviorally
