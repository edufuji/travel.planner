import { useState } from 'react'
import { useTripsStore } from '@/stores/tripsStore'
import DestinationRow from '@/components/DestinationRow'
import NewDestinationSheet from '@/components/sheets/NewDestinationSheet'
import BottomNav from '@/components/BottomNav'

export default function TripsPage() {
  const destinations = useTripsStore(s => s.destinations)
  const deleteDestination = useTripsStore(s => s.deleteDestination)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-4 pt-12 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">My Trips</h1>
          <p className="text-xs text-muted">
            {destinations.length} destination{destinations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setSheetOpen(true)}
          className="bg-primary text-white rounded-full px-4 py-2 text-sm font-bold hover:bg-primary-dark transition-colors"
        >
          + New
        </button>
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {destinations.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-24 text-center">
            <div className="text-5xl mb-4" aria-hidden="true">🗺️</div>
            <h2 className="text-lg font-bold text-foreground mb-1">No trips yet</h2>
            <p className="text-sm text-muted mb-6">Start planning your next adventure</p>
            <button
              onClick={() => setSheetOpen(true)}
              className="bg-primary text-white rounded-full px-6 py-2.5 text-sm font-bold hover:bg-primary-dark transition-colors"
            >
              Plan your first trip
            </button>
          </div>
        ) : (
          <>
            {destinations.map(d => (
              <DestinationRow
                key={d.id}
                destination={d}
                onDelete={deleteDestination}
              />
            ))}
            <div
              className="border-2 border-dashed border-border rounded-[10px] p-3 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setSheetOpen(true)}
              role="button"
            >
              <span className="text-sm text-muted">+ Plan a new destination</span>
            </div>
          </>
        )}
      </div>

      <NewDestinationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <BottomNav />
    </div>
  )
}
