import type { TripEvent } from '../types/trip'
import type { GapWarning } from './gapDetection'

export type RenderItem =
  | { kind: 'event'; event: TripEvent }
  | { kind: 'gap'; fromTitle: string; toTitle: string; key: string }

export interface TimelineGroup {
  date: string
  label: string
  items: RenderItem[]
}

function formatGroupLabel(date: string, locale: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt)
}

export function useTimelineGroups(
  sortedEvents: TripEvent[],
  gaps: GapWarning[],
  locale = 'en'
): TimelineGroup[] {
  const groups: TimelineGroup[] = []
  const groupByDate = new Map<string, TimelineGroup>()

  for (const event of sortedEvents) {
    if (!groupByDate.has(event.date)) {
      const group: TimelineGroup = {
        date: event.date,
        label: formatGroupLabel(event.date, locale),
        items: [],
      }
      groupByDate.set(event.date, group)
      groups.push(group)
    }
    const group = groupByDate.get(event.date)!
    group.items.push({ kind: 'event', event })
    const gap = gaps.find(g => g.afterEventId === event.id)
    if (gap) {
      group.items.push({
        kind: 'gap',
        fromTitle: gap.fromTitle,
        toTitle: gap.toTitle,
        key: `gap-${gap.afterEventId}`,
      })
    }
  }

  return groups
}
