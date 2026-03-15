import { Hono } from 'hono'
import stripe from '../lib/stripe.ts'
import supabase from '../lib/supabase.ts'

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

  const { plan, successUrl, cancelUrl } = await c.req.json<{
    plan: string
    successUrl: string
    cancelUrl: string
  }>()

  if (!plan || !['premium', 'pro'].includes(plan)) {
    return c.json({ error: 'plan must be "premium" or "pro"' }, 400)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId: string = profile?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
  }

  const priceId = plan === 'premium'
    ? process.env.STRIPE_PRICE_ID_PREMIUM!
    : process.env.STRIPE_PRICE_ID_PRO!

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { plan },
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  return c.json({ url: session.url })
})

export default checkout
