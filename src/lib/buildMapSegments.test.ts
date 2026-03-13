import { describe, it, expect } from 'vitest'
import { buildMapSegments, GAP_COLOR, TYPE_COLORS } from './buildMapSegments'
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

describe('buildMapSegments', () => {
  it('returns [] when there are no events', () => {
    expect(buildMapSegments([], [])).toEqual([])
  })

  it('returns [] when there is only one positioned event', () => {
    const events = [makeEvent({ id: 'a', lat: 35.0, lng: 139.0 })]
    expect(buildMapSegments(events, [])).toEqual([])
  })

  it('returns [] when no events have coordinates', () => {
    const events = [
      makeEvent({ id: 'a' }),
      makeEvent({ id: 'b' }),
    ]
    expect(buildMapSegments(events, [])).toEqual([])
  })

  it('returns one normal segment for two positioned events with no gap', () => {
    const events = [
      makeEvent({ id: 'a', type: 'transport', lat: 10.0, lng: 20.0, date: '2026-03-15', time: '08:00' }),
      makeEvent({ id: 'b', type: 'accommodation', lat: 11.0, lng: 21.0, date: '2026-03-15', time: '22:00' }),
    ]
    const segments = buildMapSegments(events, [])
    expect(segments).toHaveLength(1)
    expect(segments[0].isGap).toBe(false)
    expect(segments[0].color).toBe('#4A90D9')  // transport color
    expect(segments[0].from).toEqual({ lat: 10.0, lng: 20.0 })
    expect(segments[0].to).toEqual({ lat: 11.0, lng: 21.0 })
  })

  it('returns one gap segment when a gap warning applies between two positioned events', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', lat: 10.0, lng: 20.0, date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', lat: 11.0, lng: 21.0, date: '2026-03-18', time: '15:00' }),
    ]
    const gaps: GapWarning[] = [
      { afterEventId: 'acc-1', beforeEventId: 'acc-2', message: 'No transport' },
    ]
    const segments = buildMapSegments(events, gaps)
    expect(segments).toHaveLength(1)
    expect(segments[0].isGap).toBe(true)
    expect(segments[0].color).toBe(GAP_COLOR)
  })

  it('marks segment as gap when the gap warning directly references the starting endpoint', () => {
    // afterEventId === 'acc-1' which IS event a (has coords)
    // aDateTime = '2026-03-15 14:00', bDateTime = '2026-03-18 15:00'
    // acc-1 datetime = '2026-03-15 14:00' which equals aDateTime → >= passes → gap detected
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', lat: 10.0, lng: 20.0, date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', lat: 11.0, lng: 21.0, date: '2026-03-18', time: '15:00' }),
    ]
    const gaps: GapWarning[] = [
      { afterEventId: 'acc-1', beforeEventId: 'acc-2', message: 'No transport' },
    ]
    const segments = buildMapSegments(events, gaps)
    expect(segments[0].isGap).toBe(true)
  })

  it('skips events without coords as segment endpoints but still detects gaps via them', () => {
    // acc-1 has no coords, acc-2 has no coords, acc-3 has coords
    // positioned = [transport-1, acc-3]
    // gap afterEventId = 'acc-1' (no coords, between transport-1 and acc-3)
    const events = [
      makeEvent({ id: 'transport-1', type: 'transport', lat: 10.0, lng: 20.0, date: '2026-03-15', time: '10:00' }),
      makeEvent({ id: 'acc-1', type: 'accommodation', date: '2026-03-16', time: '14:00' }),  // no coords
      makeEvent({ id: 'acc-3', type: 'accommodation', lat: 11.0, lng: 21.0, date: '2026-03-20', time: '15:00' }),
    ]
    const gaps: GapWarning[] = [
      { afterEventId: 'acc-1', beforeEventId: 'acc-3', message: 'No transport' },
    ]
    // acc-1 datetime = '2026-03-16 14:00'
    // segment (transport-1, acc-3): aDateTime='2026-03-15 10:00', bDateTime='2026-03-20 15:00'
    // acc-1 datetime >= aDateTime AND < bDateTime → gap applies
    const segments = buildMapSegments(events, gaps)
    expect(segments).toHaveLength(1)
    expect(segments[0].isGap).toBe(true)
  })

  it('returns two segments with correct isGap for three positioned events mixed gap/no-gap', () => {
    const events = [
      makeEvent({ id: 'a', type: 'transport', lat: 10.0, lng: 20.0, date: '2026-03-15', time: '08:00' }),
      makeEvent({ id: 'b', type: 'accommodation', lat: 11.0, lng: 21.0, date: '2026-03-15', time: '22:00' }),
      makeEvent({ id: 'c', type: 'accommodation', lat: 12.0, lng: 22.0, date: '2026-03-18', time: '15:00' }),
    ]
    const gaps: GapWarning[] = [
      { afterEventId: 'b', beforeEventId: 'c', message: 'No transport' },
    ]
    const segments = buildMapSegments(events, gaps)
    expect(segments).toHaveLength(2)
    expect(segments[0].isGap).toBe(false)  // a→b: no gap
    expect(segments[1].isGap).toBe(true)   // b→c: gap
  })

  it('transport event with latTo/lngTo expands into 3 segments: before-origin, origin→dest, dest-after', () => {
    const events = [
      makeEvent({ id: 'hotel-a', type: 'accommodation', lat: 10.0, lng: 10.0, date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'flight', type: 'transport', lat: 20.0, lng: 20.0, latTo: 30.0, lngTo: 30.0, date: '2026-03-18', time: '08:00', arrivalTime: '23:00' }),
      makeEvent({ id: 'hotel-b', type: 'accommodation', lat: 31.0, lng: 31.0, date: '2026-03-19', time: '14:00' }),
    ]
    const segments = buildMapSegments(events, [])
    expect(segments).toHaveLength(3)
    // origin→destination segment is always transport blue, never a gap
    expect(segments[1].color).toBe(TYPE_COLORS['transport'])
    expect(segments[1].isGap).toBe(false)
    expect(segments[1].from).toEqual({ lat: 20.0, lng: 20.0 })
    expect(segments[1].to).toEqual({ lat: 30.0, lng: 30.0 })
  })

  it('transport event without latTo/lngTo behaves as single-point event (no expansion)', () => {
    const events = [
      makeEvent({ id: 'a', type: 'transport', lat: 10.0, lng: 10.0, date: '2026-03-15', time: '08:00' }),
      makeEvent({ id: 'b', type: 'accommodation', lat: 20.0, lng: 20.0, date: '2026-03-15', time: '22:00' }),
    ]
    const segments = buildMapSegments(events, [])
    expect(segments).toHaveLength(1)
  })

  it('gap color applied correctly when transport has no latTo/lngTo and accommodations lack transport', () => {
    const events = [
      makeEvent({ id: 'a1', type: 'accommodation', lat: 10.0, lng: 10.0, date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'a2', type: 'accommodation', lat: 20.0, lng: 20.0, date: '2026-03-18', time: '15:00' }),
    ]
    const gaps: GapWarning[] = [{ afterEventId: 'a1', beforeEventId: 'a2', message: 'No transport' }]
    const segments = buildMapSegments(events, gaps)
    expect(segments).toHaveLength(1)
    expect(segments[0].isGap).toBe(true)
    expect(segments[0].color).toBe(GAP_COLOR)
  })

  it('unpositioned event in gap range does NOT cause false gap when no gap warning exists', () => {
    // acc-A and acc-B are positioned; unpositioned event falls between them in datetime
    // but NO gap warnings are passed → segment should have isGap: false
    const events = [
      makeEvent({ id: 'acc-A', type: 'accommodation', lat: 10.0, lng: 20.0, date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'unpos', type: 'ticket', date: '2026-03-16', time: '12:00' }),  // no coords
      makeEvent({ id: 'acc-B', type: 'accommodation', lat: 11.0, lng: 21.0, date: '2026-03-18', time: '15:00' }),
    ]
    const segments = buildMapSegments(events, [])
    expect(segments).toHaveLength(1)
    expect(segments[0].isGap).toBe(false)
  })

  it('produces isWalking: true segment when next point is a walking event', () => {
    const events: TripEvent[] = [
      {
        id: 'acc-1', destinationId: 'd1', type: 'accommodation', title: 'Hotel A',
        place: 'Tokyo', lat: 35.6762, lng: 139.6503,
        date: '2026-03-15', time: '14:00', createdAt: '',
      },
      {
        id: 'walk-1', destinationId: 'd1', type: 'walking', title: 'Walk to park',
        place: 'Shinjuku Park', lat: 35.6851, lng: 139.7100,
        date: '2026-03-16', time: '09:00', createdAt: '',
      },
    ]
    const segments = buildMapSegments(events, [])
    expect(segments).toHaveLength(1)
    expect(segments[0].isWalking).toBe(true)
    expect(segments[0].color).toBe('#22C55E')
    expect(segments[0].isGap).toBe(false)
  })

  it('segment FROM a walking event to the next is solid (isWalking: false)', () => {
    const events: TripEvent[] = [
      {
        id: 'walk-1', destinationId: 'd1', type: 'walking', title: 'Walk to hotel',
        place: 'Shinjuku Park', lat: 35.6851, lng: 139.7100,
        date: '2026-03-16', time: '09:00', createdAt: '',
      },
      {
        id: 'acc-1', destinationId: 'd1', type: 'accommodation', title: 'Hotel B',
        place: 'Shinjuku', lat: 35.6896, lng: 139.6917,
        date: '2026-03-16', time: '15:00', createdAt: '',
      },
    ]
    const segments = buildMapSegments(events, [])
    expect(segments).toHaveLength(1)
    expect(segments[0].isWalking).toBe(false)
    expect(segments[0].color).toBe('#22C55E')  // still green (walking color for I.eventType)
  })
})
