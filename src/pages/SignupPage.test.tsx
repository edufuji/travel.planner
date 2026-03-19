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
  fireEvent.change(screen.getByPlaceholderText('auth.fullNamePlaceholder'), {
    target: { value: name },
  })
  fireEvent.change(screen.getByPlaceholderText('auth.emailPlaceholder'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByPlaceholderText('auth.passwordMinPlaceholder'), {
    target: { value: password },
  })
  fireEvent.change(screen.getByPlaceholderText('auth.confirmPasswordPlaceholder'), {
    target: { value: confirm },
  })
}

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Create account" heading', () => {
    renderSignupPage()
    expect(screen.getByText('auth.createAccount')).toBeInTheDocument()
  })

  it('shows error when full name is empty', () => {
    renderSignupPage()
    fillForm({ name: '' })
    fireEvent.click(screen.getByRole('button', { name: 'auth.createAccountButton' }))
    expect(screen.getByText('auth.fullNameRequired')).toBeInTheDocument()
  })

  it('shows error when email is invalid', () => {
    renderSignupPage()
    fillForm({ email: 'notanemail' })
    fireEvent.click(screen.getByRole('button', { name: 'auth.createAccountButton' }))
    expect(screen.getByText('auth.emailInvalid')).toBeInTheDocument()
  })

  it('shows error when password is less than 6 characters', () => {
    renderSignupPage()
    fillForm({ password: 'abc', confirm: 'abc' })
    fireEvent.click(screen.getByRole('button', { name: 'auth.createAccountButton' }))
    expect(screen.getByText('auth.passwordTooShort')).toBeInTheDocument()
  })

  it('shows error when passwords do not match', () => {
    renderSignupPage()
    fillForm({ password: 'secret123', confirm: 'different' })
    fireEvent.click(screen.getByRole('button', { name: 'auth.createAccountButton' }))
    expect(screen.getByText('auth.passwordMismatch')).toBeInTheDocument()
  })

  it('calls supabase.signUp with correct values on valid submit', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {} }, error: null })
    renderSignupPage()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: 'auth.createAccountButton' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'auth.createAccountButton' }))
    await waitFor(() => {
      expect(
        screen.getByText('auth.checkEmailConfirm')
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
    fireEvent.click(screen.getByRole('button', { name: 'auth.createAccountButton' }))
    await waitFor(() => {
      expect(screen.getByText('User already registered')).toBeInTheDocument()
    })
  })
})
