export type EventType = 'transport' | 'accommodation' | 'ticket' | 'restaurant'

// UI label → EventType mapping (used in AddEventSheet type selector pills):
//   "Transport" → 'transport'
//   "Stay"      → 'accommodation'
//   "Ticket"    → 'ticket'
//   "Food"      → 'restaurant'

export interface TripEvent {
  id: string            // crypto.randomUUID()
  destinationId: string
  type: EventType
  title: string
  place: string         // display name from Google Places (or plain text)
  placeId?: string      // Google Place ID (optional, for future map use)
  lat?: number          // WGS84 latitude, from Google Places geometry.location.lat()
  lng?: number          // WGS84 longitude, from Google Places geometry.location.lng()
  // Transport-only: destination (arrival) location
  placeTo?: string      // display name of destination
  placeIdTo?: string    // Google Place ID of destination
  latTo?: number        // WGS84 latitude of destination
  lngTo?: number        // WGS84 longitude of destination
  // Transport-only: arrival time
  arrivalTime?: string  // HH:mm (24h); separate from `time` (departure)
  date: string          // YYYY-MM-DD
  time: string          // HH:mm (24h)
  value?: number        // optional cost
  notes?: string        // optional free text
  createdAt: string     // ISO timestamp
}

export interface Destination {
  id: string            // crypto.randomUUID()
  title: string
  emoji: string         // auto-assigned from travel emoji pool
  startDate: string     // YYYY-MM-DD
  endDate: string       // YYYY-MM-DD
  events: TripEvent[]
  createdAt: string     // ISO timestamp
}
