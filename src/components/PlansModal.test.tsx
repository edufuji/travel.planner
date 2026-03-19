import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PlansModal from './PlansModal'

function renderModal(props: Partial<React.ComponentProps<typeof PlansModal>> = {}) {
  return render(
    <PlansModal
      open={true}
      onClose={vi.fn()}
      currentPlan="free"
      {...props}
    />
  )
}

describe('PlansModal', () => {
  it('renders all three plan cards', () => {
    renderModal()
    expect(screen.getByText('FREE')).toBeInTheDocument()
    expect(screen.getByText('PREMIUM')).toBeInTheDocument()
    expect(screen.getByText(/PRO/)).toBeInTheDocument()
  })

  it('focuses the close button when opened', () => {
    renderModal()
    expect(document.activeElement).toBe(screen.getByLabelText('plans.close'))
  })

  it('returns focus to previously focused element on unmount', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const { unmount } = renderModal()
    unmount()
    expect(document.activeElement).toBe(trigger)
    document.body.removeChild(trigger)
  })

  it('returns focus to previously focused element when open changes to false', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = renderModal({ open: true })
    // Modal is open — trigger focus was saved, close button now has focus
    expect(document.activeElement).toBe(screen.getByLabelText('plans.close'))

    rerender(<PlansModal open={false} onClose={vi.fn()} currentPlan="free" />)
    // Modal closed — focus should return to trigger
    expect(document.activeElement).toBe(trigger)

    document.body.removeChild(trigger)
  })

  it('shows annual prices by default', () => {
    renderModal()
    expect(screen.getByText('R$159')).toBeInTheDocument()
    expect(screen.getByText('R$329')).toBeInTheDocument()
  })

  it('switches to monthly prices when Monthly toggle is clicked', () => {
    renderModal()
    fireEvent.click(screen.getByText('plans.monthly'))
    expect(screen.getByText('R$19')).toBeInTheDocument()
    expect(screen.getByText('R$39')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByLabelText('plans.close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows disabled "Current plan" on Free card when currentPlan is free', () => {
    renderModal({ currentPlan: 'free' })
    const btn = screen.getByRole('button', { name: /plans.currentPlan/i })
    expect(btn).toBeDisabled()
  })

  it('shows disabled "Current plan" on Premium card when currentPlan is premium', () => {
    renderModal({ currentPlan: 'premium' })
    // Premium card has "Current plan", Free card has no CTA
    const currentPlanBtns = screen.getAllByRole('button', { name: /plans.currentPlan/i })
    expect(currentPlanBtns).toHaveLength(1)
    // Free card CTA is absent
    expect(screen.queryByRole('button', { name: /plans.getPremium/i })).not.toBeInTheDocument()
  })

  it('shows "Get Pro" button for both currentPlan values', () => {
    const { rerender } = renderModal({ currentPlan: 'free' })
    expect(screen.getByRole('button', { name: /plans.getPro/i })).toBeInTheDocument()

    rerender(<PlansModal open={true} onClose={vi.fn()} currentPlan="premium" />)
    expect(screen.getByRole('button', { name: /plans.getPro/i })).toBeInTheDocument()
  })

  it('renders nothing when open is false', () => {
    render(<PlansModal open={false} onClose={vi.fn()} currentPlan="free" />)
    expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument()
  })

  it('shows the MOST POPULAR badge', () => {
    renderModal()
    expect(screen.getByText('plans.mostPopular')).toBeInTheDocument()
  })

  it('shows the footer text', () => {
    renderModal()
    expect(screen.getByText(/plans.footer/i)).toBeInTheDocument()
  })
})
