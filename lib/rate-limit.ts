import "server-only";
import { createHash } from "crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { requestRateLimitsTable } from "@/lib/db/schema";

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

function getClientFingerprint(request: Request, scope: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  const userAgent = request.headers.get("user-agent")?.trim() ?? "";
  const raw = `${scope}:${forwardedFor}|${realIp}|${userAgent}`;
  const identifierHash = createHash("sha256").update(raw || `${scope}:anonymous`).digest("hex");
  return {
    identifierHash,
    bucketKey: `${scope}:${identifierHash}`,
  };
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const { identifierHash, bucketKey } = getClientFingerprint(request, scope);

  await db
    .delete(requestRateLimitsTable)
    .where(and(eq(requestRateLimitsTable.scope, scope), lt(requestRateLimitsTable.resetAt, now)));

  const rows = await db
    .select()
    .from(requestRateLimitsTable)
    .where(eq(requestRateLimitsTable.bucketKey, bucketKey))
    .limit(1);

  const existing = rows[0];
  if (!existing) {
    const resetAt = now + config.windowMs;
    await db.insert(requestRateLimitsTable).values({
      bucketKey,
      scope,
      identifierHash,
      count: 1,
      resetAt,
      createdAt: now,
      updatedAt: now,
    });
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - 1),
      resetAt,
      retryAfterSeconds: Math.ceil(config.windowMs / 1000),
    };
  }

  if (existing.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  const nextCount = existing.count + 1;
  await db
    .update(requestRateLimitsTable)
    .set({
      count: nextCount,
      updatedAt: now,
    })
    .where(eq(requestRateLimitsTable.id, existing.id));

  return {
    allowed: true,
    remaining: Math.max(0, config.maxRequests - nextCount),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}
