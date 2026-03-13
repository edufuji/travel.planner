import type { TripEvent } from '../types/trip'

export interface GapWarning {
  afterEventId: string   // the accommodation event before the gap
  beforeEventId: string  // the accommodation event after the gap
  message: string        // human-readable description, built from event titles
}

function toDateTime(date: string, time: string): string {
  return `${date} ${time}`
}

export function detectGaps(events: TripEvent[]): GapWarning[] {
  const sorted = [...events].sort((a, b) =>
    toDateTime(a.date, a.time).localeCompare(toDateTime(b.date, b.time))
  )

  const accommodations = sorted.filter(e => e.type === 'accommodation')
  const gaps: GapWarning[] = []

  for (let i = 0; i < accommodations.length - 1; i++) {
    const a = accommodations[i]
    const b = accommodations[i + 1]
    const aDateTime = toDateTime(a.date, a.time)
    const bDateTime = toDateTime(b.date, b.time)

    const hasWalkingRoute = sorted.some(
      e =>
        e.type === 'walking' &&
        toDateTime(e.date, e.time) > aDateTime &&
        toDateTime(e.date, e.time) < bDateTime
    )

    if (!hasWalkingRoute) {
      gaps.push({
        afterEventId: a.id,
        beforeEventId: b.id,
        message: `No walking route between "${a.title}" check-in and "${b.title}" check-in`,
      })
    }
  }

  return gaps
}
