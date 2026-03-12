import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import TripDetailPage from './TripDetailPage'
import { useTripsStore } from '@/stores/tripsStore'
import type { Destination, TripEvent } from '@/types/trip'

const DEST_ID = 'dest-1'

function makeEvent(overrides: Partial<TripEvent>): TripEvent {
  return {
    id: 'ev-1',
    destinationId: DEST_ID,
    type: 'transport',
    title: 'Event',
    place: 'Somewhere',
    date: '2026-03-15',
    time: '10:00',
    createdAt: '',
    ...overrides,
  }
}

function makeDest(overrides: Partial<Destination> = {}): Destination {
  return {
    id: DEST_ID,
    title: 'Japan 2026',
    emoji: '✈️',
    startDate: '2026-03-15',
    endDate: '2026-04-02',
    events: [],
    createdAt: '',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/trips/${DEST_ID}`]}>
      <Routes>
        <Route path="/trips/:id" element={<TripDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useTripsStore.setState({ destinations: [] })
})

describe('TripDetailPage', () => {
  it('shows not-found message when destination does not exist', () => {
    renderPage()
    expect(screen.getByText('Destination not found')).toBeInTheDocument()
  })

  it('shows empty state when destination has no events', () => {
    useTripsStore.setState({ destinations: [makeDest()] })
    renderPage()
    expect(screen.getByText(/No events yet/)).toBeInTheDocument()
  })

  it('renders event titles', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [makeEvent({ id: 'ev-1', title: 'Flight GRU→NRT' })],
      })],
    })
    renderPage()
    expect(screen.getByText('Flight GRU→NRT')).toBeInTheDocument()
  })

  it('renders events in ascending date+time order regardless of store order', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'ev-2', title: 'Hotel Check-in', date: '2026-03-15', time: '22:00' }),
          makeEvent({ id: 'ev-1', title: 'Flight Arrives', date: '2026-03-15', time: '18:00' }),
        ],
      })],
    })
    renderPage()
    const flight = screen.getByText('Flight Arrives')
    const hotel = screen.getByText('Hotel Check-in')
    // Flight (18:00) should come before Hotel (22:00) in the DOM
    expect(flight.compareDocumentPosition(hotel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders a GAP warning when two accommodations have no transport between them', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'a1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
          makeEvent({ id: 'a2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
        ],
      })],
    })
    renderPage()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/No transport between/)).toBeInTheDocument()
  })

  it('does not render a GAP warning when transport exists between accommodations', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'a1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
          makeEvent({ id: 't1', type: 'transport', title: 'Shinkansen', date: '2026-03-18', time: '09:00' }),
          makeEvent({ id: 'a2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
        ],
      })],
    })
    renderPage()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
