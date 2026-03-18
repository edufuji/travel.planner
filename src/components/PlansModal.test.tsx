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
    expect(document.activeElement).toBe(screen.getByLabelText('Close'))
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

  it('shows annual prices by default', () => {
    renderModal()
    expect(screen.getByText('R$159')).toBeInTheDocument()
    expect(screen.getByText('R$329')).toBeInTheDocument()
  })

  it('switches to monthly prices when Monthly toggle is clicked', () => {
    renderModal()
    fireEvent.click(screen.getByText('Monthly'))
    expect(screen.getByText('R$19')).toBeInTheDocument()
    expect(screen.getByText('R$39')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    fireEvent.click(screen.getByLabelText('Close'))
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
    const btn = screen.getByRole('button', { name: /current plan/i })
    expect(btn).toBeDisabled()
  })

  it('shows disabled "Current plan" on Premium card when currentPlan is premium', () => {
    renderModal({ currentPlan: 'premium' })
    // Premium card has "Current plan", Free card has no CTA
    const currentPlanBtns = screen.getAllByRole('button', { name: /current plan/i })
    expect(currentPlanBtns).toHaveLength(1)
    // Free card CTA is absent
    expect(screen.queryByRole('button', { name: /get premium/i })).not.toBeInTheDocument()
  })

  it('shows "Get Pro" button for both currentPlan values', () => {
    const { rerender } = renderModal({ currentPlan: 'free' })
    expect(screen.getByRole('button', { name: /get pro/i })).toBeInTheDocument()

    rerender(<PlansModal open={true} onClose={vi.fn()} currentPlan="premium" />)
    expect(screen.getByRole('button', { name: /get pro/i })).toBeInTheDocument()
  })
})
