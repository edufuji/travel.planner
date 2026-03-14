import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import TripsPage from './TripsPage'
import { useTripsStore } from '@/stores/tripsStore'
import type { Destination } from '@/types/trip'

function makeDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'dest-1',
    title: 'Japan 2026',
    emoji: '✈️',
    startDate: '2026-03-15',
    endDate: '2026-04-02',
    events: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPage() {
  return render(<MemoryRouter><TripsPage /></MemoryRouter>)
}

beforeEach(() => {
  useTripsStore.setState({ destinations: [] })
})

describe('TripsPage', () => {
  it('shows empty state when no destinations exist', () => {
    renderPage()
    expect(screen.getByText('No trips yet')).toBeInTheDocument()
    expect(screen.getByText('Plan your first trip')).toBeInTheDocument()
  })

  it('renders a destination row when destinations exist', () => {
    useTripsStore.setState({ destinations: [makeDestination()] })
    renderPage()
    expect(screen.getByText('Japan 2026')).toBeInTheDocument()
  })

  it('shows ⚠️ GAP badge when destination has accommodation gap', () => {
    useTripsStore.setState({
      destinations: [makeDestination({
        events: [
          { id: 'a1', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel A', place: 'Tokyo', date: '2026-03-15', time: '14:00', createdAt: '' },
          { id: 'a2', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel B', place: 'Osaka', date: '2026-03-18', time: '15:00', createdAt: '' },
        ],
      })],
    })
    renderPage()
    expect(screen.getByText('⚠️ GAP')).toBeInTheDocument()
  })

  it('shows ✓ OK badge when destination has events and no gaps', () => {
    useTripsStore.setState({
      destinations: [makeDestination({
        events: [
          { id: 'a1', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel A', place: 'Tokyo', date: '2026-03-15', time: '14:00', createdAt: '' },
          { id: 'a2', destinationId: 'dest-1', type: 'accommodation', title: 'Hotel B', place: 'Osaka', date: '2026-03-18', time: '15:00', arrivedOnFoot: true, createdAt: '' },
        ],
      })],
    })
    renderPage()
    expect(screen.getByText('✓ OK')).toBeInTheDocument()
  })

  it('opens New Destination sheet when "+ New" button is clicked', () => {
    renderPage()
    fireEvent.click(screen.getByText('+ New'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('New Destination')).toBeInTheDocument()
  })

  it('shows correct destination count', () => {
    useTripsStore.setState({
      destinations: [makeDestination(), makeDestination({ id: 'dest-2', title: 'Italy' })],
    })
    renderPage()
    expect(screen.getByText('2 destinations')).toBeInTheDocument()
  })
})
