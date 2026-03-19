import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import GlassCard from '@/components/GlassCard'
import { supabase } from '@/lib/supabase'

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirm?: string
}

export default function SignupPage() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [authError, setAuthError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!name.trim()) {
      errs.name = t('auth.fullNameRequired')
    }
    if (!email) {
      errs.email = t('auth.emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = t('auth.emailInvalid')
    }
    if (!password) {
      errs.password = t('auth.passwordRequired')
    } else if (password.length < 6) {
      errs.password = t('auth.passwordTooShort')
    }
    if (password && confirm !== password) {
      errs.confirm = t('auth.passwordMismatch')
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    setLoading(false)
    if (error) {
      setAuthError(error.message)
      return
    }
    setSuccess(true)
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

      {/* Glass Card */}
      <GlassCard className="w-full max-w-[400px] p-9 sm:rounded-[20px] rounded-none sm:min-h-0 min-h-screen sm:pt-9 pt-20 px-6 sm:px-9 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-extrabold text-foreground">
            {t('auth.createAccount')}
          </h1>
          <p className="text-sm text-muted mt-1">
            {t('auth.createAccountSubtitle')}
          </p>
        </div>

        {success ? (
          <div className="text-center py-6">
            <p className="text-sm text-foreground font-medium">
              {t('auth.checkEmailConfirm')}
            </p>
            <p className="text-sm text-muted mt-2">
              {t('auth.onceConfirmedSignIn')}{' '}
              <Link to="/login" className="text-primary font-semibold">
                {t('auth.signInLink')}
              </Link>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
            <div className="mb-3">
              <label htmlFor="name" className="block text-xs font-semibold text-foreground mb-1.5">
                {t('auth.fullName')}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.fullNamePlaceholder')}
                className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                  errors.name ? 'border-red-500' : 'border-border'
                }`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

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
            <div className="mb-3">
              <label htmlFor="password" className="block text-xs font-semibold text-foreground mb-1.5">
                {t('auth.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.passwordMinPlaceholder')}
                className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                  errors.password ? 'border-red-500' : 'border-border'
                }`}
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="mb-5">
              <label htmlFor="confirm" className="block text-xs font-semibold text-foreground mb-1.5">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                className={`w-full bg-input-bg border rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                  errors.confirm ? 'border-red-500' : 'border-border'
                }`}
              />
              {errors.confirm && (
                <p className="text-red-500 text-xs mt-1">{errors.confirm}</p>
              )}
            </div>

            {/* Auth error */}
            {authError && (
              <p className="text-red-500 text-sm text-center mb-3">{authError}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              aria-label={t('auth.createAccountButton')}
              className="w-full bg-primary text-white rounded-xl py-3 text-[15px] font-bold shadow-[0_4px_14px_rgba(255,107,53,0.4)] hover:bg-primary-dark transition-colors disabled:opacity-70 flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t('auth.createAccountButton')
              )}
            </button>
          </form>
        )}

        {/* Sign in link */}
        <p className="text-center text-sm text-muted mt-5">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link to="/login" className="text-primary font-semibold">
            {t('auth.signInLink')}
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}
