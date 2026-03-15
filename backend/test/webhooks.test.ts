import { describe, it, expect, vi, beforeEach } from 'vitest'
import app from '../src/index.ts'

vi.mock('../src/lib/supabase.ts', () => ({
  default: {
    from: vi.fn(),
  },
}))

vi.mock('../src/lib/stripe.ts', () => ({
  default: {
    webhooks: { constructEvent: vi.fn() },
  },
}))

vi.mock('../src/lib/plans.ts', () => ({
  PRICE_TO_PLAN: {
    'price_premium': 'premium',
    'price_pro': 'pro',
  },
}))

import supabase from '../src/lib/supabase.ts'
import stripe from '../src/lib/stripe.ts'

const mockSupabase = supabase as unknown as { from: ReturnType<typeof vi.fn> }
const mockStripe = stripe as unknown as {
  webhooks: { constructEvent: ReturnType<typeof vi.fn> }
}

function makeUpdateChain() {
  const eqMock = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
  mockSupabase.from.mockReturnValue({ update: updateMock })
  return { updateMock, eqMock }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
})

describe('POST /webhooks/stripe', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      body: 'payload',
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when signature verification fails', async () => {
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('invalid signature')
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'bad-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(400)
  })

  it('handles checkout.session.completed — sets plan and subscription_id', async () => {
    const { updateMock, eqMock } = makeUpdateChain()

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { plan: 'premium' },
          customer: 'cus_123',
          subscription: 'sub_abc',
        },
      },
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({
      plan: 'premium',
      stripe_subscription_id: 'sub_abc',
      subscription_status: 'active',
    })
    expect(eqMock).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
  })

  it('handles customer.subscription.updated — active status updates plan', async () => {
    const { updateMock } = makeUpdateChain()

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          status: 'active',
          customer: 'cus_123',
          items: { data: [{ price: { id: 'price_pro' } }] },
        },
      },
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ plan: 'pro', subscription_status: 'active' })
  })

  it('handles customer.subscription.updated — past_due keeps plan, updates status only', async () => {
    const { updateMock } = makeUpdateChain()

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          status: 'past_due',
          customer: 'cus_123',
          items: { data: [{ price: { id: 'price_premium' } }] },
        },
      },
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ subscription_status: 'past_due' })
  })

  it('handles customer.subscription.updated — trialing status updates plan', async () => {
    const { updateMock } = makeUpdateChain()

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          status: 'trialing',
          customer: 'cus_123',
          items: { data: [{ price: { id: 'price_premium' } }] },
        },
      },
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ plan: 'premium', subscription_status: 'trialing' })
  })

  it('handles customer.subscription.updated — unpaid keeps plan, updates status only', async () => {
    const { updateMock } = makeUpdateChain()

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          status: 'unpaid',
          customer: 'cus_123',
          items: { data: [{ price: { id: 'price_pro' } }] },
        },
      },
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({ subscription_status: 'unpaid' })
  })

  it('handles customer.subscription.deleted — resets to free', async () => {
    const { updateMock } = makeUpdateChain()

    mockStripe.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          customer: 'cus_123',
        },
      },
    })

    const res = await app.request('/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'valid-sig' },
      body: 'payload',
    })
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith({
      plan: 'free',
      stripe_subscription_id: null,
      subscription_status: 'canceled',
    })
  })
})
