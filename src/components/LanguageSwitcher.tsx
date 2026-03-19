import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const LANGUAGES = [
  { code: 'pt-BR', label: 'PT' },
  { code: 'en',   label: 'EN' },
  { code: 'es',   label: 'ES' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => i18n.changeLanguage(code)}
          aria-pressed={i18n.language === code}
          className={cn(
            'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
            i18n.language === code
              ? 'bg-primary text-white'
              : 'text-muted hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
