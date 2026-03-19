import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BottomNav from '@/components/BottomNav'
import DarkModeToggle from '@/components/DarkModeToggle'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import PlansModal from '@/components/PlansModal'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

type Plan = 'free' | 'premium' | 'pro'

const PLAN_BADGE: Record<Plan, { label: string; className: string }> = {
  free: { label: 'Free', className: 'bg-stone-500' },
  premium: { label: 'Premium', className: 'bg-blue-500' },
  pro: { label: 'Pro ✦', className: 'bg-gradient-to-r from-amber-400 to-amber-600' },
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  // Plan 4 will replace this with real data from the profile store
  const plan = 'free' as Plan
  const badge = PLAN_BADGE[plan]

  const { t } = useTranslation()

  const [showPlans, setShowPlans] = useState(false)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-4">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-input-bg border-2 border-border flex items-center justify-center">
          <span className="text-3xl">👤</span>
        </div>

        {/* Email (full_name available after Plan 4 adds profile store) */}
        <h1 className="text-xl font-extrabold text-foreground">
          {user?.email ?? 'Unknown'}
        </h1>

        {/* Plan badge */}
        <span
          className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full text-white ${badge.className}`}
        >
          {badge.label}
        </span>

        {/* Upgrade card — hidden for pro */}
        {plan !== 'pro' && (
          <div className="bg-white dark:bg-transparent border border-border rounded-xl p-4 w-full text-center">
            <p className="text-xs text-muted mb-3">
              {t('profile.onPlan', { plan: badge.label })}
            </p>
            <Button className="w-full" onClick={() => setShowPlans(true)}>
              {t('profile.plansButton')}
            </Button>
          </div>
        )}

        {plan !== 'pro' && showPlans && (
          <PlansModal
            open={showPlans}
            onClose={() => setShowPlans(false)}
            currentPlan={plan}
          />
        )}

        {/* Dark mode row */}
        <div className="bg-white dark:bg-transparent border border-border rounded-xl px-4 py-3 w-full flex justify-between items-center">
          <span className="text-sm font-semibold text-foreground">{t('profile.darkMode')}</span>
          <DarkModeToggle />
        </div>

        {/* Language */}
        <div className="bg-white dark:bg-transparent border border-border rounded-xl px-4 py-3 w-full flex justify-between items-center">
          <span className="text-sm font-semibold text-foreground">{t('lang.label')}</span>
          <LanguageSwitcher />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full border border-red-400 text-red-500 rounded-xl py-3 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
        >
          {t('profile.logOut')}
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
