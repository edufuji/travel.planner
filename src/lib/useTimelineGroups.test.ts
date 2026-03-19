import { describe, it, expect } from 'vitest'
import { useTimelineGroups } from './useTimelineGroups'
import type { TripEvent } from '../types/trip'
import type { GapWarning } from './gapDetection'

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

describe('useTimelineGroups', () => {
  it('returns empty array for no events', () => {
    expect(useTimelineGroups([], [])).toEqual([])
  })

  it('single event produces one group with one event item', () => {
    const events = [makeEvent({ date: '2026-03-15' })]
    const groups = useTimelineGroups(events, [])
    expect(groups).toHaveLength(1)
    expect(groups[0].date).toBe('2026-03-15')
    expect(groups[0].items).toHaveLength(1)
    expect(groups[0].items[0].kind).toBe('event')
  })

  it('two events on same date go into one group', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-03-15', time: '08:00' }),
      makeEvent({ id: 'b', date: '2026-03-15', time: '14:00' }),
    ]
    const groups = useTimelineGroups(events, [])
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(2)
  })

  it('events on different dates produce separate groups in ascending date order', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-03-15', time: '08:00' }),
      makeEvent({ id: 'b', date: '2026-03-16', time: '09:00' }),
    ]
    const groups = useTimelineGroups(events, [])
    expect(groups).toHaveLength(2)
    expect(groups[0].date).toBe('2026-03-15')
    expect(groups[1].date).toBe('2026-03-16')
  })

  it('gap warning appears immediately after afterEventId event within its date group', () => {
    const events = [
      makeEvent({ id: 'a', type: 'accommodation', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'b', date: '2026-03-15', time: '16:00' }),
      makeEvent({ id: 'c', type: 'accommodation', date: '2026-03-18', time: '15:00' }),
    ]
    const gaps: GapWarning[] = [{ afterEventId: 'a', beforeEventId: 'c', fromTitle: 'Hotel A', toTitle: 'Hotel C' }]
    const groups = useTimelineGroups(events, gaps)
    // Day 15 group: event(a), gap, event(b)
    const march15 = groups.find(g => g.date === '2026-03-15')!
    expect(march15.items[0]).toMatchObject({ kind: 'event' })
    expect(march15.items[1]).toMatchObject({ kind: 'gap' })
    expect(march15.items[2]).toMatchObject({ kind: 'event' })
  })

  it('gap card lands in the date group of the afterEventId event', () => {
    const events = [
      makeEvent({ id: 'a', type: 'accommodation', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'b', type: 'accommodation', date: '2026-03-18', time: '15:00' }),
    ]
    const gaps: GapWarning[] = [{ afterEventId: 'a', beforeEventId: 'b', fromTitle: 'Hotel A', toTitle: 'Hotel B' }]
    const groups = useTimelineGroups(events, gaps)
    // Gap should be in 2026-03-15 group (afterEventId='a' is on 15th)
    const march15 = groups.find(g => g.date === '2026-03-15')!
    expect(march15.items.some(i => i.kind === 'gap')).toBe(true)
    const march18 = groups.find(g => g.date === '2026-03-18')!
    expect(march18.items.some(i => i.kind === 'gap')).toBe(false)
  })

  it('group label has correct format — "Sun, 15 Mar 2026" for 2026-03-15', () => {
    const events = [makeEvent({ date: '2026-03-15' })]
    const groups = useTimelineGroups(events, [])
    expect(groups[0].label).toBe('Sun, 15 Mar 2026')
  })
})
