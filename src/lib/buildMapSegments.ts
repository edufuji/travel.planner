import type { TripEvent, EventType } from '../types/trip'
import type { GapWarning } from './gapDetection'

export interface MapSegment {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number }
  color: string    // hex — matches TYPE_COLORS of the starting event (or transport blue for legs)
  isGap: boolean   // true → render as dashed orange polyline
  isWalking: boolean  // true → render as dotted green polyline
}

const WALKING_COLOR = '#22C55E'

export const TYPE_COLORS: Record<EventType, string> = {
  transport: '#4A90D9',
  accommodation: '#7C3AED',
  ticket: '#059669',
  restaurant: '#F59E0B',
}

export const GAP_COLOR = '#C75B2A'

interface MapPoint {
  lat: number
  lng: number
  sourceEventId: string
  isArrival: boolean   // true only for the synthetic arrival point of a transport event
  eventType: EventType
  eventDate: string
  eventTime: string
}

export function buildMapSegments(
  sortedEvents: TripEvent[],
  gaps: GapWarning[]
): MapSegment[] {
  // Build map points, expanding transport events with latTo/lngTo into two points
  const mapPoints: MapPoint[] = []

  for (const event of sortedEvents) {
    if (event.lat === undefined || event.lng === undefined) continue

    mapPoints.push({
      lat: event.lat,
      lng: event.lng,
      sourceEventId: event.id,
      isArrival: false,
      eventType: event.type,
      eventDate: event.date,
      eventTime: event.time,
    })

    // Transport events with explicit destination add a synthetic arrival point
    if (event.type === 'transport' && event.latTo !== undefined && event.lngTo !== undefined) {
      mapPoints.push({
        lat: event.latTo,
        lng: event.lngTo,
        sourceEventId: event.id,
        isArrival: true,
        eventType: event.type,
        eventDate: event.date,
        eventTime: event.arrivalTime ?? event.time,
      })
    }
  }

  if (mapPoints.length < 2) return []

  // Lookup for gap detection — only built when gaps exist
  const eventById = gaps.length > 0
    ? new Map<string, TripEvent>(sortedEvents.map(e => [e.id, e]))
    : null

  const segments: MapSegment[] = []

  for (let i = 0; i < mapPoints.length - 1; i++) {
    const I = mapPoints[i]
    const J = mapPoints[i + 1]

    // Intra-transport leg: left point is origin, right point is arrival of same event
    const isTransportLeg =
      !I.isArrival && J.isArrival && I.sourceEventId === J.sourceEventId

    const isWalkingSegment = J.eventType === 'walking' && !J.isArrival

    let color: string
    let isGap = false
    let isWalking = false

    if (isTransportLeg) {
      // Origin → arrival of same transport event: always transport blue, never a gap
      color = TYPE_COLORS['transport']
    } else if (isWalkingSegment) {
      color = WALKING_COLOR
      isWalking = true
    } else if (I.isArrival) {
      // Segment from arrival point — skip gap detection (already transported)
      color = TYPE_COLORS[I.eventType]
    } else if (eventById !== null) {
      const aDateTime = `${I.eventDate} ${I.eventTime}`
      const bDateTime = `${J.eventDate} ${J.eventTime}`
      const hasGap = gaps.some(g => {
        const refEvent = eventById.get(g.afterEventId)
        if (!refEvent) return false
        const refDateTime = `${refEvent.date} ${refEvent.time}`
        return refDateTime >= aDateTime && refDateTime < bDateTime
      })
      if (hasGap) {
        color = GAP_COLOR
        isGap = true
      } else {
        color = TYPE_COLORS[I.eventType]
      }
    } else {
      color = TYPE_COLORS[I.eventType]
    }

    segments.push({
      from: { lat: I.lat, lng: I.lng },
      to: { lat: J.lat, lng: J.lng },
      color,
      isGap,
      isWalking,
    })
  }

  return segments
}
