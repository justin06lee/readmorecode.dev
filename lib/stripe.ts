import "server-only";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;
let cachedPriceId: string | null = null;

export function subscriptionPeriodEndMs(subscription: Stripe.Subscription): number | null {
  return subscription.items.data[0]?.current_period_end
    ? subscription.items.data[0].current_period_end * 1000
    : null;
}

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

export async function getStripePriceId(): Promise<string> {
  if (process.env.STRIPE_PRICE_ID) {
    return process.env.STRIPE_PRICE_ID;
  }
  if (cachedPriceId) {
    return cachedPriceId;
  }
  const stripe = getStripe();
  const prices = await stripe.prices.list({
    lookup_keys: [getStripePriceLookupKey()],
    expand: ["data.product"],
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    throw new Error("Stripe price not found for the configured lookup key.");
  }
  cachedPriceId = price.id;
  return price.id;
}

export function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}
