import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BottomSheet from '@/components/BottomSheet'
import { useTripsStore } from '@/stores/tripsStore'
import { assignEmoji } from '@/lib/travelEmojis'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  open: boolean
  onClose: () => void
}

export default function NewDestinationSheet({ open, onClose }: Props) {
  const { t } = useTranslation()
  const addDestination = useTripsStore(s => s.addDestination)
  const destinations = useTripsStore(s => s.destinations)
  const { user } = useAuth()

  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [errors, setErrors] = useState<{ title?: string; endDate?: string }>({})

  const previewEmoji = assignEmoji(destinations.length)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!title.trim()) errs.title = t('destination.titleRequired')
    if (endDate && startDate && endDate < startDate) errs.endDate = t('destination.endDateError')
    if (Object.keys(errs).length) { setErrors(errs); return }

    try {
      await addDestination(user!.id, { title: title.trim(), startDate, endDate, emoji: '' })
      setTitle('')
      setStartDate('')
      setEndDate('')
      setErrors({})
      onClose()
    } catch (err) {
      setErrors({ title: err instanceof Error ? err.message : 'Failed to create destination' })
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('destination.newTitle')}>
      <div className="text-center text-4xl mb-1" aria-hidden="true">{previewEmoji}</div>
      <div className="text-xs text-muted text-center mb-4">{t('destination.autoIcon')}</div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={t('destination.titlePlaceholder')}
            aria-label={t('destination.titleLabel')}
            className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${
              errors.title ? 'border-red-500' : 'border-border'
            }`}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-foreground mb-1 block" htmlFor="dest-start">
              {t('destination.startDate')}
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
              {t('destination.endDate')}
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
          {t('destination.create')}
        </button>
      </form>
    </BottomSheet>
  )
}
