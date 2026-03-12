import { describe, it, expect, beforeEach } from 'vitest'
import { useTripsStore } from './tripsStore'

beforeEach(() => {
  useTripsStore.setState({ destinations: [] })
  localStorage.clear()
})

describe('addDestination', () => {
  it('adds a destination with generated id, auto emoji, empty events, and createdAt', () => {
    useTripsStore.getState().addDestination({
      title: 'Japan 2026',
      startDate: '2026-03-15',
      endDate: '2026-04-02',
      emoji: '',
    })
    const { destinations } = useTripsStore.getState()
    expect(destinations).toHaveLength(1)
    expect(destinations[0].id).toBeTruthy()
    expect(destinations[0].title).toBe('Japan 2026')
    expect(destinations[0].emoji).toBeTruthy()
    expect(destinations[0].events).toEqual([])
    expect(destinations[0].createdAt).toBeTruthy()
  })

  it('prepends new destination to the top of the list', () => {
    useTripsStore.getState().addDestination({ title: 'First', startDate: '2026-01-01', endDate: '2026-01-07', emoji: '' })
    useTripsStore.getState().addDestination({ title: 'Second', startDate: '2026-02-01', endDate: '2026-02-07', emoji: '' })
    expect(useTripsStore.getState().destinations[0].title).toBe('Second')
  })
})

describe('deleteDestination', () => {
  it('removes the destination by id', () => {
    useTripsStore.getState().addDestination({ title: 'Japan', startDate: '2026-03-15', endDate: '2026-04-02', emoji: '' })
    const id = useTripsStore.getState().destinations[0].id
    useTripsStore.getState().deleteDestination(id)
    expect(useTripsStore.getState().destinations).toHaveLength(0)
  })
})

describe('addEvent', () => {
  it('appends an event with generated id to the correct destination', () => {
    useTripsStore.getState().addDestination({ title: 'Japan', startDate: '2026-03-15', endDate: '2026-04-02', emoji: '' })
    const destId = useTripsStore.getState().destinations[0].id
    useTripsStore.getState().addEvent(destId, {
      type: 'transport',
      title: 'Flight',
      place: 'GRU Airport',
      date: '2026-03-15',
      time: '10:00',
    })
    const events = useTripsStore.getState().destinations[0].events
    expect(events).toHaveLength(1)
    expect(events[0].id).toBeTruthy()
    expect(events[0].title).toBe('Flight')
    expect(events[0].destinationId).toBe(destId)
  })
})

describe('deleteEvent', () => {
  it('removes only the specified event, leaving others intact', () => {
    useTripsStore.getState().addDestination({ title: 'Japan', startDate: '2026-03-15', endDate: '2026-04-02', emoji: '' })
    const destId = useTripsStore.getState().destinations[0].id
    useTripsStore.getState().addEvent(destId, { type: 'transport', title: 'Flight', place: 'GRU', date: '2026-03-15', time: '10:00' })
    useTripsStore.getState().addEvent(destId, { type: 'accommodation', title: 'Hotel', place: 'Tokyo', date: '2026-03-15', time: '22:00' })
    const firstId = useTripsStore.getState().destinations[0].events[0].id
    useTripsStore.getState().deleteEvent(destId, firstId)
    const remaining = useTripsStore.getState().destinations[0].events
    expect(remaining).toHaveLength(1)
    expect(remaining[0].title).toBe('Hotel')
  })
})

describe('localStorage persistence', () => {
  it('persists destinations to localStorage under tripmate-trips key', () => {
    useTripsStore.getState().addDestination({ title: 'Japan', startDate: '2026-03-15', endDate: '2026-04-02', emoji: '' })
    const stored = localStorage.getItem('tripmate-trips')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.destinations).toHaveLength(1)
  })
})
