import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { detectGaps } from '@/lib/gapDetection'
import { formatDate } from '@/lib/formatDate'
import type { Destination } from '@/types/trip'

interface Props {
  destination: Destination
  onDelete: (id: string) => void
}

export default function DestinationRow({ destination, onDelete }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const gaps = detectGaps(destination.events)
  const hasGaps = gaps.length > 0
  const hasEvents = destination.events.length > 0

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(t('trips.deleteConfirm'))) {
      onDelete(destination.id)
    }
  }

  return (
    <div
      className="bg-white dark:bg-transparent border border-border rounded-[10px] p-3 flex items-center gap-3 cursor-pointer active:bg-input-bg"
      onClick={() => navigate(`/trips/${destination.id}`)}
      onContextMenu={(e) => { e.preventDefault(); handleDelete(e) }}
      role="button"
      aria-label={destination.title}
    >
      <span className="text-2xl" aria-hidden="true">{destination.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-foreground text-sm truncate">{destination.title}</div>
        <div className="text-xs text-muted">
          {formatDate(destination.startDate)} – {formatDate(destination.endDate)}
        </div>
      </div>
      {hasGaps && (
        <span className="text-xs font-bold bg-[#FFF7ED] dark:bg-transparent dark:border dark:border-[#C75B2A] text-[#C75B2A] rounded px-1.5 py-0.5 shrink-0">
          {t('status.gap')}
        </span>
      )}
      {!hasGaps && hasEvents && (
        <span className="text-xs font-bold bg-[#F0FDF4] dark:bg-transparent dark:border dark:border-[#059669] text-[#059669] rounded px-1.5 py-0.5 shrink-0">
          {t('status.ok')}
        </span>
      )}
    </div>
  )
}
