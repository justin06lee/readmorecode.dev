import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, clearAdminUserSession } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/csrf";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value ?? null;
  await clearAdminUserSession(token);

  return NextResponse.json({ ok: true });
}
