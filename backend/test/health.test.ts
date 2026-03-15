import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/lib/stripe.ts', () => ({
  default: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
}))

vi.mock('../src/lib/supabase.ts', () => ({
  default: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

import app from '../src/index.ts'

describe('GET /health', () => {
  it('returns { status: ok }', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })
})
