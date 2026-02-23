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
