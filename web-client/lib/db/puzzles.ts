import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { puzzlesTable } from "./schema";
import type { Puzzle } from "@/lib/types";

export async function insertPuzzle(puzzle: Puzzle): Promise<void> {
  await db.insert(puzzlesTable).values({
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
  }).onConflictDoNothing({ target: puzzlesTable.puzzleId });
}

export async function getPuzzleCount(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(puzzlesTable);
  return Number(result[0]?.count ?? 0);
}

export async function getPuzzleCountByLanguage(language: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(puzzlesTable)
    .where(eq(puzzlesTable.language, language));
  return Number(result[0]?.count ?? 0);
}

function rowToPuzzle(row: {
  puzzleId: string;
  repo: string;
  file: string;
  commit: string;
  question: string;
  answerKey: string;
  explanation: string;
  gradingRubric: string;
  category?: string | null;
  language?: string | null;
}): Puzzle {
  return {
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

export async function getRandomPuzzle(_filter?: { category?: string; language?: string }): Promise<Puzzle | null> {
  const rows = await db.select().from(puzzlesTable).orderBy(sql`random()`).limit(1);
  const row = rows[0];
  if (!row) return null;
  return rowToPuzzle(row);
}

/** For filter script: get all puzzle ids and raw file JSON to check path. */
export async function getAllPuzzleIdsAndFiles(): Promise<{ id: number; puzzleId: string; file: string }[]> {
  const rows = await db.select({ id: puzzlesTable.id, puzzleId: puzzlesTable.puzzleId, file: puzzlesTable.file }).from(puzzlesTable);
  return rows.map((r) => ({ id: r.id, puzzleId: r.puzzleId, file: r.file }));
}

/** Permanently delete a puzzle by id. Used by filter script. */
export async function deletePuzzleById(id: number): Promise<void> {
  await db.delete(puzzlesTable).where(eq(puzzlesTable.id, id));
}
