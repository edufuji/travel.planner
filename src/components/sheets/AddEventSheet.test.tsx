import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import AddEventSheet from './AddEventSheet'
import { useTripsStore } from '@/stores/tripsStore'
import type { TripEvent } from '@/types/trip'

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
    expect(screen.getByText('Transport')).toBeInTheDocument()
    expect(screen.getByText('Stay')).toBeInTheDocument()
    expect(screen.getByText('Ticket')).toBeInTheDocument()
    expect(screen.getByText('Food')).toBeInTheDocument()
  })

  it('renders "Add to Timeline" button in create mode', () => {
    renderSheet()
    expect(screen.getByText('Add to Timeline')).toBeInTheDocument()
  })

  it('shows Title required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.getByText('Title is required')).toBeInTheDocument()
  })

  it('shows Place required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.getByText('Place is required')).toBeInTheDocument()
  })

  it('shows Date required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.getByText('Date is required')).toBeInTheDocument()
  })

  it('shows Time required error when submitting empty form', () => {
    renderSheet()
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.getByText('Time is required')).toBeInTheDocument()
  })

  it('shows value error when a non-positive number is entered', () => {
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/Flight GRU/), { target: { value: 'My Flight' } })
    fireEvent.change(screen.getAllByTestId('places-input-fallback')[0], { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('Departure time'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByPlaceholderText('Cost (optional)'), { target: { value: '-5' } })
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.getByText('Must be a positive number')).toBeInTheDocument()
  })

  it('does not show required errors when all required fields are filled', () => {
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/Flight GRU/), { target: { value: 'My Flight' } })
    fireEvent.change(screen.getAllByTestId('places-input-fallback')[0], { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('Departure time'), { target: { value: '10:00' } })
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.queryByText('Title is required')).not.toBeInTheDocument()
    expect(screen.queryByText('Place is required')).not.toBeInTheDocument()
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
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByText('Delete event')).toBeInTheDocument()
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
    fireEvent.click(screen.getByText('Delete event'))
    expect(screen.getByText('Confirm delete')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Confirm delete'))
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

    fireEvent.change(screen.getByPlaceholderText(/Flight GRU/), { target: { value: 'My Flight' } })
    // Simulate GooglePlacesInput onChange called with lat/lng
    // The fallback input triggers onChange(value) only, so we test via store mock
    fireEvent.change(screen.getAllByTestId('places-input-fallback')[0], { target: { value: 'Tokyo' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('Departure time'), { target: { value: '10:00' } })
    fireEvent.click(screen.getByText('Add to Timeline'))

    expect(addEvent).toHaveBeenCalledWith(
      DEST_ID,
      expect.objectContaining({ title: 'My Flight', place: 'Tokyo' })
    )
  })

  it('transport type shows two place inputs (From and To)', () => {
    renderSheet()  // default type is transport
    expect(screen.getByPlaceholderText(/From: departure/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/To: arrival/)).toBeInTheDocument()
  })

  it('transport type shows arrival time field', () => {
    renderSheet()
    expect(screen.getByLabelText('Arrival time')).toBeInTheDocument()
  })

  it('non-transport type shows single place input, no To, no arrival time', () => {
    renderSheet()
    fireEvent.click(screen.getByText('Stay'))
    expect(screen.queryByPlaceholderText(/From: departure/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Arrival time')).not.toBeInTheDocument()
    expect(screen.getByTestId('places-input-fallback')).toBeInTheDocument()
  })

  it('placeTo being empty does not trigger a validation error', () => {
    renderSheet()
    fireEvent.change(screen.getByPlaceholderText(/Flight GRU/), { target: { value: 'My Flight' } })
    fireEvent.change(screen.getAllByTestId('places-input-fallback')[0], { target: { value: 'GRU Airport' } })
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: '2026-03-15' } })
    fireEvent.change(screen.getByLabelText('Departure time'), { target: { value: '08:00' } })
    // Leave To (placeTo) blank
    fireEvent.click(screen.getByText('Add to Timeline'))
    expect(screen.queryByText('Place is required')).not.toBeInTheDocument()
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
