import { NextResponse } from "next/server";
import { createUserSession, verifyPassword } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/csrf";
import { getUserWithPasswordByEmail } from "@/lib/db/users";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeEmail, validateEmail } from "@/lib/user-validation";

// A well-formed (salt:hash) dummy hash used to perform a constant-time dummy
// verification when no user matches the email, so the not-found path takes the
// same time as the wrong-password path (mitigates email-enumeration timing oracle).
// The plaintext for this hash is unknown/random, so it can never match a real password.
const DUMMY_PASSWORD_HASH =
  "00000000000000000000000000000000:" +
  "0".repeat(128);

export async function POST(request: Request) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = await checkRateLimit(request, "auth-login", {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";

  const emailError = validateEmail(email);
  if (emailError || !password) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const user = await getUserWithPasswordByEmail(email);
  if (!user) {
    // Perform a dummy scrypt verification to equalize timing with the
    // wrong-password path and prevent email-enumeration via response latency.
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createUserSession(user.id);
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
  });
}
