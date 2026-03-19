import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FcGoogle } from 'react-icons/fc'
import { FaApple } from 'react-icons/fa'
import { Loader2 } from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import { supabase } from '@/lib/supabase'

interface FormErrors {
  email?: string
  password?: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [authError, setAuthError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!email) {
      errs.email = t('auth.emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = t('auth.emailInvalid')
    }
    if (!password) {
      errs.password = t('auth.passwordRequired')
    }
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setAuthError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setAuthError(t('auth.invalidCredentials'))
      setLoading(false)
      return
    }
    setLoading(false)
    navigate('/trips')
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + '/trips' },
    })
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{
        background:
          'linear-gradient(rgba(26,10,0,0.45), rgba(26,10,0,0.55)), linear-gradient(135deg, #C75B2A, #FF8C42, #F7C59F, #EFEFD0)',
      }}
    >
      {/* Logo */}
      <div className="absolute top-5 left-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-base">
          ✈
        </div>
        <span className="text-white font-bold text-lg">TripMate</span>
      </div>

      {/* Tagline */}
      <div className="absolute bottom-6 left-6 hidden sm:block">
        <p className="text-white font-extrabold" style={{ fontSize: '28px' }}>
          {t('auth.tagline')}
        </p>
        <p className="text-white/55 text-sm">
          {t('auth.subtitle')}
        </p>
      </div>

      {/* Glass Card */}
      <GlassCard className="w-full max-w-[400px] p-9 sm:rounded-[20px] rounded-none sm:min-h-0 min-h-screen sm:pt-9 pt-20 px-6 sm:px-9 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-extrabold text-foreground">
            {t('auth.welcomeBack')}
          </h1>
          <p className="text-sm text-muted mt-1">
            {t('auth.signInSubtitle')}
          </p>
        </div>

        {/* Social buttons */}
        <div className="flex gap-2.5 mb-5">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-transparent border border-border rounded-xl py-2.5 text-sm font-medium text-foreground hover:bg-input-bg transition-colors"
          >
            <FcGoogle size={16} />
            {t('auth.continueWithGoogle')}
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-transparent border border-border rounded-xl py-2.5 text-sm font-medium text-foreground hover:bg-input-bg transition-colors"
          >
            <FaApple size={16} />
            {t('auth.continueWithApple')}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted">{t('auth.orContinueWithEmail')}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="mb-3">
            <label htmlFor="email" className="block text-xs font-semibold text-foreground mb-1.5">
              {t('auth.emailAddress')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                errors.email ? 'border-red-500' : 'border-border'
              }`}
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-2">
            <label htmlFor="password" className="block text-xs font-semibold text-foreground mb-1.5">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                errors.password ? 'border-red-500' : 'border-border'
              }`}
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password}</p>
            )}
          </div>

          {/* Forgot password */}
          <div className="text-right mb-5">
            <a href="#" className="text-xs text-primary font-medium">
              {t('auth.forgotPassword')}
            </a>
          </div>

          {/* Auth error */}
          {authError && (
            <p className="text-red-500 text-sm text-center mb-3">{authError}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            aria-label={t('auth.signIn')}
            className="w-full bg-primary text-white rounded-xl py-3 text-[15px] font-bold shadow-[0_4px_14px_rgba(255,107,53,0.4)] hover:bg-primary-dark transition-colors disabled:opacity-70 flex items-center justify-center"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t('auth.signIn')
            )}
          </button>
        </form>

        {/* Sign up link */}
        <p className="text-center text-sm text-muted mt-5">
          {t('auth.noAccount')}{' '}
          <Link to="/signup" className="text-primary font-semibold">
            {t('auth.createOne')}
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}
