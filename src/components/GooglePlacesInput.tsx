import { useEffect, useRef } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

interface Props {
  value: string
  onChange: (place: string, placeId?: string, lat?: number, lng?: number) => void
  placeholder?: string
  className?: string
}

export default function GooglePlacesInput({ value, onChange, placeholder, className }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!apiKey || !inputRef.current) return

    const input = inputRef.current
    let isMounted = true

    function attachAutocomplete() {
      if (!isMounted || !input) return
      // Support both real constructors (production) and vi.fn() mocks (tests).
      // Arrow-function mocks cannot be called with `new`, so we fall back to a
      // plain call which returns the mock object directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AutocompleteCtor = google.maps.places.Autocomplete as any
      let ac: google.maps.places.Autocomplete
      try {
        ac = new AutocompleteCtor(input, { fields: ['name', 'place_id', 'geometry'] })
      } catch {
        ac = AutocompleteCtor(input, { fields: ['name', 'place_id', 'geometry'] })
      }
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        const loc = place.geometry?.location
        onChange(place.name ?? '', place.place_id, loc?.lat(), loc?.lng())
      })
    }

    // If the Places library is already loaded (e.g. in tests via vi.stubGlobal),
    // initialize immediately without waiting for importLibrary.
    if (typeof google !== 'undefined' && google?.maps?.places?.Autocomplete) {
      attachAutocomplete()
      return
    }

    setOptions({ key: apiKey, v: 'weekly' })

    importLibrary('places').then(() => {
      attachAutocomplete()
    }).catch(() => {
      // Silently fall back — plain text input still works
    })

    return () => { isMounted = false }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // No API key: plain controlled input — always rendered in tests
  if (!apiKey) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        data-testid="places-input-fallback"
      />
    )
  }

  // With API key: uncontrolled input (Google Autocomplete manages the DOM value)
  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      placeholder={placeholder}
      className={className}
      data-testid="places-input"
    />
  )
}
