import { useEffect, useRef } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

interface Props {
  value: string
  onChange: (place: string, placeId?: string) => void
  placeholder?: string
  className?: string
}

export default function GooglePlacesInput({ value, onChange, placeholder, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!apiKey || !inputRef.current) return

    let isMounted = true

    setOptions({ key: apiKey, v: 'weekly' })

    importLibrary('places').then(() => {
      if (!isMounted || !inputRef.current) return
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        fields: ['name', 'place_id'],
      })
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        onChange(place.name ?? '', place.place_id)
      })
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
