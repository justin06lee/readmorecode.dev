import { NextResponse } from "next/server";
import { createAdminUserSession, verifyAdminPassword } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = await checkRateLimit(request, "admin-login", {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many admin login attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || !verifyAdminPassword(password, adminPassword)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await createAdminUserSession();

  return NextResponse.json({ ok: true });
}
