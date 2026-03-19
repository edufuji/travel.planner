import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useTripsStore } from '@/stores/tripsStore'
import type { Destination } from '@/types/trip'

const LEGACY_KEY = 'tripmate-trips'

function readLegacyDestinations(): Destination[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    // Zustand persist format: { state: { destinations: [...] }, version: 0 }
    return Array.isArray(parsed?.state?.destinations) ? parsed.state.destinations : []
  } catch {
    return []
  }
}

export default function LocalDataImport() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const addDestination = useTripsStore(s => s.addDestination)
  const addEvent = useTripsStore(s => s.addEvent)
  const [importing, setImporting] = useState(false)
  const [legacy, setLegacy] = useState<Destination[]>([])

  useEffect(() => {
    if (user) {
      setLegacy(readLegacyDestinations())
    }
  }, [user?.id])

  if (!user || legacy.length === 0) return null

  async function handleImport() {
    setImporting(true)
    try {
      for (const dest of legacy) {
        const created = await addDestination(user!.id, {
          title: dest.title,
          emoji: dest.emoji,
          startDate: dest.startDate,
          endDate: dest.endDate,
        })
        for (const event of dest.events) {
          await addEvent(created.id, user!.id, {
            type: event.type,
            title: event.title,
            place: event.place,
            placeId: event.placeId,
            lat: event.lat,
            lng: event.lng,
            placeTo: event.placeTo,
            placeIdTo: event.placeIdTo,
            latTo: event.latTo,
            lngTo: event.lngTo,
            arrivalTime: event.arrivalTime,
            date: event.date,
            time: event.time,
            value: event.value,
            notes: event.notes,
            arrivedOnFoot: event.arrivedOnFoot,
          })
        }
      }
      localStorage.removeItem(LEGACY_KEY)
      setLegacy([])
    } catch (err) {
      console.error('Import failed:', err)
    } finally {
      setImporting(false)
    }
  }

  function handleDismiss() {
    localStorage.removeItem(LEGACY_KEY)
    setLegacy([])
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 bg-white border border-border rounded-xl p-4 shadow-lg z-50">
      <p className="text-sm font-semibold text-foreground mb-1">
        {t('localImport.banner', { count: legacy.length })}
      </p>
      <p className="text-xs text-muted mb-3">
        {t('localImport.subtitle')}
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-bold disabled:opacity-70"
        >
          {importing ? t('localImport.importing') : t('localImport.importButton')}
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 bg-input-bg text-muted rounded-lg py-2 text-sm font-medium"
        >
          {t('localImport.dismiss')}
        </button>
      </div>
    </div>
  )
}
