import { Hono } from 'hono'
import stripe from '../lib/stripe.ts'
import supabase from '../lib/supabase.ts'
import { PRICE_TO_PLAN } from '../lib/plans.ts'

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// Exported for test cleanup only — not part of the public API
export function resetRateLimitForTesting() {
  rateLimitMap.clear()
}

const checkout = new Hono()

checkout.post('/', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization' }, 401)
  }
  const token = authHeader.slice(7)

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  if (!checkRateLimit(user.id)) {
    return c.json({ error: 'Too many requests' }, 429)
  }

  let body: { plan?: string; successUrl?: string; cancelUrl?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { plan, successUrl, cancelUrl } = body

  // Find the price ID for the plan by reversing the PRICE_TO_PLAN map
  const priceId = Object.entries(PRICE_TO_PLAN).find(([, p]) => p === plan)?.[0]
  if (!plan || !priceId) {
    return c.json({ error: 'plan must be "premium" or "pro"' }, 400)
  }

  if (!successUrl || typeof successUrl !== 'string') {
    return c.json({ error: 'successUrl must be a non-empty string' }, 400)
  }

  if (!cancelUrl || typeof cancelUrl !== 'string') {
    return c.json({ error: 'cancelUrl must be a non-empty string' }, 400)
  }

  if (!successUrl.startsWith('http://') && !successUrl.startsWith('https://')) {
    return c.json({ error: 'Invalid URL' }, 400)
  }

  if (!cancelUrl.startsWith('http://') && !cancelUrl.startsWith('https://')) {
    return c.json({ error: 'Invalid URL' }, 400)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    return c.json({ error: 'Service unavailable' }, 503)
  }

  let customerId: string | null | undefined = profile?.stripe_customer_id

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('id', user.id)
      if (updateError) {
        console.error('Failed to persist stripe_customer_id:', updateError)
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { plan },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return c.json({ url: session.url })
  } catch {
    return c.json({ error: 'Payment service unavailable' }, 503)
  }
})

export default checkout
