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
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})

  const isEdit = !!editEvent

  useEffect(() => {
    if (open && editEvent) {
      setType(editEvent.type)
      setTitle(editEvent.title)
      setPlace(editEvent.place)
      setPlaceId(editEvent.placeId)
      setDate(editEvent.date)
      setTime(editEvent.time)
      setValue(editEvent.value?.toString() ?? '')
      setNotes(editEvent.notes ?? '')
    } else if (open && !editEvent) {
      setType('transport')
      setTitle('')
      setPlace('')
      setPlaceId(undefined)
      setDate('')
      setTime('')
      setValue('')
      setNotes('')
    }
    setErrors({})
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
      date,
      time,
      value: value !== '' ? Number(value) : undefined,
      notes: notes.trim() || undefined,
    }

    if (isEdit) {
      updateEvent(destinationId, editEvent!.id, data)
    } else {
      addEvent(destinationId, data)
    }
    onClose()
  }

  function handleDelete() {
    if (window.confirm('Delete this event?')) {
      deleteEvent(destinationId, editEvent!.id)
      onClose()
    }
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
              onClick={() => { setType(t.value); setTitle('') }}
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

        {/* Place */}
        <div>
          <GooglePlacesInput
            value={place}
            onChange={(p, id) => { setPlace(p); setPlaceId(id) }}
            placeholder="📍 Search place"
            className={inputClass(errors.place)}
          />
          {errors.place && <p className="text-red-500 text-xs mt-1">{errors.place}</p>}
        </div>

        {/* Date + Time */}
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
              aria-label="Event time"
              className={cn(
                'w-full bg-input-bg border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary',
                errors.time ? 'border-red-500' : 'border-border'
              )}
            />
            {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
          </div>
        </div>

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
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full text-red-500 text-sm font-medium py-1 hover:text-red-600 transition-colors"
          >
            Delete event
          </button>
        )}
      </form>
    </BottomSheet>
  )
}
