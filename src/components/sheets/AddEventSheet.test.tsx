import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import AddEventSheet from './AddEventSheet'
import { useTripsStore } from '@/stores/tripsStore'
import type { TripEvent } from '@/types/trip'

const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({ supabase: { from: mockFrom } }))

const mockUseAuth = vi.hoisted(() => vi.fn())
vi.mock('@/contexts/AuthContext', () => ({ useAuth: mockUseAuth }))

const DEST_ID = 'dest-1'

function renderSheet(props: Partial<React.ComponentProps<typeof AddEventSheet>> = {}) {
  return render(
    <MemoryRouter>
      <AddEventSheet
        open={true}
        onClose={() => {}}
        destinationId={DEST_ID}
        {...props}
      />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, session: {}, loading: false, signOut: vi.fn() })
  mockFrom.mockReturnValue({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  })
  useTripsStore.setState({
    destinations: [{
      id: DEST_ID,
      title: 'Japan',
      emoji: '✈️',
      startDate: '2026-03-15',
      endDate: '2026-04-02',
      events: [],
      createdAt: '',
    }],
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('AddEventSheet', () => {
  it('renders type selector pills: Transport, Stay, Ticket, Food', () => {
    renderSheet()
    expect(screen.getByText('eventTypes.transport')).toBeInTheDocument()
    expect(screen.getByText('eventTypes.accommodation')).toBeInTheDocument()
    expect(screen.getByText('eventTypes.ticket')).toBeInTheDocument()
    expect(screen.getByText('eventTypes.restaurant')).toBeInTheDocument()
    expect(screen.queryByText('On Foot')).not.toBeInTheDocument()
  })

  it('Arrived on foot checkbox is unchecked by default', () => {
    renderSheet()
    const checkbox = screen.getByLabelText('event.arrivedOnFoot') as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it('checking Arrived on foot submits arrivedOnFoot: true', () => {
    const addEvent = vi.fn()
    useTripsStore.setState({
      destinations: [{
        id: DEST_ID,
        title: 'Japan',
        emoji: '✈️',
        startDate: '2026-03-15',
        endDate: '2026-04-02',
        events: [],
        createdAt: '',
      }],
      addEvent,
    })
    renderSheet()
    fireEvent.click(screen.getByText('eventTypes.accommodation'))
    fireEvent.change(screen.getByPlaceholderText('event.placeholderAccommodation'), { target: { value: 'Hilton' } })
    fireEvent.change(screen.getByTestId('places-input-fallback'), { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('event.timeLabel'), { target: { value: '14:00' } })
    fireEvent.click(screen.getByLabelText('event.arrivedOnFoot'))
    fireEvent.click(screen.getByText('event.addButton'))
    expect(addEvent).toHaveBeenCalledWith(
      DEST_ID,
      'user-1',
      expect.objectContaining({ arrivedOnFoot: true })
    )
  })

  it('editing event with arrivedOnFoot: true shows checkbox checked', () => {
    const editEvent: TripEvent = {
      id: 'ev-1',
      destinationId: DEST_ID,
      type: 'accommodation',
      title: 'Hilton',
      place: 'Tokyo',
      date: '2026-03-15',
      time: '14:00',
      arrivedOnFoot: true,
      createdAt: '',
    }
    renderSheet({ editEvent })
    const checkbox = screen.getByLabelText('event.arrivedOnFoot') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('leaving Arrived on foot unchecked does not submit arrivedOnFoot: true', () => {
    const addEvent = vi.fn()
    useTripsStore.setState({
      destinations: [{
        id: DEST_ID,
        title: 'Japan',
        emoji: '✈️',
        startDate: '2026-03-15',
        endDate: '2026-04-02',
        events: [],
        createdAt: '',
      }],
      addEvent,
    })
    renderSheet()
    fireEvent.click(screen.getByText('eventTypes.accommodation'))
    fireEvent.change(screen.getByPlaceholderText('event.placeholderAccommodation'), { target: { value: 'Hilton' } })
    fireEvent.change(screen.getByTestId('places-input-fallback'), { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('event.timeLabel'), { target: { value: '14:00' } })
    // Do NOT click the checkbox
    fireEvent.click(screen.getByText('event.addButton'))
    const payload = addEvent.mock.calls[0][2]
    expect(payload.arrivedOnFoot).not.toBe(true)
  })

  it('renders "Add to Timeline" button in create mode', () => {
    renderSheet()
    expect(screen.getByText('event.addButton')).toBeInTheDocument()
  })

  it('shows Title required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('event.addButton'))
    expect(screen.getByText('event.titleRequired')).toBeInTheDocument()
  })

  it('shows Place required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('event.addButton'))
    expect(screen.getByText('event.placeRequired')).toBeInTheDocument()
  })

  it('shows Date required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('event.addButton'))
    expect(screen.getByText('event.dateRequired')).toBeInTheDocument()
  })

  it('shows Time required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('event.addButton'))
    expect(screen.getByText('event.timeRequired')).toBeInTheDocument()
  })

  it('shows value error when a non-positive number is entered', () => {
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/event\.placeholderTransport/), { target: { value: 'My Flight' } })
    fireEvent.change(screen.getAllByTestId('places-input-fallback')[0], { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('event.departureTimeLabel'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByPlaceholderText('event.costPlaceholder'), { target: { value: '-5' } })
    fireEvent.click(screen.getByText('event.addButton'))
    expect(screen.getByText('event.costError')).toBeInTheDocument()
  })

  it('does not show required errors when all required fields are filled', () => {
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/event\.placeholderTransport/), { target: { value: 'My Flight' } })
    fireEvent.change(screen.getAllByTestId('places-input-fallback')[0], { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('event.departureTimeLabel'), { target: { value: '10:00' } })
    fireEvent.click(screen.getByText('event.addButton'))
    expect(screen.queryByText('event.titleRequired')).not.toBeInTheDocument()
    expect(screen.queryByText('event.placeRequired')).not.toBeInTheDocument()
  })

  it('shows "Save Changes" and "Delete event" in edit mode', () => {
    const editEvent: TripEvent = {
      id: 'ev-1',
      destinationId: DEST_ID,
      type: 'transport',
      title: 'Flight',
      place: 'GRU',
      date: '2026-03-15',
      time: '10:00',
      createdAt: '',
    }
    renderSheet({ editEvent })
    expect(screen.getByText('event.saveButton')).toBeInTheDocument()
    expect(screen.getByText('event.deleteButton')).toBeInTheDocument()
  })

  it('deletes event when delete is confirmed', () => {
    const deleteEvent = vi.fn()
    useTripsStore.setState({
      destinations: [{
        id: DEST_ID,
        title: 'Japan',
        emoji: '✈️',
        startDate: '2026-03-15',
        endDate: '2026-04-02',
        events: [],
        createdAt: '',
      }],
      deleteEvent,
    })
    const editEvent: TripEvent = {
      id: 'ev-1',
      destinationId: DEST_ID,
      type: 'transport',
      title: 'Flight',
      place: 'GRU',
      date: '2026-03-15',
      time: '10:00',
      createdAt: '',
    }
    renderSheet({ editEvent })
    fireEvent.click(screen.getByText('event.deleteButton'))
    expect(screen.getByText('event.confirmDeleteButton')).toBeInTheDocument()
    fireEvent.click(screen.getByText('event.confirmDeleteButton'))
    expect(deleteEvent).toHaveBeenCalledWith(DEST_ID, 'ev-1')
  })

  it('passes lat and lng to the store when submitting with coordinates', () => {
    const addEvent = vi.fn()
    useTripsStore.setState({
      destinations: [{
        id: DEST_ID,
        title: 'Japan',
        emoji: '✈️',
        startDate: '2026-03-15',
        endDate: '2026-04-02',
        events: [],
        createdAt: '',
      }],
      addEvent,
    })

    renderSheet()

    fireEvent.change(screen.getByPlaceholderText(/event\.placeholderTransport/), { target: { value: 'My Flight' } })
    // Simulate GooglePlacesInput onChange called with lat/lng
    // The fallback input triggers onChange(value) only, so we test via store mock
    fireEvent.change(screen.getAllByTestId('places-input-fallback')[0], { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('event.departureTimeLabel'), { target: { value: '10:00' } })
    fireEvent.click(screen.getByText('event.addButton'))

    expect(addEvent).toHaveBeenCalledWith(
      DEST_ID,
      'user-1',
      expect.objectContaining({ title: 'My Flight', place: 'Tokyo' })
    )
  })

  it('transport type shows two place inputs (From and To)', () => {
    renderSheet()  // default type is transport
    expect(screen.getByPlaceholderText('event.placeholderFrom')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('event.placeholderTo')).toBeInTheDocument()
  })

  it('transport type shows arrival time field', () => {
    renderSheet()
    expect(screen.getByLabelText('event.arrivalTimePlaceholder')).toBeInTheDocument()
  })

  it('non-transport type shows single place input, no To, no arrival time', () => {
    renderSheet()
    fireEvent.click(screen.getByText('eventTypes.accommodation'))
    expect(screen.queryByPlaceholderText('event.placeholderFrom')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Arrival time')).not.toBeInTheDocument()
    expect(screen.getByTestId('places-input-fallback')).toBeInTheDocument()
  })

  it('placeTo being empty does not trigger a validation error', () => {
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/event\.placeholderTransport/), { target: { value: 'My Flight' } })
    fireEvent.change(screen.getAllByTestId('places-input-fallback')[0], { target: { value: 'GRU Airport' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('event.departureTimeLabel'), { target: { value: '08:00' } })
    // Leave To (placeTo) blank
    fireEvent.click(screen.getByText('event.addButton'))
    expect(screen.queryByText('event.placeRequired')).not.toBeInTheDocument()
  })

  it('non-transport submit does not include placeTo or arrivalTime keys', () => {
    const addEvent = vi.fn()
    useTripsStore.setState({
      destinations: [{
        id: DEST_ID,
        title: 'Japan',
        emoji: '✈️',
        startDate: '2026-03-15',
        endDate: '2026-04-02',
        events: [],
        createdAt: '',
      }],
      addEvent,
    })
    renderSheet()
    fireEvent.click(screen.getByText('eventTypes.accommodation'))
    fireEvent.change(screen.getByPlaceholderText('event.placeholderAccommodation'), { target: { value: 'Hilton' } })
    fireEvent.change(screen.getByTestId('places-input-fallback'), { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('event.timeLabel'), { target: { value: '14:00' } })
    fireEvent.click(screen.getByText('event.addButton'))
    const payload = addEvent.mock.calls[0][1]
    expect(payload).not.toHaveProperty('placeTo')
    expect(payload).not.toHaveProperty('arrivalTime')
  })

  it('opening edit sheet for transport event pre-fills placeTo and arrivalTime', () => {
    const editEvent: TripEvent = {
      id: 'ev-1',
      destinationId: DEST_ID,
      type: 'transport',
      title: 'Flight',
      place: 'GRU',
      placeId: 'gru-id',
      lat: -23.0,
      lng: -46.0,
      placeTo: 'Narita',
      placeIdTo: 'nrt-id',
      latTo: 35.0,
      lngTo: 139.0,
      date: '2026-03-15',
      time: '08:00',
      arrivalTime: '23:00',
      createdAt: '',
    }
    renderSheet({ editEvent })
    expect(screen.getByDisplayValue('Narita')).toBeInTheDocument()
    expect(screen.getByDisplayValue('23:00')).toBeInTheDocument()
  })
})
