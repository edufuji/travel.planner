import { render, screen, fireEvent, act } from '@testing-library/react'
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
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
  })
})
