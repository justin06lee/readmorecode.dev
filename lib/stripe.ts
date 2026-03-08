import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Set STRIPE_SECRET_KEY in .env.local");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export function getStripePriceLookupKey(): string {
  return process.env.STRIPE_PRICE_LOOKUP_KEY || "readwaymorecode.dev-49a3376";
}

export function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}
