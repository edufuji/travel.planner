import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTripsStore } from './tripsStore'
import type { DbDestination, DbEvent } from '../lib/tripsMapper'

// ─── Supabase mock ───────────────────────────────────────────────────────────

const mockFrom = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ─── Mock chain builder ───────────────────────────────────────────────────────
// Each call to mockFrom returns a fresh chain with configurable resolved values.

function buildChain(opts: {
  selectResult?: { data: unknown; error: null | { message: string } }
  insertResult?: { data: unknown; error: null | { message: string } }
  deleteResult?: { error: null | { message: string } }
  updateResult?: { error: null | { message: string } }
}) {
  const { selectResult, insertResult, deleteResult, updateResult } = opts
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue(selectResult ?? { data: [], error: null }),
        // for trip_events select (no order)
        then: undefined,  // not a promise itself
      }),
      // for trip_events select (just .eq, no .order)
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue(insertResult ?? { data: null, error: null }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(deleteResult ?? { error: null }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(updateResult ?? { error: null }),
    }),
  }
}

// ─── DB fixtures ─────────────────────────────────────────────────────────────

function makeDbDest(overrides: Partial<DbDestination> = {}): DbDestination {
  return {
    id: 'dest-1',
    user_id: 'user-1',
    title: 'Japan 2026',
    emoji: '✈️',
    start_date: '2026-03-15',
    end_date: '2026-04-02',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeDbEvent(overrides: Partial<DbEvent> = {}): DbEvent {
  return {
    id: 'ev-1',
    destination_id: 'dest-1',
    user_id: 'user-1',
    type: 'transport',
    title: 'Flight',
    place: 'GRU',
    place_id: null,
    lat: null,
    lng: null,
    place_to: null,
    place_id_to: null,
    lat_to: null,
    lng_to: null,
    arrival_time: null,
    date: '2026-03-15',
    time: '10:00',
    value: null,
    notes: null,
    arrived_on_foot: null,
    created_at: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  useTripsStore.setState({ destinations: [], loading: false })
  mockFrom.mockReset()
})

describe('fetchDestinations', () => {
  it('fetches destinations and their events, populates store', async () => {
    const dbDest = makeDbDest()
    const dbEvent = makeDbEvent()

    // First call: destinations table
    // Second call: trip_events table
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [dbDest], error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [dbEvent], error: null }),
        }),
      })

    await useTripsStore.getState().fetchDestinations('user-1')

    const { destinations, loading } = useTripsStore.getState()
    expect(destinations).toHaveLength(1)
    expect(destinations[0].title).toBe('Japan 2026')
    expect(destinations[0].startDate).toBe('2026-03-15')
    expect(destinations[0].events).toHaveLength(1)
    expect(destinations[0].events[0].title).toBe('Flight')
    expect(loading).toBe(false)
  })

  it('sets destinations to [] when user has no destinations', async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })

    await useTripsStore.getState().fetchDestinations('user-1')
    expect(useTripsStore.getState().destinations).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })

    await expect(useTripsStore.getState().fetchDestinations('user-1')).rejects.toThrow('DB error')
  })
})

describe('clearDestinations', () => {
  it('resets destinations to empty array without hitting Supabase', () => {
    useTripsStore.setState({ destinations: [{ id: 'x', title: 'T', emoji: '✈️', startDate: '', endDate: '', events: [], createdAt: '' }] })
    useTripsStore.getState().clearDestinations()
    expect(useTripsStore.getState().destinations).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('addDestination', () => {
  it('inserts into Supabase and prepends result to destinations', async () => {
    const dbDest = makeDbDest()
    mockFrom.mockReturnValueOnce(buildChain({ insertResult: { data: dbDest, error: null } }))

    await useTripsStore.getState().addDestination('user-1', {
      title: 'Japan 2026',
      emoji: '✈️',
      startDate: '2026-03-15',
      endDate: '2026-04-02',
    })

    const { destinations } = useTripsStore.getState()
    expect(destinations).toHaveLength(1)
    expect(destinations[0].title).toBe('Japan 2026')
    expect(destinations[0].startDate).toBe('2026-03-15')
    expect(destinations[0].events).toEqual([])
  })

  it('returns the newly created Destination', async () => {
    const dbDest = makeDbDest()
    mockFrom.mockReturnValueOnce(buildChain({ insertResult: { data: dbDest, error: null } }))

    const result = await useTripsStore.getState().addDestination('user-1', {
      title: 'Japan 2026',
      emoji: '✈️',
      startDate: '2026-03-15',
      endDate: '2026-04-02',
    })

    expect(result.id).toBe('dest-1')
    expect(result.title).toBe('Japan 2026')
    expect(result.events).toEqual([])
  })

  it('throws when Supabase insert returns an error', async () => {
    mockFrom.mockReturnValueOnce(buildChain({ insertResult: { data: null, error: { message: 'Plan limit reached' } } }))

    await expect(
      useTripsStore.getState().addDestination('user-1', { title: 'T', emoji: '✈️', startDate: '2026-01-01', endDate: '2026-01-07' })
    ).rejects.toThrow('Plan limit reached')
  })
})

describe('deleteDestination', () => {
  it('calls Supabase delete and removes destination from store', async () => {
    useTripsStore.setState({ destinations: [{ id: 'dest-1', title: 'Japan', emoji: '✈️', startDate: '', endDate: '', events: [], createdAt: '' }] })
    mockFrom.mockReturnValueOnce(buildChain({ deleteResult: { error: null } }))

    await useTripsStore.getState().deleteDestination('dest-1')

    expect(useTripsStore.getState().destinations).toHaveLength(0)
  })
})

describe('addEvent', () => {
  it('inserts into Supabase and appends event to correct destination', async () => {
    useTripsStore.setState({
      destinations: [{ id: 'dest-1', title: 'Japan', emoji: '✈️', startDate: '', endDate: '', events: [], createdAt: '' }],
    })
    const dbEv = makeDbEvent()
    mockFrom.mockReturnValueOnce(buildChain({ insertResult: { data: dbEv, error: null } }))

    await useTripsStore.getState().addEvent('dest-1', 'user-1', {
      destinationId: 'dest-1',
      type: 'transport',
      title: 'Flight',
      place: 'GRU',
      date: '2026-03-15',
      time: '10:00',
    })

    const events = useTripsStore.getState().destinations[0].events
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Flight')
    expect(events[0].destinationId).toBe('dest-1')
  })
})

describe('deleteEvent', () => {
  it('calls Supabase delete and removes event from destination', async () => {
    useTripsStore.setState({
      destinations: [{
        id: 'dest-1', title: 'Japan', emoji: '✈️', startDate: '', endDate: '', createdAt: '',
        events: [{ id: 'ev-1', destinationId: 'dest-1', type: 'transport', title: 'Flight', place: 'GRU', date: '2026-03-15', time: '10:00', createdAt: '' }],
      }],
    })
    mockFrom.mockReturnValueOnce(buildChain({ deleteResult: { error: null } }))

    await useTripsStore.getState().deleteEvent('dest-1', 'ev-1')

    expect(useTripsStore.getState().destinations[0].events).toHaveLength(0)
  })
})
