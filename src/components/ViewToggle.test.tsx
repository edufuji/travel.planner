import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ViewToggle from './ViewToggle'

describe('ViewToggle', () => {
  it('renders Timeline and Map buttons', () => {
    render(<ViewToggle active="timeline" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Timeline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument()
  })

  it('Timeline button has aria-pressed=true when active="timeline"', () => {
    render(<ViewToggle active="timeline" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Timeline' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Map button has aria-pressed=true when active="map"', () => {
    render(<ViewToggle active="map" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Timeline' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange("map") when Map button is clicked', () => {
    const onChange = vi.fn()
    render(<ViewToggle active="timeline" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(onChange).toHaveBeenCalledWith('map')
  })

  it('calls onChange("timeline") when Timeline button is clicked', () => {
    const onChange = vi.fn()
    render(<ViewToggle active="map" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }))
    expect(onChange).toHaveBeenCalledWith('timeline')
  })
})
