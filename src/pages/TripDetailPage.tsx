import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTripsStore } from '@/stores/tripsStore'
import { detectGaps } from '@/lib/gapDetection'
import TimelineEvent from '@/components/TimelineEvent'
import GapWarningCard from '@/components/GapWarningCard'
import AddEventSheet from '@/components/sheets/AddEventSheet'
import BottomNav from '@/components/BottomNav'
import type { TripEvent } from '@/types/trip'

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const destination = useTripsStore(s => s.destinations.find(d => d.id === id))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<TripEvent | undefined>()

  if (!destination) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted">Destination not found</p>
          <button
            onClick={() => navigate('/trips')}
            className="text-primary text-sm font-semibold mt-2 block"
          >
            ← Back to trips
          </button>
        </div>
      </div>
    )
  }

  const sortedEvents = [...destination.events].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  )
  const gaps = detectGaps(sortedEvents)

  type RenderItem =
    | { kind: 'event'; event: TripEvent }
    | { kind: 'gap'; message: string; key: string }

  const items: RenderItem[] = []
  sortedEvents.forEach(event => {
    items.push({ kind: 'event', event })
    const gap = gaps.find(g => g.afterEventId === event.id)
    if (gap) {
      items.push({ kind: 'gap', message: gap.message, key: `gap-${gap.afterEventId}` })
    }
  })

  function openAddSheet() {
    setEditEvent(undefined)
    setSheetOpen(true)
  }

  function openEditSheet(event: TripEvent) {
    setEditEvent(event)
    setSheetOpen(true)
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate('/trips')}
          className="text-muted text-sm font-medium shrink-0"
        >
          ‹ Trips
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold text-foreground truncate">
            {destination.emoji} {destination.title}
          </h1>
          <p className="text-xs text-muted">
            {destination.startDate} – {destination.endDate} · {destination.events.length} event{destination.events.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openAddSheet}
          className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shrink-0 hover:bg-primary-dark transition-colors"
          aria-label="Add event"
        >
          +
        </button>
      </div>

      {/* Timeline */}
      <div className="px-4">
        {sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">📅</div>
            <p className="text-sm text-muted">No events yet. Tap + to add your first.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border" aria-hidden="true" />
            <div className="space-y-3 pl-5">
              {items.map((item) =>
                item.kind === 'event' ? (
                  <TimelineEvent
                    key={item.event.id}
                    event={item.event}
                    onEdit={openEditSheet}
                  />
                ) : (
                  <GapWarningCard key={item.key} message={item.message} />
                )
              )}
            </div>
          </div>
        )}
      </div>

      <AddEventSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        destinationId={destination.id}
        editEvent={editEvent}
      />
      <BottomNav />
    </div>
  )
}
