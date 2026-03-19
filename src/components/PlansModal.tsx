import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PlansModalProps {
  open: boolean
  onClose: () => void
  currentPlan: 'free' | 'premium'
}

const PRICES = {
  monthly: { premium: 'R$19', pro: 'R$39' },
  annual:  { premium: 'R$159', pro: 'R$329' },
}

export default function PlansModal({ open, onClose, currentPlan }: PlansModalProps) {
  const { t } = useTranslation()
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<Element | null>(null)

  // Save the element that had focus before the modal opened
  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement
      // Focus the close button on open
      closeRef.current?.focus()
    } else {
      // Return focus on close, then clear the ref so the keyboard-listener
      // cleanup does not fire a redundant second .focus() call.
      ;(returnFocusRef.current as HTMLElement | null)?.focus()
      returnFocusRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      // Return focus when unmounted while open. On a normal close the first
      // useEffect already called .focus() and nulled the ref, so this is a
      // no-op in that case.
      ;(returnFocusRef.current as HTMLElement | null)?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      data-testid="modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      {/* Modal panel — stop click propagation so backdrop click doesn't trigger from panel */}
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-[#1a1a2e] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          ref={closeRef}
          aria-label={t('plans.close')}
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-300 text-lg leading-none"
        >
          ✕
        </button>

        {/* Header */}
        <h2 className="text-white text-lg font-bold mb-1">{t('plans.heading')}</h2>
        <p className="text-gray-400 text-xs mb-5">{t('plans.subtitle')}</p>

        {/* Billing toggle */}
        <div className="flex bg-black/40 rounded-full p-1 w-fit mb-6">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              billing === 'monthly' ? 'bg-[#4f8ef7] text-white' : 'text-gray-400'
            }`}
          >
            {t('plans.monthly')}
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              billing === 'annual' ? 'bg-[#4f8ef7] text-white' : 'text-gray-400'
            }`}
          >
            {t('plans.annual')}{' '}
            <span className={`text-[10px] ${billing === 'annual' ? 'bg-white/20' : 'bg-gray-700'} rounded-full px-1.5 py-0.5`}>
              {t('plans.savingsBadge')}
            </span>
          </button>
        </div>

        {/* Plan cards — desktop: 3 columns; mobile: stacked */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch sm:pt-4 overflow-visible">

          {/* Free card */}
          <div className="sm:flex-1 bg-[#222236] rounded-xl p-4 flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-gray-400 bg-gray-700 rounded-full px-2 py-0.5">
              FREE
            </span>
            <div className="text-white text-2xl font-extrabold mt-3 mb-0.5">R$0</div>
            <div className="text-gray-500 text-xs mb-4">{t('plans.alwaysFree')}</div>
            <ul className="text-xs text-gray-400 space-y-1.5 mb-4 flex-1">
              <li>{t('plans.free1trip')}</li>
              <li>{t('plans.free10events')}</li>
            </ul>
            {currentPlan === 'free' ? (
              <button disabled className="w-full bg-gray-600 text-gray-400 rounded-lg py-2 text-xs font-semibold cursor-not-allowed mt-auto">
                {t('plans.currentPlan')}
              </button>
            ) : null}
          </div>

          {/* Premium card — featured center */}
          <div className="sm:flex-1 relative bg-[#0d1f3f] border-2 border-[#4f8ef7] rounded-xl p-4 flex flex-col">
            {/* Most popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#4f8ef7] text-white text-[9px] font-extrabold tracking-widest rounded-full px-3 py-1 whitespace-nowrap">
              {t('plans.mostPopular')}
            </div>
            <span className="text-[10px] font-bold tracking-wider text-[#4f8ef7] bg-[#1a3a6e] rounded-full px-2 py-0.5">
              PREMIUM
            </span>
            <div className="text-white text-2xl font-extrabold mt-3 mb-0.5">
              {PRICES[billing].premium}
              {billing === 'annual' ? <span className="text-xs text-gray-400 font-normal"> {t('plans.perYear')}</span> : <span className="text-xs text-gray-400 font-normal"> {t('plans.perMonth')}</span>}
            </div>
            {billing === 'annual' && (
              <div className="text-[#4f8ef7] text-[10px] mb-4">{t('plans.annualEquivPremium')}</div>
            )}
            {billing === 'monthly' && <div className="mb-4" />}
            <ul className="text-xs text-gray-300 space-y-1.5 mb-4 flex-1">
              <li>{t('plans.premium10trips')}</li>
              <li>{t('plans.premium30events')}</li>
              <li>{t('plans.shareTrips')}</li>
            </ul>
            {currentPlan === 'premium' ? (
              <button disabled className="w-full bg-[#4f8ef7]/40 text-[#4f8ef7] rounded-lg py-2 text-xs font-semibold cursor-not-allowed mt-auto">
                {t('plans.currentPlan')}
              </button>
            ) : (
              <button
                onClick={() => console.log('checkout: premium')}
                className="w-full bg-[#4f8ef7] text-white rounded-lg py-2 text-xs font-bold hover:bg-[#3a7de0] transition-colors mt-auto"
              >
                {t('plans.getPremium')}
              </button>
            )}
          </div>

          {/* Pro card */}
          <div className="sm:flex-1 bg-[#1e1408] border border-[#92400e] rounded-xl p-4 flex flex-col">
            <span className="text-[10px] font-bold tracking-wider text-[#d97706] bg-[#451a03] rounded-full px-2 py-0.5">
              PRO ✦
            </span>
            <div className="text-white text-2xl font-extrabold mt-3 mb-0.5">
              {PRICES[billing].pro}
              {billing === 'annual' ? <span className="text-xs text-gray-400 font-normal"> {t('plans.perYear')}</span> : <span className="text-xs text-gray-400 font-normal"> {t('plans.perMonth')}</span>}
            </div>
            {billing === 'annual' && (
              <div className="text-[#d97706] text-[10px] mb-4">{t('plans.annualEquivPro')}</div>
            )}
            {billing === 'monthly' && <div className="mb-4" />}
            <ul className="text-xs text-gray-400 space-y-1.5 mb-4 flex-1">
              <li>{t('plans.pro30trips')}</li>
              <li>{t('plans.proUnlimited')}</li>
              <li>{t('plans.shareTrips')}</li>
            </ul>
            <button
              onClick={() => console.log('checkout: pro')}
              className="w-full bg-gradient-to-r from-amber-600 to-amber-400 text-white rounded-lg py-2 text-xs font-bold hover:opacity-90 transition-opacity mt-auto"
            >
              {t('plans.getPro')}
            </button>
          </div>

        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-[10px] mt-5">
          {t('plans.footer')}
        </p>
      </div>
    </div>
  )
}
