if (!process.env.STRIPE_PRICE_ID_PREMIUM || !process.env.STRIPE_PRICE_ID_PRO) {
  throw new Error('Missing STRIPE_PRICE_ID_PREMIUM or STRIPE_PRICE_ID_PRO env vars')
}

export const PRICE_TO_PLAN: Record<string, 'premium' | 'pro'> = {
  [process.env.STRIPE_PRICE_ID_PREMIUM]: 'premium',
  [process.env.STRIPE_PRICE_ID_PRO]: 'pro',
}
