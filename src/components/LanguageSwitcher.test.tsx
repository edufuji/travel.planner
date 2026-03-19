import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LanguageSwitcher from './LanguageSwitcher'

// The global mock in test-setup.ts stubs useTranslation.
// We need to control i18n.language per test, so we override here.
const mockChangeLanguage = vi.fn()
let currentLanguage = 'en'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: mockChangeLanguage,
      get language() { return currentLanguage },
    },
  }),
}))

beforeEach(() => {
  mockChangeLanguage.mockClear()
  currentLanguage = 'en'
})

describe('LanguageSwitcher', () => {
  it('renders PT, EN, ES buttons', () => {
    render(<LanguageSwitcher />)
    expect(screen.getByText('PT')).toBeInTheDocument()
    expect(screen.getByText('EN')).toBeInTheDocument()
    expect(screen.getByText('ES')).toBeInTheDocument()
  })

  it('clicking EN calls i18n.changeLanguage with "en"', () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByText('EN'))
    expect(mockChangeLanguage).toHaveBeenCalledWith('en')
  })

  it('clicking PT calls i18n.changeLanguage with "pt-BR"', () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByText('PT'))
    expect(mockChangeLanguage).toHaveBeenCalledWith('pt-BR')
  })

  it('clicking ES calls i18n.changeLanguage with "es"', () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByText('ES'))
    expect(mockChangeLanguage).toHaveBeenCalledWith('es')
  })

  it('active language button has aria-pressed="true"', () => {
    currentLanguage = 'en'
    render(<LanguageSwitcher />)
    expect(screen.getByText('EN').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('PT').closest('button')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('ES').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })
})
