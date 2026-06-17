import "server-only";
import { createHash } from "crypto";
import { and, eq, lt, sql } from "drizzle-orm";
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
  // Derive the bucket from the client IP only. user-agent is fully
  // attacker-controlled and would let a caller mint a fresh bucket per request,
  // so it is intentionally excluded. This assumes the app sits behind a proxy
  // (e.g. the hosting platform) that sets x-forwarded-for / x-real-ip; the
  // leftmost x-forwarded-for entry is the originating client.
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  const clientIp = forwardedFor || realIp;
  const raw = clientIp ? `${scope}:${clientIp}` : `${scope}:anonymous`;
  const identifierHash = createHash("sha256").update(raw).digest("hex");
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

  const resetAt = now + config.windowMs;

  // Atomic upsert: insert the bucket on first sight, otherwise increment the
  // count in a single SQL statement. This closes the read-then-write window
  // that let concurrent requests exceed the cap or throw on the UNIQUE
  // constraint for a first-seen bucketKey.
  const upserted = await db
    .insert(requestRateLimitsTable)
    .values({
      bucketKey,
      scope,
      identifierHash,
      count: 1,
      resetAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: requestRateLimitsTable.bucketKey,
      set: {
        count: sql`${requestRateLimitsTable.count} + 1`,
        updatedAt: now,
      },
    })
    .returning();

  const row = upserted[0]!;
  const count = row.count;
  const allowed = count <= config.maxRequests;

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - count),
    resetAt: row.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt - now) / 1000)),
  };
}
