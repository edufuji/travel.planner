import { useState, useEffect } from 'react'
import BottomSheet from '@/components/BottomSheet'
import GooglePlacesInput from '@/components/GooglePlacesInput'
import { useTripsStore } from '@/stores/tripsStore'
import { cn } from '@/lib/utils'
import type { TripEvent, EventType } from '@/types/trip'

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'transport', label: 'Transport' },
  { value: 'accommodation', label: 'Stay' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'restaurant', label: 'Food' },
]

const TYPE_PLACEHOLDERS: Record<EventType, string> = {
  transport: 'e.g. Flight GRU → NRT',
  accommodation: 'Hotel name',
  ticket: 'Museum or experience',
  restaurant: 'Restaurant name',
}

interface Props {
  open: boolean
  onClose: () => void
  destinationId: string
  editEvent?: TripEvent
}

type FormErrors = Partial<Record<'title' | 'place' | 'date' | 'time' | 'value', string>>

export default function AddEventSheet({ open, onClose, destinationId, editEvent }: Props) {
  const addEvent = useTripsStore(s => s.addEvent)
  const updateEvent = useTripsStore(s => s.updateEvent)
  const deleteEvent = useTripsStore(s => s.deleteEvent)

  const [type, setType] = useState<EventType>('transport')
  const [title, setTitle] = useState('')
  const [place, setPlace] = useState('')
  const [placeId, setPlaceId] = useState<string | undefined>()
  const [lat, setLat] = useState<number | undefined>()
  const [lng, setLng] = useState<number | undefined>()
  const [placeTo, setPlaceTo] = useState('')
  const [placeIdTo, setPlaceIdTo] = useState<string | undefined>()
  const [latTo, setLatTo] = useState<number | undefined>()
  const [lngTo, setLngTo] = useState<number | undefined>()
  const [arrivalTime, setArrivalTime] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [arrivedOnFoot, setArrivedOnFoot] = useState(false)

  const isEdit = !!editEvent

  useEffect(() => {
    if (open && editEvent) {
      setType(editEvent.type)
      setTitle(editEvent.title)
      setPlace(editEvent.place)
      setPlaceId(editEvent.placeId)
      setLat(editEvent.lat)
      setLng(editEvent.lng)
      setPlaceTo(editEvent.placeTo ?? '')
      setPlaceIdTo(editEvent.placeIdTo)
      setLatTo(editEvent.latTo)
      setLngTo(editEvent.lngTo)
      setArrivalTime(editEvent.arrivalTime ?? '')
      setDate(editEvent.date)
      setTime(editEvent.time)
      setValue(editEvent.value?.toString() ?? '')
      setNotes(editEvent.notes ?? '')
      setArrivedOnFoot(editEvent.arrivedOnFoot ?? false)
    } else if (open && !editEvent) {
      setType('transport')
      setTitle('')
      setPlace('')
      setPlaceId(undefined)
      setLat(undefined)
      setLng(undefined)
      setPlaceTo('')
      setPlaceIdTo(undefined)
      setLatTo(undefined)
      setLngTo(undefined)
      setArrivalTime('')
      setDate('')
      setTime('')
      setValue('')
      setNotes('')
      setArrivedOnFoot(false)
    }
    setErrors({})
    setConfirmDelete(false)
  }, [open, editEvent])

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (!place.trim()) errs.place = 'Place is required'
    if (!date) errs.date = 'Date is required'
    if (!time) errs.time = 'Time is required'
    if (value !== '' && (isNaN(Number(value)) || Number(value) <= 0)) {
      errs.value = 'Must be a positive number'
    }
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const data = {
      type,
      title: title.trim(),
      place: place.trim(),
      placeId,
      lat,
      lng,
      ...(type === 'transport' ? {
        placeTo: placeTo.trim() || undefined,
        placeIdTo: placeTo.trim() ? placeIdTo : undefined,
        latTo: placeTo.trim() ? latTo : undefined,
        lngTo: placeTo.trim() ? lngTo : undefined,
        arrivalTime: arrivalTime || undefined,
      } : {}),
      date,
      time,
      value: value !== '' ? Number(value) : undefined,
      notes: notes.trim() || undefined,
      arrivedOnFoot: arrivedOnFoot || undefined,
    }

    if (isEdit) {
      updateEvent(destinationId, editEvent!.id, data)
    } else {
      addEvent(destinationId, data)
    }
    onClose()
  }

  function handleDelete() {
    setConfirmDelete(true)
  }

  const inputClass = (hasError?: string) =>
    cn(
      'w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
      hasError ? 'border-red-500' : 'border-border'
    )

  return (
    <BottomSheet open={open} onClose={onClose} title={isEdit ? 'Edit Event' : 'Add Event'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Type selector pills */}
        <div className="flex gap-2 flex-wrap">
          {EVENT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setType(t.value)
                setTitle('')
                setPlaceTo('')
                setPlaceIdTo(undefined)
                setLatTo(undefined)
                setLngTo(undefined)
                setArrivalTime('')
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                type === t.value ? 'bg-primary text-white' : 'bg-input-bg text-muted'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={TYPE_PLACEHOLDERS[type]}
            className={inputClass(errors.title)}
            aria-label="Event title"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>

        {/* Place — transport gets From + To, others get single input */}
        {type === 'transport' ? (
          <>
            <div>
              <GooglePlacesInput
                value={place}
                onChange={(p, id, la, ln) => { setPlace(p); setPlaceId(id); setLat(la); setLng(ln) }}
                placeholder="🛫 From: departure place"
                className={inputClass(errors.place)}
              />
              {errors.place && <p className="text-red-500 text-xs mt-1">{errors.place}</p>}
            </div>
            <div className="text-center text-[#C75B2A] text-lg leading-none" aria-hidden="true">↓</div>
            <div>
              <GooglePlacesInput
                value={placeTo}
                onChange={(p, id, la, ln) => { setPlaceTo(p); setPlaceIdTo(id); setLatTo(la); setLngTo(ln) }}
                placeholder="🛬 To: arrival place"
                className={inputClass()}
              />
            </div>
          </>
        ) : (
          <div>
            <GooglePlacesInput
              value={place}
              onChange={(p, id, la, ln) => { setPlace(p); setPlaceId(id); setLat(la); setLng(ln) }}
              placeholder="📍 Search place"
              className={inputClass(errors.place)}
            />
            {errors.place && <p className="text-red-500 text-xs mt-1">{errors.place}</p>}
          </div>
        )}

        {/* Arrived on foot toggle */}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={arrivedOnFoot}
            onChange={e => setArrivedOnFoot(e.target.checked)}
            aria-label="Arrived on foot"
          />
          Arrived on foot
        </label>

        {/* Date + Departure time */}
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              aria-label="Event date"
              className={cn(
                'w-full bg-input-bg border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary',
                errors.date ? 'border-red-500' : 'border-border'
              )}
            />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
          </div>
          <div className="flex-1">
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              aria-label={type === 'transport' ? 'Departure time' : 'Event time'}
              className={cn(
                'w-full bg-input-bg border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary',
                errors.time ? 'border-red-500' : 'border-border'
              )}
            />
            {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
          </div>
        </div>

        {/* Arrival time — transport only */}
        {type === 'transport' && (
          <div>
            <input
              type="time"
              value={arrivalTime}
              onChange={e => setArrivalTime(e.target.value)}
              aria-label="Arrival time"
              className="w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              placeholder="Arrival time (optional)"
            />
          </div>
        )}

        {/* Value */}
        <div>
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Cost (optional)"
            className={inputClass(errors.value)}
            aria-label="Cost"
          />
          {errors.value && <p className="text-red-500 text-xs mt-1">{errors.value}</p>}
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any notes..."
          rows={2}
          className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary resize-none"
          aria-label="Notes"
        />

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold hover:bg-primary-dark transition-colors"
        >
          {isEdit ? 'Save Changes' : 'Add to Timeline'}
        </button>

        {/* Delete (edit mode only) */}
        {isEdit && !confirmDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full text-red-500 text-sm font-medium py-1 hover:text-red-600 transition-colors"
          >
            Delete event
          </button>
        )}
        {isEdit && confirmDelete && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { deleteEvent(destinationId, editEvent!.id); onClose() }}
              className="flex-1 bg-red-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-600 transition-colors"
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 bg-input-bg text-foreground rounded-xl py-3 text-sm font-bold hover:bg-border transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </BottomSheet>
  )
}
