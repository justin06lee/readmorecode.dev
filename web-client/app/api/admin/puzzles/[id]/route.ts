import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { db, puzzlesTable, reportsTable } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const puzzleId = decodeURIComponent(id);

  await db.delete(reportsTable).where(eq(reportsTable.puzzleId, puzzleId));
  await db.delete(puzzlesTable).where(eq(puzzlesTable.puzzleId, puzzleId));

  return NextResponse.json({ ok: true });
}
