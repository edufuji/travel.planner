import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Map, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40">
      <div className="flex justify-around items-center py-2">
        <NavLink
          to="/trips"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-6 py-1 text-xs font-semibold transition-colors',
              isActive ? 'text-primary' : 'text-muted'
            )
          }
        >
          <Map size={20} />
          {t('nav.trips')}
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-6 py-1 text-xs font-semibold transition-colors',
              isActive ? 'text-primary' : 'text-muted'
            )
          }
        >
          <User size={20} />
          {t('nav.profile')}
        </NavLink>
      </div>
    </nav>
  )
}
