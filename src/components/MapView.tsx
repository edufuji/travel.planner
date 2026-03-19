import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { Plane, BedDouble, Ticket, Utensils } from 'lucide-react'
import { buildMapSegments, TYPE_COLORS } from '@/lib/buildMapSegments'
import { useTimelineGroups } from '@/lib/useTimelineGroups'
import TimelineDateHeader from '@/components/TimelineDateHeader'
import GapWarningCard from '@/components/GapWarningCard'
import type { TripEvent, EventType } from '@/types/trip'
import type { GapWarning } from '@/lib/gapDetection'

const TYPE_ICONS: Record<EventType, React.FC<{ size?: number; color?: string }>> = {
  transport: Plane,
  accommodation: BedDouble,
  ticket: Ticket,
  restaurant: Utensils,
}

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
]

interface Props {
  events: TripEvent[]
  gaps: GapWarning[]
  onEdit: (event: TripEvent) => void
}

export default function MapView({ events, gaps, onEdit }: Props) {
  const { t, i18n } = useTranslation()
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylinesRef = useRef<google.maps.Polyline[]>([])
  const onEditRef = useRef(onEdit)
  const [error, setError] = useState(false)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  const positionedEvents = events.filter(
    (e): e is TripEvent & { lat: number; lng: number } =>
      e.lat !== undefined && e.lng !== undefined
  )
  const missingCoordCount = events.length - positionedEvents.length

  const groups = useTimelineGroups(events, gaps, i18n.language)

  useEffect(() => { onEditRef.current = onEdit }, [onEdit])

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current) return
    mapInstanceRef.current.setOptions({ styles: isDark ? DARK_MAP_STYLES : [] })
  }, [isDark])

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
        segments.forEach(seg => {
          let polyline: google.maps.Polyline
          if (seg.isGap) {
            polyline = new google.maps.Polyline({
              path: [seg.from, seg.to],
              strokeColor: seg.color,
              strokeOpacity: 0,
              icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '10px' }],
              map,
            })
          } else if (seg.isWalking) {
            polyline = new google.maps.Polyline({
              path: [seg.from, seg.to],
              strokeColor: seg.color,
              strokeOpacity: 0,
              icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 }, offset: '0', repeat: '6px' }],
              map,
            })
          } else {
            polyline = new google.maps.Polyline({
              path: [seg.from, seg.to],
              strokeColor: seg.color,
              strokeOpacity: 0.85,
              strokeWeight: 3,
              map,
            })
          }
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
      markersRef.current = []
      polylinesRef.current = []
    }
  }, [events, gaps])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!apiKey) {
    return (
      <div
        data-testid="map-unavailable"
        className="flex-1 min-h-0 flex items-center justify-center bg-input-bg text-center px-6"
      >
        <p className="text-sm text-muted">
          {t('map.unavailable')}
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
        <p className="text-sm text-muted">{t('map.loadError')}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-row relative">
      {/* Left sidebar */}
      <div className="w-[38%] min-h-0 overflow-y-auto bg-surface border-r border-border flex flex-col">
        {groups.map(group => (
          <div key={group.date}>
            <TimelineDateHeader label={group.label} />
            {group.items.map(item => {
              if (item.kind === 'gap') {
                return (
                  <GapWarningCard key={item.key} fromTitle={item.fromTitle} toTitle={item.toTitle} />
                )
              }
              return (
                <button
                  key={item.event.id}
                  aria-label={item.event.title}
                  onClick={() => handleSidebarClick(item.event)}
                  className="w-full text-left px-3 py-1 hover:bg-input-bg transition-colors"
                >
                  <div className="flex items-center gap-2 p-2 border border-border rounded-lg bg-white dark:bg-transparent">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[item.event.type] }} />
                    {(() => { const Icon = TYPE_ICONS[item.event.type]; return <Icon size={14} color={TYPE_COLORS[item.event.type]} /> })()}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-muted">{item.event.time}</div>
                      <div className="text-xs font-semibold text-foreground truncate">{item.event.title}</div>
                    </div>
                    {item.event.value != null && (
                      <div className="text-[10px] text-muted shrink-0">{item.event.value}</div>
                    )}
                  </div>
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
            {t('map.missingCoords', { count: missingCoordCount })}
          </div>
        )}
      </div>
    </div>
  )
}
