# TripMate Frontend Authentication — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the TripMate frontend to Supabase Auth — real login, signup, OAuth, protected routes, and a working logout.

**Tech Stack:** React 19, TypeScript, Tailwind, Zustand 5, React Router v7, Vitest + @testing-library/react, @supabase/supabase-js

**Spec:** `docs/superpowers/specs/2026-03-15-backend-stripe-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/supabase.ts` | Create | Supabase JS client singleton |
| `src/contexts/AuthContext.tsx` | Create | AuthProvider + useAuth hook |
| `src/contexts/AuthContext.test.tsx` | Create | Tests: loading state, user/session provision, signOut, cleanup |
| `src/components/ProtectedRoute.tsx` | Create | Redirects to /login if no session; spinner while loading |
| `src/components/ProtectedRoute.test.tsx` | Create | Tests: redirect, pass-through, spinner |
| `src/App.tsx` | Modify | Wrap with AuthProvider; protect /trips, /trips/:id, /profile; add /signup route |
| `src/pages/LoginPage.tsx` | Modify | Real auth: signInWithPassword + OAuth + navigate on success + error display |
| `src/pages/LoginPage.test.tsx` | Modify | Remove fake-timer tests; add: success nav, error message, OAuth |
| `src/pages/SignupPage.tsx` | Create | Signup form (name, email, password, confirm) + supabase.auth.signUp |
| `src/pages/SignupPage.test.tsx` | Create | Validation + signUp call + success message + error display |
| `src/pages/ProfilePage.tsx` | Modify | Real user from useAuth(); Logout button |

---

## Chunk 1: Foundation

### Task 1: Install @supabase/supabase-js and create Supabase client

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/lib/supabase.ts`
- Create: `.env.local` (developer creates manually — instructions below)

- [ ] **Step 1: Install the Supabase JS client**

Run from the project root:

```bash
npm install @supabase/supabase-js
```

Expected output (version may vary):

```
added 10 packages, and audited 621 packages in 4s
```

Verify it appears in `package.json` dependencies:

```bash
grep supabase package.json
```

Expected output:

```
    "@supabase/supabase-js": "^2.x.x",
```

- [ ] **Step 2: Create the Supabase client module**

Create `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: true, autoRefreshToken: true } }
)
```

- [ ] **Step 3: Document required env vars**

The developer must create `.env.local` in the project root (this file is gitignored and must not be committed):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Both values are found in the Supabase dashboard under **Project Settings → API**.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

### Task 2: Create AuthContext with TDD

**Files:**
- Create: `src/contexts/AuthContext.tsx`
- Create: `src/contexts/AuthContext.test.tsx`

- [ ] **Step 1: Write the tests first**

Create `src/contexts/AuthContext.test.tsx`:

```tsx
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

// ── Mock @/lib/supabase ──────────────────────────────────────────────────────

const mockUnsubscribe = vi.fn()
const mockGetSession = vi.fn()
const mockSignOut = vi.fn()
const mockOnAuthStateChange = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function TestConsumer() {
  const { user, session, loading } = useAuth()
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="user">{user ? user.email : 'no-user'}</span>
      <span data-testid="session">{session ? 'has-session' : 'no-session'}</span>
    </div>
  )
}

function SignOutConsumer() {
  const { signOut } = useAuth()
  return <button onClick={signOut}>Logout</button>
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<AuthProvider>{ui}</AuthProvider>)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mockUnsubscribe } } })
  })

  it('shows loading state initially', () => {
    // getSession never resolves during this test
    mockGetSession.mockReturnValue(new Promise(() => {}))
    renderWithProvider(<TestConsumer />)
    expect(screen.getByTestId('loading')).toHaveTextContent('loading')
  })

  it('shows ready after getSession resolves', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    renderWithProvider(<TestConsumer />)
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
    })
  })

  it('provides null user and no-session when getSession returns null', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    renderWithProvider(<TestConsumer />)
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
      expect(screen.getByTestId('session')).toHaveTextContent('no-session')
    })
  })

  it('provides user and session when getSession returns a session', async () => {
    const fakeSession = {
      user: { email: 'alice@example.com' },
    }
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } })
    renderWithProvider(<TestConsumer />)
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('alice@example.com')
      expect(screen.getByTestId('session')).toHaveTextContent('has-session')
    })
  })

  it('calls supabase.auth.signOut when signOut is invoked', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockSignOut.mockResolvedValue({})
    renderWithProvider(<SignOutConsumer />)
    await waitFor(() => expect(screen.getByText('Logout')).toBeInTheDocument())
    await act(async () => {
      screen.getByText('Logout').click()
    })
    expect(mockSignOut).toHaveBeenCalledOnce()
  })

  it('unsubscribes from onAuthStateChange on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const { unmount } = renderWithProvider(<TestConsumer />)
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('ready'))
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledOnce()
  })

  it('throws when useAuth is used outside AuthProvider', () => {
    // Suppress React error boundary noise in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider')
    consoleSpy.mockRestore()
  })
})
```

- [ ] **Step 2: Run the tests — they must all fail**

```bash
npx vitest run src/contexts/AuthContext.test.tsx
```

Expected: all 7 tests fail (module not found or similar).

- [ ] **Step 3: Implement AuthContext**

Create `src/contexts/AuthContext.tsx`:

```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 4: Run the tests — all must pass**

```bash
npx vitest run src/contexts/AuthContext.test.tsx
```

Expected output:

```
 ✓ src/contexts/AuthContext.test.tsx (6)
   ✓ AuthContext > shows loading state initially
   ✓ AuthContext > shows ready after getSession resolves
   ✓ AuthContext > provides null user and no-session when getSession returns null
   ✓ AuthContext > provides user and session when getSession returns a session
   ✓ AuthContext > calls supabase.auth.signOut when signOut is invoked
   ✓ AuthContext > unsubscribes from onAuthStateChange on unmount
   ✓ AuthContext > throws when useAuth is used outside AuthProvider

Test Files  1 passed (1)
Tests  7 passed (7)
```

---

### Task 3: Create ProtectedRoute and update App.tsx with TDD

**Files:**
- Create: `src/components/ProtectedRoute.tsx`
- Create: `src/components/ProtectedRoute.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the ProtectedRoute tests first**

Create `src/components/ProtectedRoute.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'

// ── Mock useAuth ─────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderProtected(authState: { session: object | null; loading: boolean }) {
  mockUseAuth.mockReturnValue(authState)
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ProtectedRoute', () => {
  it('redirects to /login when not loading and no session', () => {
    renderProtected({ session: null, loading: false })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children when session exists', () => {
    renderProtected({ session: { user: {} }, loading: false })
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('shows loading spinner while auth is resolving', () => {
    renderProtected({ session: null, loading: true })
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests — they must all fail**

```bash
npx vitest run src/components/ProtectedRoute.test.tsx
```

Expected: all 3 tests fail (module not found).

- [ ] **Step 3: Implement ProtectedRoute**

Create `src/components/ProtectedRoute.tsx`:

```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: Props) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div
          role="status"
          className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
        />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Run the ProtectedRoute tests — all must pass**

```bash
npx vitest run src/components/ProtectedRoute.test.tsx
```

Expected output:

```
 ✓ src/components/ProtectedRoute.test.tsx (3)
   ✓ ProtectedRoute > redirects to /login when not loading and no session
   ✓ ProtectedRoute > renders children when session exists
   ✓ ProtectedRoute > shows loading spinner while auth is resolving

Test Files  1 passed (1)
Tests  3 passed (3)
```

- [ ] **Step 5: Update App.tsx**

Replace the entire contents of `src/App.tsx` with:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import TripsPage from '@/pages/TripsPage'
import TripDetailPage from '@/pages/TripDetailPage'
import ProfilePage from '@/pages/ProfilePage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/trips" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/trips"
            element={
              <ProtectedRoute>
                <TripsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips/:id"
            element={
              <ProtectedRoute>
                <TripDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

Note: `SignupPage` does not exist yet — it is created in Task 5. The TypeScript compiler will error until then. This is expected.

- [ ] **Step 6: Run the full Chunk 1 test suite**

```bash
npx vitest run src/contexts/AuthContext.test.tsx src/components/ProtectedRoute.test.tsx
```

Expected output:

```
Test Files  2 passed (2)
Tests  10 passed (10)
```

---

## Chunk 2: Auth Pages

### Task 4: Update LoginPage to call Supabase auth

**Files:**
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/LoginPage.test.tsx`

- [ ] **Step 1: Update LoginPage.test.tsx**

Replace the entire contents of `src/pages/LoginPage.test.tsx` with:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginPage from './LoginPage'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockSignInWithPassword = vi.fn()
const mockSignInWithOAuth = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth,
    },
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

function fillAndSubmit(email = 'test@example.com', password = 'password123') {
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Existing render tests (unchanged)
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

  // Existing validation tests (unchanged)
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

  it('does not show errors on valid input', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null })
    renderLoginPage()
    fillAndSubmit()
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
    expect(screen.queryByText('Password is required')).not.toBeInTheDocument()
  })

  // New auth tests
  it('calls signInWithPassword with correct email and password on submit', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null })
    renderLoginPage()
    fillAndSubmit('alice@example.com', 'secret123')
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'secret123',
      })
    })
  })

  it('navigates to /trips on successful sign-in', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null })
    renderLoginPage()
    fillAndSubmit()
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/trips')
    })
  })

  it('shows auth error message on sign-in failure', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    })
    renderLoginPage()
    fillAndSubmit()
    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
  })

  it('disables the Sign In button while the auth request is in-flight', async () => {
    // Never resolves — simulates a pending request
    mockSignInWithPassword.mockReturnValue(new Promise(() => {}))
    renderLoginPage()
    fillAndSubmit()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('calls signInWithOAuth with google when Google button clicked', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null })
    renderLoginPage()
    fireEvent.click(screen.getByText('Continue with Google'))
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: expect.stringContaining('/trips') },
      })
    })
  })

  it('calls signInWithOAuth with apple when Apple button clicked', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null })
    renderLoginPage()
    fireEvent.click(screen.getByText('Continue with Apple'))
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'apple',
        options: { redirectTo: expect.stringContaining('/trips') },
      })
    })
  })
})
```

- [ ] **Step 2: Run the updated tests — new tests must fail, existing must pass**

```bash
npx vitest run src/pages/LoginPage.test.tsx
```

Expected: the 4 existing validation/render tests pass; the 6 new auth tests fail.

- [ ] **Step 3: Update LoginPage.tsx**

Replace the entire contents of `src/pages/LoginPage.tsx` with:

```tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FcGoogle } from 'react-icons/fc'
import { FaApple } from 'react-icons/fa'
import { Loader2 } from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import { supabase } from '@/lib/supabase'

interface FormErrors {
  email?: string
  password?: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [authError, setAuthError] = useState<string | null>(null)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setAuthError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError('Invalid email or password')
      setLoading(false)
      return
    }
    navigate('/trips')
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/trips' },
    })
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
            onClick={() => handleOAuth('google')}
            className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-transparent border border-border rounded-xl py-2.5 text-sm font-medium text-foreground hover:bg-input-bg transition-colors"
          >
            <FcGoogle size={16} />
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-transparent border border-border rounded-xl py-2.5 text-sm font-medium text-foreground hover:bg-input-bg transition-colors"
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
            <label htmlFor="email" className="block text-xs font-semibold text-foreground mb-1.5">
              Email address
            </label>
            <input
              id="email"
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
            <label htmlFor="password" className="block text-xs font-semibold text-foreground mb-1.5">
              Password
            </label>
            <input
              id="password"
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

          {/* Auth error */}
          {authError && (
            <p className="text-red-500 text-sm text-center mb-3">{authError}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            aria-label="Sign In"
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
          <Link to="/signup" className="text-primary font-semibold">
            Create one
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 4: Run the LoginPage tests — all must pass**

```bash
npx vitest run src/pages/LoginPage.test.tsx
```

Expected output:

```
 ✓ src/pages/LoginPage.test.tsx (13)
   ✓ LoginPage > renders "Welcome back" heading
   ✓ LoginPage > renders subheading copy
   ✓ LoginPage > renders email and password inputs
   ✓ LoginPage > renders social login buttons
   ✓ LoginPage > shows errors when submitting with empty fields
   ✓ LoginPage > shows error for invalid email format
   ✓ LoginPage > does not show errors on valid input
   ✓ LoginPage > calls signInWithPassword with correct email and password on submit
   ✓ LoginPage > navigates to /trips on successful sign-in
   ✓ LoginPage > shows auth error message on sign-in failure
   ✓ LoginPage > disables the Sign In button while the auth request is in-flight
   ✓ LoginPage > calls signInWithOAuth with google when Google button clicked
   ✓ LoginPage > calls signInWithOAuth with apple when Apple button clicked

Test Files  1 passed (1)
Tests  13 passed (13)
```

---

### Task 5: Create SignupPage with TDD

**Files:**
- Create: `src/pages/SignupPage.tsx`
- Create: `src/pages/SignupPage.test.tsx`

- [ ] **Step 1: Write the SignupPage tests first**

Create `src/pages/SignupPage.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SignupPage from './SignupPage'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSignUp = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
    },
  },
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderSignupPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>
  )
}

function fillForm({
  name = 'Alice Smith',
  email = 'alice@example.com',
  password = 'secret123',
  confirm = 'secret123',
}: {
  name?: string
  email?: string
  password?: string
  confirm?: string
} = {}) {
  fireEvent.change(screen.getByPlaceholderText('Your full name'), {
    target: { value: name },
  })
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByPlaceholderText('Min. 6 characters'), {
    target: { value: password },
  })
  fireEvent.change(screen.getByPlaceholderText('Repeat your password'), {
    target: { value: confirm },
  })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Create account" heading', () => {
    renderSignupPage()
    expect(screen.getByText('Create account')).toBeInTheDocument()
  })

  it('shows error when full name is empty', () => {
    renderSignupPage()
    fillForm({ name: '' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByText('Full name is required')).toBeInTheDocument()
  })

  it('shows error when email is invalid', () => {
    renderSignupPage()
    fillForm({ email: 'notanemail' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
  })

  it('shows error when password is less than 6 characters', () => {
    renderSignupPage()
    fillForm({ password: 'abc', confirm: 'abc' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
  })

  it('shows error when passwords do not match', () => {
    renderSignupPage()
    fillForm({ password: 'secret123', confirm: 'different' })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('calls supabase.signUp with correct values on valid submit', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null })
    renderSignupPage()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'secret123',
        options: { data: { full_name: 'Alice Smith' } },
      })
    })
  })

  it('shows success message after successful signup', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null })
    renderSignupPage()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(
        screen.getByText('Check your email to confirm your account.')
      ).toBeInTheDocument()
    })
  })

  it('shows Supabase error on failed signup', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    })
    renderSignupPage()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText('User already registered')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run the tests — all must fail**

```bash
npx vitest run src/pages/SignupPage.test.tsx
```

Expected: all 8 tests fail (module not found).

- [ ] **Step 3: Implement SignupPage**

Create `src/pages/SignupPage.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import { supabase } from '@/lib/supabase'

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirm?: string
}

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [authError, setAuthError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!name.trim()) {
      errs.name = 'Full name is required'
    }
    if (!email) {
      errs.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Enter a valid email address'
    }
    if (!password) {
      errs.password = 'Password is required'
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters'
    }
    if (password && confirm !== password) {
      errs.confirm = 'Passwords do not match'
    }
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setAuthError(null)
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    setLoading(false)
    if (error) {
      setAuthError(error.message)
      return
    }
    setSuccess(true)
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

      {/* Glass Card */}
      <GlassCard className="w-full max-w-[400px] p-9 sm:rounded-[20px] rounded-none sm:min-h-0 min-h-screen sm:pt-9 pt-20 px-6 sm:px-9 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-extrabold text-foreground">
            Create account
          </h1>
          <p className="text-sm text-muted mt-1">
            Join TripMate and start planning your adventures
          </p>
        </div>

        {success ? (
          <div className="text-center py-6">
            <p className="text-sm text-foreground font-medium">
              Check your email to confirm your account.
            </p>
            <p className="text-sm text-muted mt-2">
              Once confirmed,{' '}
              <Link to="/login" className="text-primary font-semibold">
                sign in here
              </Link>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
            <div className="mb-3">
              <label htmlFor="name" className="block text-xs font-semibold text-foreground mb-1.5">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                  errors.name ? 'border-red-500' : 'border-border'
                }`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="mb-3">
              <label htmlFor="email" className="block text-xs font-semibold text-foreground mb-1.5">
                Email address
              </label>
              <input
                id="email"
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
            <div className="mb-3">
              <label htmlFor="password" className="block text-xs font-semibold text-foreground mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                  errors.password ? 'border-red-500' : 'border-border'
                }`}
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="mb-5">
              <label htmlFor="confirm" className="block text-xs font-semibold text-foreground mb-1.5">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                  errors.confirm ? 'border-red-500' : 'border-border'
                }`}
              />
              {errors.confirm && (
                <p className="text-red-500 text-xs mt-1">{errors.confirm}</p>
              )}
            </div>

            {/* Auth error */}
            {authError && (
              <p className="text-red-500 text-sm text-center mb-3">{authError}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              aria-label="Create Account"
              className="w-full bg-primary text-white rounded-xl py-3 text-[15px] font-bold shadow-[0_4px_14px_rgba(255,107,53,0.4)] hover:bg-primary-dark transition-colors disabled:opacity-70 flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        )}

        {/* Sign in link */}
        <p className="text-center text-sm text-muted mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold">
            Sign in
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 4: Run the SignupPage tests — all must pass**

```bash
npx vitest run src/pages/SignupPage.test.tsx
```

Expected output:

```
 ✓ src/pages/SignupPage.test.tsx (8)
   ✓ SignupPage > renders "Create account" heading
   ✓ SignupPage > shows error when full name is empty
   ✓ SignupPage > shows error when email is invalid
   ✓ SignupPage > shows error when password is less than 6 characters
   ✓ SignupPage > shows error when passwords do not match
   ✓ SignupPage > calls supabase.signUp with correct values on valid submit
   ✓ SignupPage > shows success message after successful signup
   ✓ SignupPage > shows Supabase error on failed signup

Test Files  1 passed (1)
Tests  8 passed (8)
```

---

### Task 6: Update ProfilePage with real user data and logout

**Files:**
- Modify: `src/pages/ProfilePage.tsx`

Note: ProfilePage has no existing tests. The page is updated here; a ProfilePage test suite will be added in Plan 4 when the profile store is implemented.

- [ ] **Step 1: Update ProfilePage.tsx**

Replace the entire contents of `src/pages/ProfilePage.tsx` with:

```tsx
import { useNavigate } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import DarkModeToggle from '@/components/DarkModeToggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

type Plan = 'free' | 'premium' | 'pro'

const PLAN_BADGE: Record<Plan, { label: string; className: string }> = {
  free: { label: 'Free', className: 'bg-stone-500' },
  premium: { label: 'Premium', className: 'bg-blue-500' },
  pro: { label: 'Pro ✦', className: 'bg-gradient-to-r from-amber-400 to-amber-600' },
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  // Plan 4 will replace this with real data from the profile store
  const plan: Plan = 'free'
  const badge = PLAN_BADGE[plan]

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-4">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-input-bg border-2 border-border flex items-center justify-center">
          <span className="text-3xl">👤</span>
        </div>

        {/* Email (full_name available after Plan 4 adds profile store) */}
        <h1 className="text-xl font-extrabold text-foreground">
          {user?.email ?? 'Unknown'}
        </h1>

        {/* Plan badge */}
        <span
          className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full text-white ${badge.className}`}
        >
          {badge.label}
        </span>

        {/* Upgrade card — hidden for pro */}
        {plan !== 'pro' && (
          <div className="bg-white dark:bg-transparent border border-border rounded-xl p-4 w-full text-center">
            <p className="text-xs text-muted mb-3">
              You're on the <span className="font-semibold">{badge.label}</span> plan
            </p>
            <Button className="w-full">
              ⬆ {plan === 'free' ? 'Upgrade to Premium' : 'Upgrade to Pro'}
            </Button>
          </div>
        )}

        {/* Dark mode row */}
        <div className="bg-white dark:bg-transparent border border-border rounded-xl px-4 py-3 w-full flex justify-between items-center">
          <span className="text-sm font-semibold text-foreground">Dark mode</span>
          <DarkModeToggle />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full border border-red-400 text-red-500 rounded-xl py-3 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
        >
          Log out
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite to verify nothing is broken**

```bash
npx vitest run
```

Expected output (all tests pass):

```
Test Files  X passed (X)
Tests  XX passed (XX)
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.
