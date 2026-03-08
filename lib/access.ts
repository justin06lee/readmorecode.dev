import "server-only";
import { createHash } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { getGuestDailyUsageCount, getUserAttemptCountForToday } from "@/lib/db/users";
import type { AccessState, AuthUser } from "@/lib/types";

export const GUEST_DAILY_LIMIT = 3;
export const FREE_DAILY_LIMIT = 5;

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getGuestFingerprint(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  const userAgent = request.headers.get("user-agent")?.trim() ?? "";
  const acceptLanguage = request.headers.get("accept-language")?.trim() ?? "";
  const raw = `${forwardedFor}|${realIp}|${userAgent}|${acceptLanguage}`;
  return createHash("sha256").update(raw || "guest").digest("hex");
}

function buildAccessState(input: {
  user: AuthUser | null;
  usedToday: number;
}): AccessState {
  if (input.user?.isPaid) {
    return {
      tier: "paid",
      dailyLimit: null,
      usedToday: input.usedToday,
      remainingToday: null,
      blocked: false,
      reason: null,
    };
  }

  const dailyLimit = input.user ? FREE_DAILY_LIMIT : GUEST_DAILY_LIMIT;
  const remainingToday = Math.max(0, dailyLimit - input.usedToday);

  return {
    tier: input.user ? "free" : "guest",
    dailyLimit,
    usedToday: input.usedToday,
    remainingToday,
    blocked: remainingToday <= 0,
    reason: input.user ? "subscription" : "signup",
  };
}

export async function getAccessContext(request: Request): Promise<{
  user: AuthUser | null;
  guestKey: string | null;
  access: AccessState;
}> {
  const user = await getCurrentUser();
  if (user) {
    const usedToday = await getUserAttemptCountForToday(user.id);
    return {
      user,
      guestKey: null,
      access: buildAccessState({ user, usedToday }),
    };
  }

  const guestKey = getGuestFingerprint(request);
  const usedToday = await getGuestDailyUsageCount(guestKey, getTodayKey());
  return {
    user: null,
    guestKey,
    access: buildAccessState({ user: null, usedToday }),
  };
}
