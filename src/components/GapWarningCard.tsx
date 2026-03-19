import { useTranslation } from 'react-i18next'

interface Props {
  fromTitle: string
  toTitle: string
}

export default function GapWarningCard({ fromTitle, toTitle }: Props) {
  const { t } = useTranslation()
  return (
    <div
      className="border border-dashed border-primary rounded-lg px-3 py-2 bg-[#FFF7ED] dark:bg-transparent"
      role="alert"
    >
      <p className="text-xs text-[#C75B2A] font-medium">
        ⚠️ {t('trip.gapWarning', { from: fromTitle, to: toTitle })}
      </p>
    </div>
  )
}
