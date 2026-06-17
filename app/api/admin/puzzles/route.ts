import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { db, puzzlesTable, reportsTable } from "@/lib/db";
import { sql, desc, inArray } from "drizzle-orm";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      puzzleId: reportsTable.puzzleId,
      reportCount: sql<number>`count(*)`,
      reasons: sql<string>`group_concat(${reportsTable.reason}, ', ')`,
      latestReport: sql<number>`max(${reportsTable.reportedAt})`,
    })
    .from(reportsTable)
    .groupBy(reportsTable.puzzleId)
    .orderBy(desc(sql`count(*)`));

  const puzzleIds = rows.map((row) => row.puzzleId);
  const puzzles = puzzleIds.length
    ? await db
        .select({
          id: puzzlesTable.id,
          puzzleId: puzzlesTable.puzzleId,
          question: puzzlesTable.question,
          language: puzzlesTable.language,
          category: puzzlesTable.category,
        })
        .from(puzzlesTable)
        .where(inArray(puzzlesTable.puzzleId, puzzleIds))
    : [];

  const puzzleById = new Map(puzzles.map((puzzle) => [puzzle.puzzleId, puzzle]));

  const result = rows.map((row) => ({
    puzzleId: row.puzzleId,
    reportCount: row.reportCount,
    reasons: row.reasons,
    latestReport: row.latestReport,
    puzzle: puzzleById.get(row.puzzleId) ?? null,
  }));

  return NextResponse.json(result);
}
