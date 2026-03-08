import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, clearUserSession } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/csrf";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
  await clearUserSession(token);
  return NextResponse.json({ ok: true });
}
