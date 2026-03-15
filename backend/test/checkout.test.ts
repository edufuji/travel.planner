import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import app from '../src/index.ts'

// Mock lib singletons before importing routes
vi.mock('../src/lib/supabase.ts', () => ({
  default: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}))

vi.mock('../src/lib/stripe.ts', () => ({
  default: {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
  },
}))

vi.mock('../src/lib/plans.ts', () => ({
  PRICE_TO_PLAN: {
    'price_test_premium': 'premium',
    'price_test_pro': 'pro',
  },
}))

import supabase from '../src/lib/supabase.ts'
import stripe from '../src/lib/stripe.ts'
import { resetRateLimitForTesting } from '../src/routes/checkout.ts'

const mockSupabase = supabase as unknown as {
  auth: { getUser: ReturnType<typeof vi.fn> }
  from: ReturnType<typeof vi.fn>
}
const mockStripe = stripe as unknown as {
  customers: { create: ReturnType<typeof vi.fn> }
  checkout: { sessions: { create: ReturnType<typeof vi.fn> } }
}

function authHeader(token = 'valid-token') {
  return { Authorization: `Bearer ${token}` }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  // Reset the in-memory rate limit map between tests
  resetRateLimitForTesting()
})

describe('POST /checkout', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.request('/checkout', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT is invalid', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') })

    const res = await app.request('/checkout', {
      method: 'POST',
      headers: { ...authHeader('bad-token'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'premium', successUrl: 'http://x/success', cancelUrl: 'http://x/cancel' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when plan is invalid', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com' } }, error: null })

    const selectMock = { data: { stripe_customer_id: 'cus_existing' }, error: null }
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(selectMock) }) }),
    })

    const res = await app.request('/checkout', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'business', successUrl: 'http://x/success', cancelUrl: 'http://x/cancel' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 200 with url when user already has a stripe_customer_id', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com' } }, error: null })

    const selectMock = { data: { stripe_customer_id: 'cus_existing' }, error: null }
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(selectMock) }) }),
    })

    mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session' })

    const res = await app.request('/checkout', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'premium', successUrl: 'http://x/success', cancelUrl: 'http://x/cancel' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { url: string }
    expect(body.url).toBe('https://checkout.stripe.com/session')
    expect(mockStripe.customers.create).not.toHaveBeenCalled()
  })

  it('returns 429 after 10 requests from the same user within one minute', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-rl', email: 'rl@b.com' } }, error: null })

    const selectMock = { data: { stripe_customer_id: 'cus_rl' }, error: null }
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(selectMock) }) }),
    })
    mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/x' })

    const body = JSON.stringify({ plan: 'premium', successUrl: 'http://x/success', cancelUrl: 'http://x/cancel' })
    const headers = { ...authHeader(), 'Content-Type': 'application/json' }

    // First 10 requests succeed
    for (let i = 0; i < 10; i++) {
      const res = await app.request('/checkout', { method: 'POST', headers, body })
      expect(res.status).toBe(200)
    }

    // 11th request is rate-limited
    const res = await app.request('/checkout', { method: 'POST', headers, body })
    expect(res.status).toBe(429)
  })

  it('creates a new Stripe customer when stripe_customer_id is null', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com' } }, error: null })

    const selectMock = { data: { stripe_customer_id: null }, error: null }
    const updateMock = { eq: vi.fn().mockResolvedValue({ error: null }) }
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(selectMock) }) }),
      update: vi.fn().mockReturnValue(updateMock),
    })

    mockStripe.customers.create.mockResolvedValue({ id: 'cus_new' })
    mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.stripe.com/session2' })

    const res = await app.request('/checkout', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro', successUrl: 'http://x/success', cancelUrl: 'http://x/cancel' }),
    })
    expect(res.status).toBe(200)
    expect(mockStripe.customers.create).toHaveBeenCalledWith({
      email: 'a@b.com',
      metadata: { supabase_user_id: 'user-1' },
    })
  })
})
