import Stripe from "stripe"

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    })
  : null

// Stripe webhook secret for verifying webhook events
export const getStripeWebhookSecret = () => {
  return process.env.STRIPE_WEBHOOK_SECRET || ""
}

// Plan configurations
export const PLAN_CONFIG = {
  BASIC: {
    name: "Basic",
    priceId: process.env.STRIPE_BASIC_PRICE_ID || "",
    includedMinutes: 1000,
    pricePerMinute: 0.10,
  },
  PRO: {
    name: "Pro",
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    includedMinutes: 5000,
    pricePerMinute: 0.08,
  },
  ENTERPRISE: {
    name: "Enterprise",
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    includedMinutes: 10000,
    pricePerMinute: 0.05,
  },
}

