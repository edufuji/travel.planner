import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginPage from './LoginPage'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockSignInWithPassword = vi.hoisted(() => vi.fn())
const mockSignInWithOAuth = vi.hoisted(() => vi.fn())
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

  it('does not show errors on valid input', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {} }, error: null })
    renderLoginPage()
    fillAndSubmit()
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
    expect(screen.queryByText('Password is required')).not.toBeInTheDocument()
  })

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
