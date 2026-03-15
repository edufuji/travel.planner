import { Hono } from 'hono'
import type Stripe from 'stripe'
import stripeClient from '../lib/stripe.ts'
import supabase from '../lib/supabase.ts'
import { PRICE_TO_PLAN } from '../lib/plans.ts'

const webhooks = new Hono()

webhooks.post('/stripe', async (c) => {
  const sig = c.req.header('stripe-signature')
  if (!sig) {
    return c.json({ error: 'Missing stripe-signature' }, 400)
  }

  const body = await c.req.text()
  let event: Stripe.Event

  try {
    event = stripeClient.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    return c.json({ error: 'Invalid signature' }, 400)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const plan = session.metadata?.plan
      const customerId = session.customer as string | null
      const subscriptionId = session.subscription as string | null

      if (!plan || !customerId || !subscriptionId) {
        console.error('checkout.session.completed missing required fields', { plan, customerId, subscriptionId })
        return c.json({ received: true })
      }

      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          plan,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
        })
        .eq('stripe_customer_id', customerId)
      if (dbError) return c.json({ error: 'Database error' }, 500)
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const priceId = sub.items.data[0].price.id

      if (sub.status === 'active' || sub.status === 'trialing') {
        const plan = PRICE_TO_PLAN[priceId]
        if (!plan) {
          console.error('Unknown price ID in subscription.updated:', priceId)
          break
        }
        const { error: dbError } = await supabase
          .from('profiles')
          .update({ plan, subscription_status: sub.status })
          .eq('stripe_customer_id', customerId)
        if (dbError) return c.json({ error: 'Database error' }, 500)
      } else if (sub.status === 'past_due' || sub.status === 'unpaid') {
        const { error: dbError } = await supabase
          .from('profiles')
          .update({ subscription_status: sub.status })
          .eq('stripe_customer_id', customerId)
        if (dbError) return c.json({ error: 'Database error' }, 500)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ plan: 'free', stripe_subscription_id: null, subscription_status: 'canceled' })
        .eq('stripe_customer_id', customerId)
      if (dbError) return c.json({ error: 'Database error' }, 500)
      break
    }
  }

  return c.json({ received: true })
})

export default webhooks
