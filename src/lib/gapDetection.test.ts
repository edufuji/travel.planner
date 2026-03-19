import { describe, it, expect } from 'vitest'
import { detectGaps } from './gapDetection'
import type { TripEvent } from '../types/trip'

function makeEvent(overrides: Partial<TripEvent>): TripEvent {
  return {
    id: 'default-id',
    destinationId: 'dest-1',
    type: 'transport',
    title: 'Event',
    place: 'Somewhere',
    date: '2026-03-15',
    time: '10:00',
    createdAt: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

describe('detectGaps', () => {
  it('returns no gaps when there are no events', () => {
    expect(detectGaps([])).toEqual([])
  })

  it('returns no gaps when there is only one accommodation', () => {
    const events = [makeEvent({ type: 'accommodation', title: 'Hotel A' })]
    expect(detectGaps(events)).toEqual([])
  })

  it('returns no gaps when destination accommodation has arrivedOnFoot: true', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', arrivedOnFoot: true }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('returns a gap when destination accommodation has no arrivedOnFoot flag', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    const gaps = detectGaps(events)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].afterEventId).toBe('acc-1')
    expect(gaps[0].beforeEventId).toBe('acc-2')
    expect(gaps[0].fromTitle).toBe('Hotel A')
    expect(gaps[0].toTitle).toBe('Hotel B')
  })

  it('returns multiple gaps for multiple consecutive accommodation pairs without arrivedOnFoot', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
      makeEvent({ id: 'acc-3', type: 'accommodation', title: 'Hotel C', date: '2026-03-21', time: '12:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(2)
  })

  it('gap is NOT cleared when only a non-accommodation event has arrivedOnFoot: true', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'tick-1', type: 'ticket', title: 'Museum', date: '2026-03-17', time: '10:00', arrivedOnFoot: true }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(1)
  })

  it('gap is NOT cleared when only the source accommodation has arrivedOnFoot: true', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00', arrivedOnFoot: true }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(1)
  })

  it('ignores ticket and restaurant events when detecting gaps', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'tick-1', type: 'ticket', title: 'Museum', date: '2026-03-17', time: '10:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(1)
  })

  it('works correctly when accommodation events are given out of order', () => {
    const events = [
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', arrivedOnFoot: true }),
      makeEvent({ id: 'tick-1', type: 'ticket', title: 'Museum', date: '2026-03-17', time: '10:00' }),
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('transport event between two accommodations does NOT clear the gap', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Train', date: '2026-03-18', time: '09:00' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00' }),
    ]
    expect(detectGaps(events)).toHaveLength(1)
  })

  it('transport whose placeIdTo matches destination accommodation placeId clears the gap', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00', placeId: 'place-hotel-a' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Airport B → Hotel', date: '2026-03-18', time: '10:00', placeIdTo: 'place-hotel-b' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', placeId: 'place-hotel-b' }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('transport with matching placeIdTo on the same date as acc-A still clears the gap', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00', placeId: 'place-hotel-a' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Train → Hotel B', date: '2026-03-15', time: '16:00', placeIdTo: 'place-hotel-b' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', placeId: 'place-hotel-b' }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('transport with matching placeIdTo on the same date as acc-B still clears the gap', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00', placeId: 'place-hotel-a' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Train → Hotel B', date: '2026-03-18', time: '06:00', placeIdTo: 'place-hotel-b' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', placeId: 'place-hotel-b' }),
    ]
    expect(detectGaps(events)).toEqual([])
  })

  it('transport whose placeIdTo does NOT match destination accommodation placeId does NOT clear the gap', () => {
    const events = [
      makeEvent({ id: 'acc-1', type: 'accommodation', title: 'Hotel A', date: '2026-03-15', time: '14:00', placeId: 'place-hotel-a' }),
      makeEvent({ id: 'tr-1', type: 'transport', title: 'Train → Airport', date: '2026-03-18', time: '10:00', placeIdTo: 'place-airport-x' }),
      makeEvent({ id: 'acc-2', type: 'accommodation', title: 'Hotel B', date: '2026-03-18', time: '15:00', placeId: 'place-hotel-b' }),
    ]
    expect(detectGaps(events)).toHaveLength(1)
  })
})
