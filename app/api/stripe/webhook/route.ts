import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getUserById, getUserByStripeCustomerId, updateUserBilling } from "@/lib/db/users";
import { getStripe } from "@/lib/stripe";

function periodEndForSubscription(subscription: Stripe.Subscription): number | null {
  return subscription.items.data[0]?.current_period_end
    ? subscription.items.data[0].current_period_end * 1000
    : null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  const user = await getUserByStripeCustomerId(customerId);
  if (!user) return;

  await updateUserBilling({
    userId: user.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    subscriptionCurrentPeriodEnd: periodEndForSubscription(subscription),
  });
}

async function syncCheckoutSession(session: Stripe.Checkout.Session) {
  const userId = Number.parseInt(session.metadata?.userId ?? "", 10);
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  if (!userId || !customerId) return;

  const user = await getUserById(userId);
  if (!user) return;

  await updateUserBilling({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
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
      await syncCheckoutSession(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
