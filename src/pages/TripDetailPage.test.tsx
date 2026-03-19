import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import TripDetailPage from './TripDetailPage'
import { useTripsStore } from '@/stores/tripsStore'
import type { Destination, TripEvent } from '@/types/trip'

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))

vi.mock('@/components/MapView', () => ({
  default: () => <div data-testid="map-view">MapView</div>,
}))

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
    expect(screen.getByText('trip.notFound')).toBeInTheDocument()
  })

  it('shows empty state when destination has no events', () => {
    useTripsStore.setState({ destinations: [makeDest()] })
    renderPage()
    expect(screen.getByText('trip.noEvents')).toBeInTheDocument()
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
    expect(screen.getByText(/trip\.gapWarning/)).toBeInTheDocument()
  })

  it('does not render a GAP warning when destination stay has arrivedOnFoot: true', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'a1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
          makeEvent({ id: 'a2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', arrivedOnFoot: true }),
        ],
      })],
    })
    renderPage()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders Timeline view by default (ViewToggle Timeline button is active)', () => {
    useTripsStore.setState({ destinations: [makeDest()] })
    renderPage()
    const timelineBtn = screen.getByText('view.timeline').closest('button')
    expect(timelineBtn).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument()
  })

  it('clicking Map in ViewToggle shows MapView and hides timeline content', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [makeEvent({ id: 'ev-1', title: 'Flight GRU→NRT' })],
      })],
    })
    renderPage()
    expect(screen.getByText('Flight GRU→NRT')).toBeInTheDocument()
    fireEvent.click(screen.getByText('view.map'))
    expect(screen.getByTestId('map-view')).toBeInTheDocument()
    expect(screen.queryByText('Flight GRU→NRT')).not.toBeInTheDocument()
  })

  it('clicking Timeline in ViewToggle restores timeline after switching to Map', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [makeEvent({ id: 'ev-1', title: 'Flight GRU→NRT' })],
      })],
    })
    renderPage()
    fireEvent.click(screen.getByText('view.map'))
    expect(screen.getByTestId('map-view')).toBeInTheDocument()
    fireEvent.click(screen.getByText('view.timeline'))
    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument()
    expect(screen.getByText('Flight GRU→NRT')).toBeInTheDocument()
  })

  it('renders a date header for each distinct event date', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'ev-1', title: 'Flight', date: '2026-03-15', time: '10:00' }),
          makeEvent({ id: 'ev-2', title: 'Hotel Check-in', date: '2026-03-16', time: '14:00' }),
        ],
      })],
    })
    renderPage()
    // "Sun, 15 Mar 2026" and "Mon, 16 Mar 2026"
    expect(screen.getByText('Sun, 15 Mar 2026')).toBeInTheDocument()
    expect(screen.getByText('Mon, 16 Mar 2026')).toBeInTheDocument()
  })

  it('renders date header before events in DOM order', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'ev-1', title: 'Morning Flight', date: '2026-03-15', time: '08:00' }),
        ],
      })],
    })
    renderPage()
    const header = screen.getByText('Sun, 15 Mar 2026')
    const eventCard = screen.getByText('Morning Flight')
    expect(header.compareDocumentPosition(eventCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders GAP warning inside the correct date group', () => {
    useTripsStore.setState({
      destinations: [makeDest({
        events: [
          makeEvent({ id: 'a1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
          makeEvent({ id: 'a2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
        ],
      })],
    })
    renderPage()
    const alert = screen.getByRole('alert')
    const header15 = screen.getByText('Sun, 15 Mar 2026')
    // GAP should be after the Mar 15 header (in the same group)
    expect(header15.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
