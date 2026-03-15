import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import health from './routes/health.ts'
import checkout from './routes/checkout.ts'
import webhooks from './routes/webhooks.ts'

const app = new Hono()

app.use('*', cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))

app.route('/health', health)
app.route('/checkout', checkout)
app.route('/webhooks', webhooks)

const port = Number(process.env.PORT ?? 3000)

if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on port ${port}`)
  })
}

export default app
