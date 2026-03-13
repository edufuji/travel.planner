import { formatDate } from '@/lib/formatDate'
import type { TripEvent, EventType } from '@/types/trip'

const TYPE_COLORS: Record<EventType, string> = {
  transport: '#4A90D9',
  accommodation: '#7C3AED',
  ticket: '#059669',
  restaurant: '#F59E0B',
  walking: '#22C55E',
}

const TYPE_LABELS: Record<EventType, string> = {
  transport: 'Transport',
  accommodation: 'Accommodation',
  ticket: 'Ticket',
  restaurant: 'Restaurant',
  walking: 'On Foot',
}

interface Props {
  event: TripEvent
  onEdit: (event: TripEvent) => void
}

export default function TimelineEvent({ event, onEdit }: Props) {
  const timeDisplay =
    event.type === 'transport' && event.arrivalTime
      ? `🛫 ${event.time} · 🛬 ${event.arrivalTime}`
      : event.time

  const placeDisplay =
    event.type === 'transport' && event.placeTo
      ? `📍 ${event.place} → ${event.placeTo}`
      : event.place
        ? `📍 ${event.place}`
        : null

  return (
    <div className="relative">
      {/* Colored dot on the vertical line */}
      <div
        className="absolute left-[-14px] top-[10px] w-[10px] h-[10px] rounded-full border-2 border-white dark:border-background z-10"
        style={{ backgroundColor: TYPE_COLORS[event.type] }}
        aria-hidden="true"
      />
      {/* Card */}
      <div
        className="bg-white dark:bg-transparent border border-border rounded-lg px-3 py-2 cursor-pointer active:bg-input-bg"
        onClick={() => onEdit(event)}
        role="button"
        aria-label={`Edit ${event.title}`}
      >
        <div className="text-[10px] text-muted">{formatDate(event.date)} · {timeDisplay}</div>
        <div className="font-semibold text-foreground text-sm mt-0.5">{event.title}</div>
        {placeDisplay && (
          <div className="text-[10px] text-muted mt-0.5">{placeDisplay}</div>
        )}
        <div className="text-[10px] text-muted mt-0.5">
          {TYPE_LABELS[event.type]}
          {event.value != null ? ` · ${event.value}` : ''}
        </div>
      </div>
    </div>
  )
}
