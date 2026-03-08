import { NextResponse } from "next/server";
import { createUserSession, hashPassword } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/csrf";
import { createUser, getUserByUsername, getUserWithPasswordByEmail } from "@/lib/db/users";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  normalizeEmail,
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/user-validation";

export async function POST(request: Request) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = await checkRateLimit(request, "auth-signup", {
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again later." },
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
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  const password = typeof body.password === "string" ? body.password : "";

  const emailError = validateEmail(email);
  if (emailError) return NextResponse.json({ error: emailError }, { status: 400 });

  const usernameError = validateUsername(username);
  if (usernameError) return NextResponse.json({ error: usernameError }, { status: 400 });

  const passwordError = validatePassword(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  if (await getUserWithPasswordByEmail(email)) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  if (await getUserByUsername(username)) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({
    email,
    username,
    passwordHash,
  });
  await createUserSession(user.id);

  return NextResponse.json({ user });
}
