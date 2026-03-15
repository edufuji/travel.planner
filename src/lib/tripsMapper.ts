import type { Destination, TripEvent, EventType } from '../types/trip'

// ─── DB row types (snake_case, matching Supabase schema) ────────────────────

export interface DbDestination {
  id: string
  user_id: string
  title: string
  emoji: string
  start_date: string
  end_date: string
  created_at: string
}

export interface DbEvent {
  id: string
  destination_id: string
  user_id: string
  type: EventType
  title: string
  place: string
  place_id: string | null
  lat: number | null
  lng: number | null
  place_to: string | null
  place_id_to: string | null
  lat_to: number | null
  lng_to: number | null
  arrival_time: string | null
  date: string
  time: string
  value: number | null
  notes: string | null
  arrived_on_foot: boolean | null
  created_at: string
}

// ─── DB → Frontend ──────────────────────────────────────────────────────────

export function dbDestinationToDestination(row: DbDestination, events: TripEvent[]): Destination {
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    startDate: row.start_date,
    endDate: row.end_date,
    events,
    createdAt: row.created_at,
  }
}

export function dbEventToTripEvent(row: DbEvent): TripEvent {
  return {
    id: row.id,
    destinationId: row.destination_id,
    type: row.type,
    title: row.title,
    place: row.place,
    placeId: row.place_id ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    placeTo: row.place_to ?? undefined,
    placeIdTo: row.place_id_to ?? undefined,
    latTo: row.lat_to ?? undefined,
    lngTo: row.lng_to ?? undefined,
    arrivalTime: row.arrival_time ?? undefined,
    date: row.date,
    time: row.time,
    value: row.value ?? undefined,
    notes: row.notes ?? undefined,
    arrivedOnFoot: row.arrived_on_foot ?? undefined,
    createdAt: row.created_at,
  }
}

// ─── Frontend → DB insert payloads ──────────────────────────────────────────

export function destinationToDbInsert(
  d: Omit<Destination, 'id' | 'events' | 'createdAt'>,
  userId: string
) {
  return {
    user_id: userId,
    title: d.title,
    emoji: d.emoji,
    start_date: d.startDate,
    end_date: d.endDate,
  }
}

export function tripEventToDbInsert(
  e: Omit<TripEvent, 'id' | 'createdAt'>,
  userId: string
) {
  return {
    destination_id: e.destinationId,
    user_id: userId,
    type: e.type,
    title: e.title,
    place: e.place,
    place_id: e.placeId ?? null,
    lat: e.lat ?? null,
    lng: e.lng ?? null,
    place_to: e.placeTo ?? null,
    place_id_to: e.placeIdTo ?? null,
    lat_to: e.latTo ?? null,
    lng_to: e.lngTo ?? null,
    arrival_time: e.arrivalTime ?? null,
    date: e.date,
    time: e.time,
    value: e.value ?? null,
    notes: e.notes ?? null,
    arrived_on_foot: e.arrivedOnFoot ?? null,
  }
}

// ─── Frontend → DB update payloads (only provided fields) ───────────────────

export function destinationToDbUpdate(
  patch: Partial<Omit<Destination, 'id' | 'events' | 'createdAt'>>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (patch.title !== undefined) result.title = patch.title
  if (patch.emoji !== undefined) result.emoji = patch.emoji
  if (patch.startDate !== undefined) result.start_date = patch.startDate
  if (patch.endDate !== undefined) result.end_date = patch.endDate
  return result
}

export function eventToDbUpdate(
  patch: Partial<Omit<TripEvent, 'id' | 'destinationId' | 'createdAt'>>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (patch.type !== undefined) result.type = patch.type
  if (patch.title !== undefined) result.title = patch.title
  if (patch.place !== undefined) result.place = patch.place
  if ('placeId' in patch) result.place_id = patch.placeId ?? null
  if ('lat' in patch) result.lat = patch.lat ?? null
  if ('lng' in patch) result.lng = patch.lng ?? null
  if ('placeTo' in patch) result.place_to = patch.placeTo ?? null
  if ('placeIdTo' in patch) result.place_id_to = patch.placeIdTo ?? null
  if ('latTo' in patch) result.lat_to = patch.latTo ?? null
  if ('lngTo' in patch) result.lng_to = patch.lngTo ?? null
  if ('arrivalTime' in patch) result.arrival_time = patch.arrivalTime ?? null
  if (patch.date !== undefined) result.date = patch.date
  if (patch.time !== undefined) result.time = patch.time
  if ('value' in patch) result.value = patch.value ?? null
  if ('notes' in patch) result.notes = patch.notes ?? null
  if ('arrivedOnFoot' in patch) result.arrived_on_foot = patch.arrivedOnFoot ?? null
  return result
}
