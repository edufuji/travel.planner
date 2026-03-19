import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import BottomSheet from '@/components/BottomSheet'
import GooglePlacesInput from '@/components/GooglePlacesInput'
import { useTripsStore } from '@/stores/tripsStore'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import type { TripEvent, EventType } from '@/types/trip'

interface Props {
  open: boolean
  onClose: () => void
  destinationId: string
  editEvent?: TripEvent
}

type FormErrors = Partial<Record<'title' | 'place' | 'date' | 'time' | 'value', string>>

const initialFormState = {
  type: 'transport' as EventType,
  title: '',
  place: '',
  placeId: undefined as string | undefined,
  lat: undefined as number | undefined,
  lng: undefined as number | undefined,
  placeTo: '',
  placeIdTo: undefined as string | undefined,
  latTo: undefined as number | undefined,
  lngTo: undefined as number | undefined,
  arrivalTime: '',
  date: '',
  time: '',
  value: '',
  notes: '',
  arrivedOnFoot: false,
}

export default function AddEventSheet({ open, onClose, destinationId, editEvent }: Props) {
  const { t } = useTranslation()

  const EVENT_TYPES: { value: EventType; label: string }[] = [
    { value: 'transport', label: t('eventTypes.transport') },
    { value: 'accommodation', label: t('eventTypes.accommodation') },
    { value: 'ticket', label: t('eventTypes.ticket') },
    { value: 'restaurant', label: t('eventTypes.restaurant') },
  ]

  const TYPE_PLACEHOLDERS: Record<EventType, string> = {
    transport: t('event.placeholderTransport'),
    accommodation: t('event.placeholderAccommodation'),
    ticket: t('event.placeholderTicket'),
    restaurant: t('event.placeholderRestaurant'),
  }

  const addEvent = useTripsStore(s => s.addEvent)
  const updateEvent = useTripsStore(s => s.updateEvent)
  const deleteEvent = useTripsStore(s => s.deleteEvent)
  const { user } = useAuth()

  const [formData, setFormData] = useState(initialFormState)
  const [errors, setErrors] = useState<FormErrors>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isEdit = !!editEvent

  const updateForm = (updates: Partial<typeof initialFormState>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  useEffect(() => {
    if (open && editEvent) {
      setFormData({
        type: editEvent.type,
        title: editEvent.title,
        place: editEvent.place,
        placeId: editEvent.placeId,
        lat: editEvent.lat,
        lng: editEvent.lng,
        placeTo: editEvent.placeTo ?? '',
        placeIdTo: editEvent.placeIdTo,
        latTo: editEvent.latTo,
        lngTo: editEvent.lngTo,
        arrivalTime: editEvent.arrivalTime ?? '',
        date: editEvent.date,
        time: editEvent.time,
        value: editEvent.value?.toString() ?? '',
        notes: editEvent.notes ?? '',
        arrivedOnFoot: editEvent.arrivedOnFoot ?? false,
      })
    } else if (open && !editEvent) {
      setFormData(initialFormState)
    }
    setErrors({})
    setConfirmDelete(false)
  }, [open, editEvent])

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!formData.title.trim()) errs.title = t('event.titleRequired')
    if (!formData.place.trim()) errs.place = t('event.placeRequired')
    if (!formData.date) errs.date = t('event.dateRequired')
    if (!formData.time) errs.time = t('event.timeRequired')
    if (formData.value !== '' && (isNaN(Number(formData.value)) || Number(formData.value) <= 0)) {
      errs.value = t('event.costError')
    }
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const data = {
      type: formData.type,
      title: formData.title.trim(),
      place: formData.place.trim(),
      placeId: formData.placeId,
      lat: formData.lat,
      lng: formData.lng,
      ...(formData.type === 'transport' ? {
        placeTo: formData.placeTo.trim() || undefined,
        placeIdTo: formData.placeTo.trim() ? formData.placeIdTo : undefined,
        latTo: formData.placeTo.trim() ? formData.latTo : undefined,
        lngTo: formData.placeTo.trim() ? formData.lngTo : undefined,
        arrivalTime: formData.arrivalTime || undefined,
      } : {}),
      date: formData.date,
      time: formData.time,
      value: formData.value !== '' ? Number(formData.value) : undefined,
      notes: formData.notes.trim() || undefined,
      arrivedOnFoot: formData.arrivedOnFoot || undefined,
    }

    try {
      if (isEdit) {
        await updateEvent(destinationId, editEvent!.id, data)
      } else {
        await addEvent(destinationId, user!.id, data)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save event:', err)
    }
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
    <BottomSheet open={open} onClose={onClose} title={isEdit ? t('event.editTitle') : t('event.addTitle')}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Type selector pills */}
        <div className="flex gap-2 flex-wrap">
          {EVENT_TYPES.map((typeItem) => (
            <button
              key={typeItem.value}
              type="button"
              onClick={() => {
                updateForm({
                  type: typeItem.value,
                  title: '',
                  placeTo: '',
                  placeIdTo: undefined,
                  latTo: undefined,
                  lngTo: undefined,
                  arrivalTime: ''
                })
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                formData.type === typeItem.value ? 'bg-primary text-white' : 'bg-input-bg text-muted'
              )}
            >
              {typeItem.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <div>
          <input
            type="text"
            value={formData.title}
            onChange={e => updateForm({ title: e.target.value })}
            placeholder={TYPE_PLACEHOLDERS[formData.type]}
            className={inputClass(errors.title)}
            aria-label={t('event.titleLabel')}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>

        {/* Place — transport gets From + To, others get single input */}
        {formData.type === 'transport' ? (
          <>
            <div>
              <GooglePlacesInput
                value={formData.place}
                onChange={(p, id, la, ln) => updateForm({ place: p, placeId: id, lat: la, lng: ln }) }
                placeholder={t('event.placeholderFrom')}
                className={inputClass(errors.place)}
              />
              {errors.place && <p className="text-red-500 text-xs mt-1">{errors.place}</p>}
            </div>
            <div className="text-center text-[#C75B2A] text-lg leading-none" aria-hidden="true">↓</div>
            <div>
              <GooglePlacesInput
                value={formData.placeTo}
                onChange={(p, id, la, ln) => updateForm({ placeTo: p, placeIdTo: id, latTo: la, lngTo: ln }) }
                placeholder={t('event.placeholderTo')}
                className={inputClass()}
              />
            </div>
          </>
        ) : (
          <div>
            <GooglePlacesInput
              value={formData.place}
              onChange={(p, id, la, ln) => updateForm({ place: p, placeId: id, lat: la, lng: ln }) }
              placeholder={t('event.placeholderPlace')}
              className={inputClass(errors.place)}
            />
            {errors.place && <p className="text-red-500 text-xs mt-1">{errors.place}</p>}
          </div>
        )}

        {/* Arrived on foot toggle */}
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={formData.arrivedOnFoot}
            onChange={e => updateForm({ arrivedOnFoot: e.target.checked })}
            aria-label={t('event.arrivedOnFoot')}
          />
          {t('event.arrivedOnFoot')}
        </label>

        {/* Date + Departure time */}
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="date"
              value={formData.date}
              onChange={e => updateForm({ date: e.target.value })}
              aria-label={t('event.dateLabel')}
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
              value={formData.time}
              onChange={e => updateForm({ time: e.target.value })}
              aria-label={formData.type === 'transport' ? t('event.departureTimeLabel') : t('event.timeLabel')}
              className={cn(
                'w-full bg-input-bg border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary',
                errors.time ? 'border-red-500' : 'border-border'
              )}
            />
            {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
          </div>
        </div>

        {/* Arrival time — transport only */}
        {formData.type === 'transport' && (
          <div>
            <input
              type="time"
              value={formData.arrivalTime}
              onChange={e => updateForm({ arrivalTime: e.target.value })}
              aria-label={t('event.arrivalTimeLabel')}
              className="w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              placeholder={t('event.arrivalTimePlaceholder')}
            />
          </div>
        )}

        {/* Value */}
        <div>
          <input
            type="text"
            inputMode="decimal"
            value={formData.value}
            onChange={e => updateForm({ value: e.target.value })}
            placeholder={t('event.costPlaceholder')}
            className={inputClass(errors.value)}
            aria-label={t('event.costLabel')}
          />
          {errors.value && <p className="text-red-500 text-xs mt-1">{errors.value}</p>}
        </div>

        {/* Notes */}
        <textarea
          value={formData.notes}
          onChange={e => updateForm({ notes: e.target.value })}
          placeholder={t('event.notesPlaceholder')}
          rows={2}
          className="w-full bg-input-bg border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary resize-none"
          aria-label={t('event.notesLabel')}
        />

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold hover:bg-primary-dark transition-colors"
        >
          {isEdit ? t('event.saveButton') : t('event.addButton')}
        </button>

        {/* Delete (edit mode only) */}
        {isEdit && !confirmDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full text-red-500 text-sm font-medium py-1 hover:text-red-600 transition-colors"
          >
            {t('event.deleteButton')}
          </button>
        )}
        {isEdit && confirmDelete && (
          <div>
            <p className="text-sm text-foreground mb-2">{t('event.deleteConfirmLabel')}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => { try { await deleteEvent(destinationId, editEvent!.id); onClose() } catch (err) { console.error('Failed to delete event:', err) } }}
                className="flex-1 bg-red-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-red-600 transition-colors"
              >
                {t('event.confirmDeleteButton')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 bg-input-bg text-foreground rounded-xl py-3 text-sm font-bold hover:bg-border transition-colors"
              >
                {t('event.cancelButton')}
              </button>
            </div>
          </div>
        )}
      </form>
    </BottomSheet>
  )
}
