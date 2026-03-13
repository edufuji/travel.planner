import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { buildMapSegments, GAP_COLOR, TYPE_COLORS } from '@/lib/buildMapSegments'
import { useTimelineGroups } from '@/lib/useTimelineGroups'
import type { TripEvent } from '@/types/trip'
import type { GapWarning } from '@/lib/gapDetection'

interface Props {
  events: TripEvent[]
  gaps: GapWarning[]
  onEdit: (event: TripEvent) => void
}

export default function MapView({ events, gaps, onEdit }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const onEditRef = useRef(onEdit)
  const [error, setError] = useState(false)

  const positionedEvents = events.filter(
    (e): e is TripEvent & { lat: number; lng: number } =>
      e.lat !== undefined && e.lng !== undefined
  )
  const missingCoordCount = events.length - positionedEvents.length

  const groups = useTimelineGroups(events, gaps)

  useEffect(() => { onEditRef.current = onEdit }, [onEdit])

  const handleSidebarClick = (event: TripEvent) => {
    if (event.lat !== undefined && event.lng !== undefined && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: event.lat, lng: event.lng })
      mapInstanceRef.current.setZoom(14)
    }
  }

  useEffect(() => {
    if (!apiKey || !mapRef.current) return

    setOptions({ key: apiKey, v: 'weekly' })

    importLibrary('maps')
      .then(() => {
        if (!mapRef.current) return

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new google.maps.Map(mapRef.current, {
            zoom: 10,
            center: { lat: 0, lng: 0 },
          })
        }

        const map = mapInstanceRef.current

        markersRef.current.forEach(m => {
          google.maps.event.clearInstanceListeners(m)
          m.setMap(null)
        })
        polylinesRef.current.forEach(p => {
          google.maps.event.clearInstanceListeners(p)
          p.setMap(null)
        })
        markersRef.current = []
        polylinesRef.current = []

        const bounds = new google.maps.LatLngBounds()
        positionedEvents.forEach(event => {
          const marker = new google.maps.Marker({
            position: { lat: event.lat, lng: event.lng },
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: TYPE_COLORS[event.type],
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8,
            },
          })
          marker.addListener('click', () => onEditRef.current(event))
          markersRef.current.push(marker)
          bounds.extend({ lat: event.lat, lng: event.lng })

          // Arrival pin for transport events with destination coords
          if (
            event.type === 'transport' &&
            event.latTo !== undefined &&
            event.lngTo !== undefined
          ) {
            const arrivalMarker = new google.maps.Marker({
              position: { lat: event.latTo, lng: event.lngTo },
              map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: TYPE_COLORS[event.type],
                fillOpacity: 0.6,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 6,
              },
            })
            arrivalMarker.addListener('click', () => onEditRef.current(event))
            markersRef.current.push(arrivalMarker)
            bounds.extend({ lat: event.latTo, lng: event.lngTo })
          }
        })

        const segments = buildMapSegments(events, gaps)
        segments.forEach(segment => {
          const polyline = segment.isGap
            ? new google.maps.Polyline({
                path: [segment.from, segment.to],
                strokeColor: GAP_COLOR,
                strokeWeight: 3,
                strokeOpacity: 0,
                icons: [{
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: GAP_COLOR,
                    fillOpacity: 1,
                    strokeColor: GAP_COLOR,
                    strokeOpacity: 1,
                    scale: 3,
                  },
                  offset: '0',
                  repeat: '8px',
                }],
                map,
              })
            : new google.maps.Polyline({
                path: [segment.from, segment.to],
                strokeColor: segment.color,
                strokeWeight: 3,
                strokeOpacity: 1,
                map,
              })
          polylinesRef.current.push(polyline)
        })

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds)
        }
      })
      .catch(() => {
        setError(true)
      })

    return () => {
      if (typeof google === 'undefined') return
      markersRef.current.forEach(m => {
        google.maps.event.clearInstanceListeners(m)
        m.setMap(null)
      })
      polylinesRef.current.forEach(p => {
        google.maps.event.clearInstanceListeners(p)
        p.setMap(null)
      })
    }
  }, [events, gaps])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!apiKey) {
    return (
      <div
        data-testid="map-unavailable"
        className="flex-1 min-h-0 flex items-center justify-center bg-input-bg text-center px-6"
      >
        <p className="text-sm text-muted">
          Map unavailable — add VITE_GOOGLE_MAPS_API_KEY to .env to enable.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div
        data-testid="map-error"
        className="flex-1 min-h-0 flex items-center justify-center bg-input-bg text-center px-6"
      >
        <p className="text-sm text-muted">Failed to load map</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-row relative">
      {/* Left sidebar */}
      <div className="w-[38%] min-h-0 overflow-y-auto bg-surface border-r border-border flex flex-col">
        {groups.map(group => (
          <div key={group.date}>
            <div className="px-3 py-1 text-xs font-semibold text-muted bg-input-bg sticky top-0">
              {group.label}
            </div>
            {group.items.map(item => {
              if (item.kind === 'gap') {
                return (
                  <div key={item.key} className="px-3 py-1 text-xs text-warning">
                    {item.message}
                  </div>
                )
              }
              return (
                <button
                  key={item.event.id}
                  aria-label={item.event.title}
                  onClick={() => handleSidebarClick(item.event)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-input-bg transition-colors truncate"
                >
                  {item.event.title}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Map area */}
      <div className="flex-1 min-h-0 relative">
        <div ref={mapRef} className="w-full h-full" />
        {missingCoordCount > 0 && (
          <div
            data-testid="map-no-location-banner"
            className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-2"
          >
            {missingCoordCount} event(s) not shown — no location data
          </div>
        )}
      </div>
    </div>
  )
}
