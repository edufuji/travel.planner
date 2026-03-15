import { describe, it, expect } from 'vitest'
import {
  dbDestinationToDestination,
  dbEventToTripEvent,
  destinationToDbInsert,
  tripEventToDbInsert,
  destinationToDbUpdate,
  eventToDbUpdate,
  type DbDestination,
  type DbEvent,
} from './tripsMapper'

const dbDest: DbDestination = {
  id: 'dest-1',
  user_id: 'user-1',
  title: 'Japan 2026',
  emoji: '✈️',
  start_date: '2026-03-15',
  end_date: '2026-04-02',
  created_at: '2026-01-01T00:00:00Z',
}

const dbEvent: DbEvent = {
  id: 'ev-1',
  destination_id: 'dest-1',
  user_id: 'user-1',
  type: 'transport',
  title: 'Flight GRU→NRT',
  place: 'GRU Airport',
  place_id: 'gid-1',
  lat: -23.4,
  lng: -46.5,
  place_to: 'Narita Airport',
  place_id_to: 'gid-2',
  lat_to: 35.7,
  lng_to: 140.4,
  arrival_time: '18:00',
  date: '2026-03-15',
  time: '10:00',
  value: 1200,
  notes: 'Window seat',
  arrived_on_foot: false,
  created_at: '2026-01-02T00:00:00Z',
}

describe('dbDestinationToDestination', () => {
  it('maps snake_case columns to camelCase fields', () => {
    const result = dbDestinationToDestination(dbDest, [])
    expect(result.id).toBe('dest-1')
    expect(result.title).toBe('Japan 2026')
    expect(result.emoji).toBe('✈️')
    expect(result.startDate).toBe('2026-03-15')
    expect(result.endDate).toBe('2026-04-02')
    expect(result.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(result.events).toEqual([])
  })

  it('attaches provided events array', () => {
    const events = [dbEventToTripEvent(dbEvent)]
    const result = dbDestinationToDestination(dbDest, events)
    expect(result.events).toHaveLength(1)
    expect(result.events[0].title).toBe('Flight GRU→NRT')
  })

  it('does not include user_id in the result', () => {
    const result = dbDestinationToDestination(dbDest, [])
    expect((result as Record<string, unknown>).user_id).toBeUndefined()
  })
})

describe('dbEventToTripEvent', () => {
  it('maps all snake_case columns to camelCase fields', () => {
    const result = dbEventToTripEvent(dbEvent)
    expect(result.id).toBe('ev-1')
    expect(result.destinationId).toBe('dest-1')
    expect(result.type).toBe('transport')
    expect(result.title).toBe('Flight GRU→NRT')
    expect(result.place).toBe('GRU Airport')
    expect(result.placeId).toBe('gid-1')
    expect(result.lat).toBe(-23.4)
    expect(result.lng).toBe(-46.5)
    expect(result.placeTo).toBe('Narita Airport')
    expect(result.placeIdTo).toBe('gid-2')
    expect(result.latTo).toBe(35.7)
    expect(result.lngTo).toBe(140.4)
    expect(result.arrivalTime).toBe('18:00')
    expect(result.date).toBe('2026-03-15')
    expect(result.time).toBe('10:00')
    expect(result.value).toBe(1200)
    expect(result.notes).toBe('Window seat')
    expect(result.arrivedOnFoot).toBe(false)
    expect(result.createdAt).toBe('2026-01-02T00:00:00Z')
  })

  it('converts null nullable columns to undefined', () => {
    const sparse: DbEvent = {
      ...dbEvent,
      place_id: null,
      lat: null,
      lng: null,
      place_to: null,
      place_id_to: null,
      lat_to: null,
      lng_to: null,
      arrival_time: null,
      value: null,
      notes: null,
      arrived_on_foot: null,
    }
    const result = dbEventToTripEvent(sparse)
    expect(result.placeId).toBeUndefined()
    expect(result.lat).toBeUndefined()
    expect(result.lng).toBeUndefined()
    expect(result.placeTo).toBeUndefined()
    expect(result.placeIdTo).toBeUndefined()
    expect(result.latTo).toBeUndefined()
    expect(result.lngTo).toBeUndefined()
    expect(result.arrivalTime).toBeUndefined()
    expect(result.value).toBeUndefined()
    expect(result.notes).toBeUndefined()
    expect(result.arrivedOnFoot).toBeUndefined()
  })

  it('does not include user_id in the result', () => {
    const result = dbEventToTripEvent(dbEvent)
    expect((result as Record<string, unknown>).user_id).toBeUndefined()
  })
})

describe('destinationToDbInsert', () => {
  it('maps camelCase fields to snake_case with userId', () => {
    const result = destinationToDbInsert(
      { title: 'Japan', emoji: '✈️', startDate: '2026-03-15', endDate: '2026-04-02' },
      'user-1'
    )
    expect(result.user_id).toBe('user-1')
    expect(result.title).toBe('Japan')
    expect(result.emoji).toBe('✈️')
    expect(result.start_date).toBe('2026-03-15')
    expect(result.end_date).toBe('2026-04-02')
  })
})

describe('tripEventToDbInsert', () => {
  it('maps camelCase fields to snake_case with destinationId and userId', () => {
    const result = tripEventToDbInsert(
      {
        destinationId: 'dest-1',
        type: 'transport',
        title: 'Flight',
        place: 'GRU',
        placeId: 'gid-1',
        lat: -23.4,
        lng: -46.5,
        placeTo: 'NRT',
        placeIdTo: 'gid-2',
        latTo: 35.7,
        lngTo: 140.4,
        arrivalTime: '18:00',
        date: '2026-03-15',
        time: '10:00',
        value: 1200,
        notes: 'Note',
        arrivedOnFoot: false,
      },
      'user-1'
    )
    expect(result.destination_id).toBe('dest-1')
    expect(result.user_id).toBe('user-1')
    expect(result.place_id).toBe('gid-1')
    expect(result.place_to).toBe('NRT')
    expect(result.place_id_to).toBe('gid-2')
    expect(result.lat_to).toBe(35.7)
    expect(result.lng_to).toBe(140.4)
    expect(result.arrival_time).toBe('18:00')
    expect(result.arrived_on_foot).toBe(false)
  })

  it('converts undefined optional fields to null', () => {
    const result = tripEventToDbInsert(
      {
        destinationId: 'dest-1',
        type: 'accommodation',
        title: 'Hotel',
        place: 'Tokyo',
        date: '2026-03-15',
        time: '14:00',
      },
      'user-1'
    )
    expect(result.place_id).toBeNull()
    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
    expect(result.place_to).toBeNull()
    expect(result.arrival_time).toBeNull()
    expect(result.value).toBeNull()
    expect(result.notes).toBeNull()
    expect(result.arrived_on_foot).toBeNull()
  })
})

describe('destinationToDbUpdate', () => {
  it('only includes provided fields, mapped to snake_case', () => {
    const result = destinationToDbUpdate({ title: 'New Title', endDate: '2026-05-01' })
    expect(result.title).toBe('New Title')
    expect(result.end_date).toBe('2026-05-01')
    expect('start_date' in result).toBe(false)
    expect('emoji' in result).toBe(false)
  })
})

describe('eventToDbUpdate', () => {
  it('only includes provided fields, mapped to snake_case', () => {
    const result = eventToDbUpdate({ title: 'Updated', arrivedOnFoot: true })
    expect(result.title).toBe('Updated')
    expect(result.arrived_on_foot).toBe(true)
    expect('place' in result).toBe(false)
  })

  it('includes null for explicitly-cleared optional fields', () => {
    const result = eventToDbUpdate({ placeId: undefined, value: undefined })
    expect(result.place_id).toBeNull()
    expect(result.value).toBeNull()
  })
})
