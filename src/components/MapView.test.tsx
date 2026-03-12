import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import MapView from './MapView'
import type { TripEvent } from '@/types/trip'

vi.mock('@googlemaps/js-api-loader', () => ({
  setOptions: vi.fn(),
  importLibrary: vi.fn().mockResolvedValue(undefined),
}))

function makeEvent(overrides: Partial<TripEvent>): TripEvent {
  return {
    id: 'ev-1',
    destinationId: 'dest-1',
    type: 'transport',
    title: 'Event',
    place: 'Somewhere',
    date: '2026-03-15',
    time: '10:00',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function stubGoogleMaps() {
  vi.stubGlobal('google', {
    maps: {
      Map: vi.fn(function () { return { fitBounds: vi.fn(), setCenter: vi.fn() } }),
      Marker: vi.fn(function () { return { addListener: vi.fn(), setMap: vi.fn() } }),
      Polyline: vi.fn(function () { return { setMap: vi.fn() } }),
      LatLngBounds: vi.fn(function () { return { extend: vi.fn(), isEmpty: vi.fn(function () { return false }) } }),
      SymbolPath: { CIRCLE: 0 },
      event: { clearInstanceListeners: vi.fn() },
    },
  })
}

describe('MapView', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('shows map-unavailable when VITE_GOOGLE_MAPS_API_KEY is not set', () => {
    render(<MapView events={[]} gaps={[]} onEdit={() => {}} />)
    expect(screen.getByTestId('map-unavailable')).toBeInTheDocument()
    expect(screen.getByText(/Map unavailable — add VITE_GOOGLE_MAPS_API_KEY/)).toBeInTheDocument()
  })

  describe('with API key', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key')
      stubGoogleMaps()
    })

    it('creates one Marker per event with lat/lng, none for events without coords', async () => {
      const events = [
        makeEvent({ id: 'a', lat: 35.0, lng: 139.0 }),
        makeEvent({ id: 'b', lat: 36.0, lng: 140.0 }),
        makeEvent({ id: 'c' }),  // no coords — must NOT create a marker
      ]
      render(<MapView events={events} gaps={[]} onEdit={() => {}} />)
      await act(async () => {})

      expect(google.maps.Marker).toHaveBeenCalledTimes(2)
    })

    it('shows map-no-location-banner when some events lack coordinates', async () => {
      const events = [
        makeEvent({ id: 'a', lat: 35.0, lng: 139.0 }),
        makeEvent({ id: 'b' }),  // no coords
      ]
      render(<MapView events={events} gaps={[]} onEdit={() => {}} />)
      await act(async () => {})

      expect(screen.getByTestId('map-no-location-banner')).toBeInTheDocument()
      expect(screen.getByTestId('map-no-location-banner')).toHaveTextContent(
        '1 event(s) not shown — no location data'
      )
    })

    it('creates a Polyline for each segment from buildMapSegments', async () => {
      // 3 positioned events → 2 consecutive pairs → 2 polylines
      const events = [
        makeEvent({ id: 'a', type: 'transport', lat: 35.0, lng: 139.0, date: '2026-03-15', time: '08:00' }),
        makeEvent({ id: 'b', type: 'accommodation', lat: 36.0, lng: 140.0, date: '2026-03-15', time: '22:00' }),
        makeEvent({ id: 'c', type: 'accommodation', lat: 37.0, lng: 141.0, date: '2026-03-18', time: '15:00' }),
      ]
      render(<MapView events={events} gaps={[]} onEdit={() => {}} />)
      await act(async () => {})

      expect(google.maps.Polyline).toHaveBeenCalledTimes(2)
    })

    it('calls onEdit when a marker click listener fires', async () => {
      const onEdit = vi.fn()
      const listenerCalls: Array<{ event: string; cb: () => void }> = []

      vi.mocked(google.maps.Marker).mockImplementation(function () {
        return {
          addListener: (event: string, cb: () => void) => { listenerCalls.push({ event, cb }) },
          setMap: vi.fn(),
        }
      })

      const events = [makeEvent({ id: 'ev-1', lat: 35.0, lng: 139.0 })]
      render(<MapView events={events} gaps={[]} onEdit={onEdit} />)
      await act(async () => {})

      const clickEntry = listenerCalls.find(l => l.event === 'click')
      expect(clickEntry).toBeDefined()
      act(() => { clickEntry!.cb() })
      expect(onEdit).toHaveBeenCalledWith(events[0])
    })

    it('shows map-error when importLibrary rejects', async () => {
      const { importLibrary } = await import('@googlemaps/js-api-loader')
      vi.mocked(importLibrary).mockRejectedValueOnce(new Error('Network error'))

      render(<MapView events={[]} gaps={[]} onEdit={() => {}} />)
      await act(async () => {})

      expect(screen.getByTestId('map-error')).toBeInTheDocument()
      expect(screen.getByText('Failed to load map')).toBeInTheDocument()
    })
  })
})
