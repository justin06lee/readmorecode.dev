import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { db, puzzlesTable, reportsTable } from "@/lib/db";
import { sql, eq, desc } from "drizzle-orm";

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

  const result = [];
  for (const row of rows) {
    const puzzle = await db
      .select({
        id: puzzlesTable.id,
        puzzleId: puzzlesTable.puzzleId,
        question: puzzlesTable.question,
        language: puzzlesTable.language,
        category: puzzlesTable.category,
      })
      .from(puzzlesTable)
      .where(eq(puzzlesTable.puzzleId, row.puzzleId))
      .limit(1);

    result.push({
      puzzleId: row.puzzleId,
      reportCount: row.reportCount,
      reasons: row.reasons,
      latestReport: row.latestReport,
      puzzle: puzzle[0] ?? null,
    });
  }

  return NextResponse.json(result);
}
