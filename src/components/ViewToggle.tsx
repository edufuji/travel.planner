import { motion } from 'framer-motion'
import { List, Map } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type View = 'timeline' | 'map'

interface ViewToggleProps {
  active: View
  onChange: (view: View) => void
}

const btnBase = 'flex-1 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition-colors'
const snappy = { type: 'spring', stiffness: 400, damping: 17 } as const

export default function ViewToggle({ active, onChange }: ViewToggleProps) {
  const { t } = useTranslation()
  return (
    <div className="flex w-full bg-input-bg rounded-full p-0.5" role="group" aria-label={t('view.toggleLabel')}>
      <motion.button
        className={cn(btnBase, active === 'timeline' ? 'bg-primary text-white' : 'bg-input-bg text-muted')}
        aria-pressed={active === 'timeline'}
        onClick={() => onChange('timeline')}
        whileTap={{ scale: 0.9 }}
        transition={snappy}
      >
        <List size={14} />
        {t('view.timeline')}
      </motion.button>
      <motion.button
        className={cn(btnBase, active === 'map' ? 'bg-primary text-white' : 'bg-input-bg text-muted')}
        aria-pressed={active === 'map'}
        onClick={() => onChange('map')}
        whileTap={{ scale: 0.9 }}
        transition={snappy}
      >
        <Map size={14} />
        {t('view.map')}
      </motion.button>
    </div>
  )
}
