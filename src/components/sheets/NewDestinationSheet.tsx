import { useState } from 'react'
import BottomSheet from '@/components/BottomSheet'
import { useTripsStore } from '@/stores/tripsStore'
import { assignEmoji } from '@/lib/travelEmojis'

interface Props {
  open: boolean
  onClose: () => void
}

export default function NewDestinationSheet({ open, onClose }: Props) {
  const addDestination = useTripsStore(s => s.addDestination)
  const destinations = useTripsStore(s => s.destinations)

  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [errors, setErrors] = useState<{ title?: string; endDate?: string }>({})

  const previewEmoji = assignEmoji(destinations.length)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (endDate && startDate && endDate < startDate) errs.endDate = 'End date must be after start date'
    if (Object.keys(errs).length) { setErrors(errs); return }

    addDestination({ title: title.trim(), startDate, endDate, emoji: '' })
    setTitle('')
    setStartDate('')
    setEndDate('')
    setErrors({})
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="New Destination">
      <div className="text-center text-4xl mb-1" aria-hidden="true">{previewEmoji}</div>
      <div className="text-xs text-muted text-center mb-4">Auto-assigned icon</div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Japan 2026"
            aria-label="Trip title"
            className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
              errors.title ? 'border-red-500' : 'border-border'
            }`}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground mb-1 block" htmlFor="dest-start">
              Start Date
            </label>
            <input
              id="dest-start"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              className="w-full bg-input-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground mb-1 block" htmlFor="dest-end">
              End Date
            </label>
            <input
              id="dest-end"
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              required
              min={startDate}
              className={`w-full bg-input-bg border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary ${
                errors.endDate ? 'border-red-500' : 'border-border'
              }`}
            />
            {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold mt-2 hover:bg-primary-dark transition-colors"
        >
          Create Destination
        </button>
      </form>
    </BottomSheet>
  )
}
