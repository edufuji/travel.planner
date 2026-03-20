import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function DarkModeToggle() {
  const { t } = useTranslation()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(localStorage.getItem('theme') === 'dark')
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <button
      role="switch"
      aria-checked={isDark}
      aria-label={t('view.darkModeToggle')}
      onClick={toggle}
      className={`relative w-10 h-[22px] rounded-full transition-colors cursor-pointer ${
        isDark ? 'bg-primary' : 'bg-border'
      }`}
    >
      <span
        className={`absolute left-[2px] top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform ${
          isDark ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
