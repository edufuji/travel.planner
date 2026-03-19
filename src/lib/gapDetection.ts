import type { TripEvent } from '../types/trip'

export interface GapWarning {
  afterEventId: string
  beforeEventId: string
  fromTitle: string  // title of the first accommodation
  toTitle: string    // title of the second accommodation
}

export function detectGaps(events: TripEvent[]): GapWarning[] {
  const sorted = [...events].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  )

  const accommodations = sorted.filter(e => e.type === 'accommodation')
  const gaps: GapWarning[] = []

  for (let i = 0; i < accommodations.length - 1; i++) {
    const a = accommodations[i]
    const b = accommodations[i + 1]

    const hasWalkingRoute = b.arrivedOnFoot === true

    const hasTransportToB = sorted.some(
      e =>
        e.type === 'transport' &&
        e.date >= a.date &&
        e.date <= b.date &&
        e.placeIdTo !== undefined &&
        e.placeIdTo === b.placeId,
    )

    if (!hasWalkingRoute && !hasTransportToB) {
      gaps.push({
        afterEventId: a.id,
        beforeEventId: b.id,
        fromTitle: a.title,
        toTitle: b.title,
      })
    }
  }

  return gaps
}
