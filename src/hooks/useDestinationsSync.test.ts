import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDestinationsSync } from './useDestinationsSync'

const mockFetchDestinations = vi.hoisted(() => vi.fn())
const mockClearDestinations = vi.hoisted(() => vi.fn())
const mockUseAuth = vi.hoisted(() => vi.fn())

vi.mock('@/stores/tripsStore', () => ({
  useTripsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      fetchDestinations: mockFetchDestinations,
      clearDestinations: mockClearDestinations,
    }),
}))

vi.mock('@/contexts/AuthContext', () => ({ useAuth: mockUseAuth }))

beforeEach(() => {
  mockFetchDestinations.mockReset().mockResolvedValue(undefined)
  mockClearDestinations.mockReset()
})

describe('useDestinationsSync', () => {
  it('calls fetchDestinations with user id when user is logged in', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    renderHook(() => useDestinationsSync())
    expect(mockFetchDestinations).toHaveBeenCalledWith('user-1')
  })

  it('calls clearDestinations when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null })
    renderHook(() => useDestinationsSync())
    expect(mockClearDestinations).toHaveBeenCalled()
    expect(mockFetchDestinations).not.toHaveBeenCalled()
  })

  it('re-fetches when user id changes', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    const { rerender } = renderHook(() => useDestinationsSync())
    expect(mockFetchDestinations).toHaveBeenCalledTimes(1)

    mockUseAuth.mockReturnValue({ user: { id: 'user-2' } })
    rerender()
    expect(mockFetchDestinations).toHaveBeenCalledTimes(2)
    expect(mockFetchDestinations).toHaveBeenLastCalledWith('user-2')
  })

  it('clears destinations when user logs out', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-1' } })
    const { rerender } = renderHook(() => useDestinationsSync())

    mockUseAuth.mockReturnValue({ user: null })
    rerender()
    expect(mockClearDestinations).toHaveBeenCalled()
  })
})
