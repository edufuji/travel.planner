import BottomNav from '@/components/BottomNav'
import DarkModeToggle from '@/components/DarkModeToggle'
import { Button } from '@/components/ui/button'

const USER = { name: 'John Doe', plan: 'free' as 'free' | 'premium' | 'pro' }

const PLAN_BADGE: Record<typeof USER.plan, { label: string; className: string }> = {
  free: { label: 'Free', className: 'bg-stone-500' },
  premium: { label: 'Premium', className: 'bg-blue-500' },
  pro: { label: 'Pro ✦', className: 'bg-gradient-to-r from-amber-400 to-amber-600' },
}

export default function ProfilePage() {
  const { name, plan } = USER
  const badge = PLAN_BADGE[plan]

  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-4">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-input-bg border-2 border-border flex items-center justify-center">
          <span className="text-3xl">👤</span>
        </div>

        {/* Name */}
        <h1 className="text-xl font-extrabold text-foreground">{name}</h1>

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
              You're on the <span className="font-semibold">{badge.label}</span> plan
            </p>
            <Button className="w-full">
              ⬆ {plan === 'free' ? 'Upgrade to Premium' : 'Upgrade to Pro'}
            </Button>
          </div>
        )}

        {/* Dark mode row */}
        <div className="bg-white dark:bg-transparent border border-border rounded-xl px-4 py-3 w-full flex justify-between items-center">
          <span className="text-sm font-semibold text-foreground">Dark mode</span>
          <DarkModeToggle />
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
