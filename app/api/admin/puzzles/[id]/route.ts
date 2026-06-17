import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { requireSameOrigin } from "@/lib/csrf";
import { db, puzzleAttemptsTable, puzzlesTable, reportsTable } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = requireSameOrigin(request);
  if (csrfError) {
    return csrfError;
  }

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const puzzleId = decodeURIComponent(id);

  await db.transaction(async (tx) => {
    await tx.delete(reportsTable).where(eq(reportsTable.puzzleId, puzzleId));
    await tx
      .delete(puzzleAttemptsTable)
      .where(eq(puzzleAttemptsTable.puzzleId, puzzleId));
    await tx.delete(puzzlesTable).where(eq(puzzlesTable.puzzleId, puzzleId));
  });

  return NextResponse.json({ ok: true });
}
