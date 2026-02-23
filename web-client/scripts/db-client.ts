/**
 * DB access for CLI scripts only. No "server-only" so it can run under Bun.
 * Load dotenv before importing this (e.g. in the script that uses it).
 */
import { join } from "path";
import { pathToFileURL } from "url";
import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql/node";
import { eq, sql } from "drizzle-orm";
import { puzzlesTable } from "../lib/db/schema";
import type { Puzzle } from "../lib/types";

const tursoUrl = process.env.TURSO_DB_URL;
const tursoToken = process.env.TURSO_DB_AUTH_TOKEN;
const dbFileName = process.env.DB_FILE_NAME;

if (!tursoUrl && !dbFileName) {
  throw new Error("Set either TURSO_DB_URL or DB_FILE_NAME in .env.local");
}

const client = tursoUrl
  ? createClient({ url: tursoUrl, authToken: tursoToken })
  : createClient({
      url: dbFileName!.startsWith("file:")
        ? dbFileName!
        : pathToFileURL(join(process.cwd(), dbFileName!)).href,
    });

const db = drizzle({ client });

export async function getAllPuzzleIdsAndFiles(): Promise<{ id: number; puzzleId: string; file: string }[]> {
  const rows = await db.select({ id: puzzlesTable.id, puzzleId: puzzlesTable.puzzleId, file: puzzlesTable.file }).from(puzzlesTable);
  return rows.map((r) => ({ id: r.id, puzzleId: r.puzzleId, file: r.file }));
}

export async function deletePuzzleById(id: number): Promise<void> {
  await db.delete(puzzlesTable).where(eq(puzzlesTable.id, id));
}

export async function updatePuzzleCategoryAndLanguage(
  id: number,
  category: string,
  language: string
): Promise<void> {
  await db
    .update(puzzlesTable)
    .set({ category, language })
    .where(eq(puzzlesTable.id, id));
}

export async function getPuzzleCountByLanguage(language: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(puzzlesTable)
    .where(eq(puzzlesTable.language, language));
  return Number(result[0]?.count ?? 0);
}

export async function insertPuzzle(puzzle: Puzzle): Promise<void> {
  await db
    .insert(puzzlesTable)
    .values({
      puzzleId: puzzle.puzzleId,
      repo: JSON.stringify(puzzle.repo),
      file: JSON.stringify(puzzle.file),
      commit: JSON.stringify(puzzle.commit),
      question: puzzle.question,
      answerKey: JSON.stringify(puzzle.answerKey),
      explanation: puzzle.explanation,
      gradingRubric: puzzle.gradingRubric,
      category: puzzle.category ?? null,
      language: puzzle.language ?? null,
      createdAt: Date.now(),
    })
    .onConflictDoNothing({ target: puzzlesTable.puzzleId });
}

function rowToPuzzle(row: {
  id: number;
  puzzleId: string;
  repo: string;
  file: string;
  commit: string;
  question: string;
  answerKey: string;
  explanation: string;
  gradingRubric: string;
  category: string | null;
  language: string | null;
}): Puzzle & { id: number } {
  return {
    id: row.id,
    puzzleId: row.puzzleId,
    repo: JSON.parse(row.repo) as Puzzle["repo"],
    file: JSON.parse(row.file) as Puzzle["file"],
    commit: JSON.parse(row.commit) as Puzzle["commit"],
    question: row.question,
    answerKey: JSON.parse(row.answerKey) as Puzzle["answerKey"],
    explanation: row.explanation,
    gradingRubric: row.gradingRubric,
    category: (row.category as Puzzle["category"]) ?? undefined,
    language: row.language ?? undefined,
  };
}

export async function getAllPuzzles(): Promise<(Puzzle & { id: number })[]> {
  const rows = await db.select().from(puzzlesTable);
  return rows.map((r) =>
    rowToPuzzle({
      id: r.id,
      puzzleId: r.puzzleId,
      repo: r.repo,
      file: r.file,
      commit: r.commit,
      question: r.question,
      answerKey: r.answerKey,
      explanation: r.explanation,
      gradingRubric: r.gradingRubric,
      category: r.category,
      language: r.language,
    })
  );
}

export async function updatePuzzleContent(
  id: number,
  update: {
    question: string;
    answerKey: Puzzle["answerKey"];
    explanation: string;
    gradingRubric: string;
  }
): Promise<void> {
  await db
    .update(puzzlesTable)
    .set({
      question: update.question,
      answerKey: JSON.stringify(update.answerKey),
      explanation: update.explanation,
      gradingRubric: update.gradingRubric,
    })
    .where(eq(puzzlesTable.id, id));
}
