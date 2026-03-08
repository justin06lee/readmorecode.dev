import "server-only";
import { and, desc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { db } from "./index";
import { adminSessionsTable, guestDailyUsageTable, puzzleAttemptsTable, userSessionsTable, usersTable } from "./schema";
import type { AuthUser, HeatmapDay, ProfileData, ProfileStats, PuzzleAttempt, PuzzleCategory } from "@/lib/types";

type UserRow = typeof usersTable.$inferSelect;

export function isPaidSubscriptionStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    avatarUrl: row.avatarUrl ?? null,
    createdAt: row.createdAt,
    stripeCustomerId: row.stripeCustomerId ?? null,
    stripeSubscriptionId: row.stripeSubscriptionId ?? null,
    subscriptionStatus: row.subscriptionStatus ?? null,
    subscriptionCurrentPeriodEnd: row.subscriptionCurrentPeriodEnd ?? null,
    isPaid: isPaidSubscriptionStatus(row.subscriptionStatus),
  };
}

function startOfDayUtc(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function calculateStreaks(attempts: { attemptedAt: number }[]): { currentStreak: number; longestStreak: number } {
  const uniqueDays = Array.from(new Set(attempts.map((attempt) => startOfDayUtc(attempt.attemptedAt)))).sort();
  if (uniqueDays.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let longest = 1;
  let running = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = Date.parse(`${uniqueDays[i - 1]}T00:00:00.000Z`);
    const curr = Date.parse(`${uniqueDays[i]}T00:00:00.000Z`);
    if (curr - prev === 86_400_000) {
      running += 1;
    } else {
      running = 1;
    }
    longest = Math.max(longest, running);
  }

  let current = 0;
  let cursor = Date.parse(`${startOfDayUtc(Date.now())}T00:00:00.000Z`);
  const daySet = new Set(uniqueDays);
  while (daySet.has(new Date(cursor).toISOString().slice(0, 10))) {
    current += 1;
    cursor -= 86_400_000;
  }

  return { currentStreak: current, longestStreak: longest };
}

function buildHeatmap(attempts: { attemptedAt: number }[], days = 182): HeatmapDay[] {
  const counts = new Map<string, number>();
  const today = Date.parse(`${startOfDayUtc(Date.now())}T00:00:00.000Z`);
  const start = today - (days - 1) * 86_400_000;

  for (const attempt of attempts) {
    if (attempt.attemptedAt < start) continue;
    const date = startOfDayUtc(attempt.attemptedAt);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    return { date, count: counts.get(date) ?? 0 };
  });
}

export async function createUser(input: {
  email: string;
  username: string;
  passwordHash: string;
  avatarUrl?: string | null;
}): Promise<AuthUser> {
  const createdAt = Date.now();
  const result = await db
    .insert(usersTable)
    .values({
      email: input.email,
      username: input.username,
      passwordHash: input.passwordHash,
      avatarUrl: input.avatarUrl ?? null,
      createdAt,
    })
    .returning();
  return toAuthUser(result[0]!);
}

export async function getUserWithPasswordByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | null> {
  const rows = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...toAuthUser(row),
    passwordHash: row.passwordHash,
  };
}

export async function getUserByUsername(username: string): Promise<AuthUser | null> {
  const rows = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  const row = rows[0];
  return row ? toAuthUser(row) : null;
}

export async function getUserById(id: number): Promise<AuthUser | null> {
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  const row = rows[0];
  return row ? toAuthUser(row) : null;
}

export async function getUserByStripeCustomerId(customerId: string): Promise<AuthUser | null> {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.stripeCustomerId, customerId))
    .limit(1);
  const row = rows[0];
  return row ? toAuthUser(row) : null;
}

export async function createSession(input: { userId: number; tokenHash: string; expiresAt: number }): Promise<void> {
  await db.insert(userSessionsTable).values({
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    createdAt: Date.now(),
  });
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
  await db.delete(userSessionsTable).where(eq(userSessionsTable.tokenHash, tokenHash));
}

export async function createAdminSession(input: { tokenHash: string; expiresAt: number }): Promise<void> {
  await db.insert(adminSessionsTable).values({
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    createdAt: Date.now(),
  });
}

export async function deleteAdminSessionByTokenHash(tokenHash: string): Promise<void> {
  await db.delete(adminSessionsTable).where(eq(adminSessionsTable.tokenHash, tokenHash));
}

export async function hasValidAdminSession(tokenHash: string): Promise<boolean> {
  const rows = await db
    .select({ id: adminSessionsTable.id })
    .from(adminSessionsTable)
    .where(and(eq(adminSessionsTable.tokenHash, tokenHash), gt(adminSessionsTable.expiresAt, Date.now())))
    .limit(1);
  return rows.length > 0;
}

export async function getUserBySessionTokenHash(tokenHash: string): Promise<AuthUser | null> {
  const rows = await db
    .select({ user: usersTable })
    .from(userSessionsTable)
    .innerJoin(usersTable, eq(userSessionsTable.userId, usersTable.id))
    .where(and(eq(userSessionsTable.tokenHash, tokenHash), gt(userSessionsTable.expiresAt, Date.now())))
    .limit(1);
  const row = rows[0];
  return row ? toAuthUser(row.user) : null;
}

export async function updateUserProfile(input: {
  userId: number;
  username: string;
  avatarUrl?: string | null;
}): Promise<AuthUser> {
  const result = await db
    .update(usersTable)
    .set({
      username: input.username,
      avatarUrl: input.avatarUrl ?? null,
    })
    .where(eq(usersTable.id, input.userId))
    .returning();
  return toAuthUser(result[0]!);
}

export async function updateUserBilling(input: {
  userId: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionCurrentPeriodEnd?: number | null;
}): Promise<AuthUser> {
  const result = await db
    .update(usersTable)
    .set({
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      subscriptionStatus: input.subscriptionStatus,
      subscriptionCurrentPeriodEnd: input.subscriptionCurrentPeriodEnd,
    })
    .where(eq(usersTable.id, input.userId))
    .returning();
  return toAuthUser(result[0]!);
}

export async function recordPuzzleAttempt(input: {
  userId: number;
  puzzleId: string;
  question: string;
  language?: string | null;
  category?: PuzzleCategory | null;
  correct: boolean;
}): Promise<void> {
  await db.insert(puzzleAttemptsTable).values({
    userId: input.userId,
    puzzleId: input.puzzleId,
    question: input.question,
    language: input.language ?? null,
    category: input.category ?? null,
    correct: input.correct ? 1 : 0,
    attemptedAt: Date.now(),
  });
}

export async function getUserAttemptCountForToday(userId: number): Promise<number> {
  const todayKey = startOfDayUtc(Date.now());
  const dayStart = Date.parse(`${todayKey}T00:00:00.000Z`);
  const dayEnd = dayStart + 86_400_000;
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(puzzleAttemptsTable)
    .where(
      and(
        eq(puzzleAttemptsTable.userId, userId),
        gte(puzzleAttemptsTable.attemptedAt, dayStart),
        lt(puzzleAttemptsTable.attemptedAt, dayEnd)
      )
    );
  return Number(rows[0]?.count ?? 0);
}

export async function getGuestDailyUsageCount(guestKey: string, dayKey: string): Promise<number> {
  const guestDayKey = `${dayKey}:${guestKey}`;
  const rows = await db
    .select()
    .from(guestDailyUsageTable)
    .where(eq(guestDailyUsageTable.guestDayKey, guestDayKey))
    .limit(1);
  return rows[0]?.count ?? 0;
}

export async function incrementGuestDailyUsage(guestKey: string, dayKey: string): Promise<number> {
  const guestDayKey = `${dayKey}:${guestKey}`;
  const now = Date.now();
  const rows = await db
    .select()
    .from(guestDailyUsageTable)
    .where(eq(guestDailyUsageTable.guestDayKey, guestDayKey))
    .limit(1);
  const existing = rows[0];
  if (!existing) {
    await db.insert(guestDailyUsageTable).values({
      guestDayKey,
      guestKey,
      dayKey,
      count: 1,
      createdAt: now,
      updatedAt: now,
    });
    return 1;
  }

  const nextCount = existing.count + 1;
  await db
    .update(guestDailyUsageTable)
    .set({
      count: nextCount,
      updatedAt: now,
    })
    .where(eq(guestDailyUsageTable.id, existing.id));
  return nextCount;
}

export async function getProfileDataForUser(userId: number): Promise<ProfileData | null> {
  const user = await getUserById(userId);
  if (!user) return null;

  const attemptRows = await db
    .select()
    .from(puzzleAttemptsTable)
    .where(eq(puzzleAttemptsTable.userId, userId))
    .orderBy(desc(puzzleAttemptsTable.attemptedAt));

  const history: PuzzleAttempt[] = attemptRows.slice(0, 30).map((row) => ({
    id: row.id,
    puzzleId: row.puzzleId,
    question: row.question,
    language: row.language ?? null,
    category: (row.category as PuzzleCategory | null) ?? null,
    correct: row.correct === 1,
    attemptedAt: row.attemptedAt,
  }));

  const correctAttempts = attemptRows.filter((row) => row.correct === 1).length;
  const streaks = calculateStreaks(attemptRows);
  const stats: ProfileStats = {
    totalAttempts: attemptRows.length,
    correctAttempts,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
  };

  return {
    user,
    stats,
    heatmap: buildHeatmap(attemptRows),
    history,
  };
}
