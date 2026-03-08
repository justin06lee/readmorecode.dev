import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const puzzlesTable = sqliteTable("puzzles", {
  id: int().primaryKey({ autoIncrement: true }),
  puzzleId: text("puzzle_id").notNull().unique(),
  repo: text("repo").notNull(), // JSON: Repo
  file: text("file").notNull(), // JSON: FileInfo
  commit: text("commit").notNull(), // JSON: Commit
  question: text("question").notNull(),
  answerKey: text("answer_key").notNull(), // JSON: AnswerKey
  explanation: text("explanation").notNull(),
  gradingRubric: text("grading_rubric").notNull(),
  category: text("category"), // web | systems | mobile | config | etc.
  language: text("language"), // TypeScript, Rust, etc.
  createdAt: int("created_at"), // epoch ms
});

export const reportsTable = sqliteTable("reports", {
  id: int().primaryKey({ autoIncrement: true }),
  puzzleId: text("puzzle_id").notNull(),
  reason: text("reason").notNull(),
  optionalDetail: text("optional_detail"),
  clientReportedAt: text("client_reported_at"), // ISO string from client
  reportedAt: int("reported_at"), // epoch ms
});

export const usersTable = sqliteTable("users", {
  id: int().primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: int("created_at").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  subscriptionCurrentPeriodEnd: int("subscription_current_period_end"),
});

export const userSessionsTable = sqliteTable("user_sessions", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: int("expires_at").notNull(),
  createdAt: int("created_at").notNull(),
});

export const adminSessionsTable = sqliteTable("admin_sessions", {
  id: int().primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: int("expires_at").notNull(),
  createdAt: int("created_at").notNull(),
});

export const requestRateLimitsTable = sqliteTable("request_rate_limits", {
  id: int().primaryKey({ autoIncrement: true }),
  bucketKey: text("bucket_key").notNull().unique(),
  scope: text("scope").notNull(),
  identifierHash: text("identifier_hash").notNull(),
  count: int("count").notNull(),
  resetAt: int("reset_at").notNull(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});

export const puzzleAttemptsTable = sqliteTable("puzzle_attempts", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int("user_id").notNull(),
  puzzleId: text("puzzle_id").notNull(),
  question: text("question").notNull(),
  language: text("language"),
  category: text("category"),
  correct: int("correct").notNull(),
  attemptedAt: int("attempted_at").notNull(),
});

export const guestDailyUsageTable = sqliteTable("guest_daily_usage", {
  id: int().primaryKey({ autoIncrement: true }),
  guestDayKey: text("guest_day_key").notNull().unique(),
  guestKey: text("guest_key").notNull(),
  dayKey: text("day_key").notNull(),
  count: int("count").notNull(),
  createdAt: int("created_at").notNull(),
  updatedAt: int("updated_at").notNull(),
});
