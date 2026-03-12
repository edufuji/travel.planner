import type { TripEvent, EventType } from '../types/trip'
import type { GapWarning } from './gapDetection'

export interface MapSegment {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  color: string    // hex — matches TYPE_COLORS of the starting event
  isGap: boolean   // true → render as dashed orange polyline
}

export const TYPE_COLORS: Record<EventType, string> = {
  transport: '#4A90D9',
  accommodation: '#7C3AED',
  ticket: '#059669',
  restaurant: '#F59E0B',
}

export const GAP_COLOR = '#FF8C00'

export function buildMapSegments(
  sortedEvents: TripEvent[],
  gaps: GapWarning[]
): MapSegment[] {
  // Only events with both lat and lng can be segment endpoints
  const positioned = sortedEvents.filter(
    (e): e is TripEvent & { lat: number; lng: number } =>
      e.lat !== undefined && e.lng !== undefined
  )

  if (positioned.length < 2) return []

  const segments: MapSegment[] = []

  // Lookup for all events (including unpositioned) by id — needed for gap detection.
  // String comparison works correctly here because date is YYYY-MM-DD and time is HH:mm,
  // so lexicographic order matches chronological order.
  const eventById = gaps.length > 0
    ? new Map<string, TripEvent>(sortedEvents.map(e => [e.id, e]))
    : null

  for (let i = 0; i < positioned.length - 1; i++) {
    const a = positioned[i]
    const b = positioned[i + 1]
    const aDateTime = `${a.date} ${a.time}`
    const bDateTime = `${b.date} ${b.time}`

    // A gap warning g applies to this segment if g.afterEventId points to an event
    // with datetime in [aDateTime, bDateTime)
    const hasGap = eventById !== null && gaps.some(g => {
      const refEvent = eventById.get(g.afterEventId)
      if (!refEvent) return false
      const refDateTime = `${refEvent.date} ${refEvent.time}`
      return refDateTime >= aDateTime && refDateTime < bDateTime
    })

    segments.push({
      from: { lat: a.lat, lng: a.lng },
      to:   { lat: b.lat, lng: b.lng },
      color: hasGap ? GAP_COLOR : TYPE_COLORS[a.type],
      isGap: hasGap,
    })
  }

  return segments
}
