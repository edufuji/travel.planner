import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

// ── Mock @/lib/supabase ──────────────────────────────────────────────────────

const mockUnsubscribe = vi.hoisted(() => vi.fn())
const mockGetSession = vi.hoisted(() => vi.fn())
const mockSignOut = vi.hoisted(() => vi.fn())
const mockOnAuthStateChange = vi.hoisted(() => vi.fn())

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
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider')
    consoleSpy.mockRestore()
  })
})
