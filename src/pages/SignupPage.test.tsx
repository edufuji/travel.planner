import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SignupPage from './SignupPage'

const mockSignUp = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
    },
  },
}))

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
