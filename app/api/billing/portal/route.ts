import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/csrf";
import { getAppUrl, getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const user = await getCurrentUser();
  if (!user?.stripeCustomerId) {
    return NextResponse.redirect(`${getAppUrl()}/profile`, 303);
  }

  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getAppUrl()}/profile`,
  });

  return NextResponse.redirect(portalSession.url, 303);
}
