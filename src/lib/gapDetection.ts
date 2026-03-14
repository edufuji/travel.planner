import type { TripEvent } from '../types/trip'

export interface GapWarning {
  afterEventId: string   // the accommodation event before the gap
  beforeEventId: string  // the accommodation event after the gap
  message: string        // human-readable description, built from event titles
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
