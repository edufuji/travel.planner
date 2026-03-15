import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'

const mockUseAuth = vi.hoisted(() => vi.fn())

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

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
