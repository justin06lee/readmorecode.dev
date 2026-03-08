import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/csrf";
import { getProfileDataForUser, getUserByUsername, updateUserProfile } from "@/lib/db/users";
import { normalizeUsername, validateUsername } from "@/lib/user-validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getProfileDataForUser(user.id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(request: Request) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : user.username;
  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  const existing = await getUserByUsername(username);
  if (existing && existing.id !== user.id) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  const updated = await updateUserProfile({
    userId: user.id,
    username,
    avatarUrl: user.avatarUrl,
  });

  return NextResponse.json({ user: updated });
}
