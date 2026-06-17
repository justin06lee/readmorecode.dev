import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getCurrentUser } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/csrf";
import { updateUserBilling } from "@/lib/db/users";
import { getStripe, subscriptionPeriodEndMs } from "@/lib/stripe";

export async function POST(request: Request) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  if (session.metadata?.userId !== String(user.id)) {
    return NextResponse.json({ error: "Session does not belong to the current user." }, { status: 403 });
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  // Only elevate subscription state for a genuinely completed/paid checkout.
  // Otherwise persist just the customer link without granting entitlement.
  const isPaidSession = session.status === "complete" || session.payment_status === "paid";
  const subscription = isPaidSession ? (session.subscription as Stripe.Subscription | null) : null;

  const updated = await updateUserBilling({
    userId: user.id,
    stripeCustomerId: customerId ?? user.stripeCustomerId,
    stripeSubscriptionId: subscription?.id ?? user.stripeSubscriptionId,
    subscriptionStatus: subscription?.status ?? user.subscriptionStatus,
    subscriptionCurrentPeriodEnd: subscription ? subscriptionPeriodEndMs(subscription) : user.subscriptionCurrentPeriodEnd,
  });

  return NextResponse.json({ user: updated });
}
