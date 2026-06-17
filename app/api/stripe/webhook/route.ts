import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getUserById, getUserByStripeCustomerId, updateUserBilling } from "@/lib/db/users";
import { getStripe, subscriptionPeriodEndMs } from "@/lib/stripe";

const periodEndForSubscription = subscriptionPeriodEndMs;

// Resolve the local user for a Stripe customer id, falling back to the
// customer's metadata.userId (set at customer creation) when the
// stripeCustomerId link has not yet been written to the user row.
async function resolveUserIdForCustomer(stripe: Stripe, customerId: string): Promise<number | null> {
  const linked = await getUserByStripeCustomerId(customerId);
  if (linked) return linked.id;

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    const metadataUserId = Number.parseInt(customer.metadata?.userId ?? "", 10);
    if (!metadataUserId) return null;
    const user = await getUserById(metadataUserId);
    return user ? user.id : null;
  } catch {
    return null;
  }
}

async function syncSubscription(stripe: Stripe, subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  const userId = await resolveUserIdForCustomer(stripe, customerId);
  if (!userId) return;

  await updateUserBilling({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionCurrentPeriodEnd: periodEndForSubscription(subscription),
  });
}

async function syncCheckoutSession(stripe: Stripe, session: Stripe.Checkout.Session) {
  const userId = Number.parseInt(session.metadata?.userId ?? "", 10);
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  if (!userId || !customerId) return;

  const user = await getUserById(userId);
  if (!user) return;

  // Resolve the subscription actually created by this checkout so we mark the
  // user as paid here, instead of re-writing the user's pre-existing state.
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null;

  await updateUserBilling({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription?.id ?? user.stripeSubscriptionId,
    subscriptionStatus: subscription?.status ?? user.subscriptionStatus,
    subscriptionCurrentPeriodEnd: subscription
      ? periodEndForSubscription(subscription)
      : user.subscriptionCurrentPeriodEnd,
  });
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await syncCheckoutSession(stripe, event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(stripe, event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
