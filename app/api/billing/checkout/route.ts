import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/csrf";
import { updateUserBilling } from "@/lib/db/users";
import { getAppUrl, getStripe, getStripePriceLookupKey } from "@/lib/stripe";

export async function POST(request: Request) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${getAppUrl()}/profile`, 303);
  }

  const stripe = getStripe();
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.username,
      metadata: {
        userId: String(user.id),
      },
    });
    customerId = customer.id;
    await updateUserBilling({
      userId: user.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
    });
  }

  const prices = await stripe.prices.list({
    lookup_keys: [getStripePriceLookupKey()],
    expand: ["data.product"],
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    throw new Error("Stripe price not found for the configured lookup key.");
  }

  const session = await stripe.checkout.sessions.create({
    billing_address_collection: "auto",
    customer: customerId,
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    mode: "subscription",
    metadata: {
      userId: String(user.id),
    },
    success_url: `${getAppUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getAppUrl()}/profile?canceled=true`,
  });

  return NextResponse.redirect(session.url!, 303);
}
