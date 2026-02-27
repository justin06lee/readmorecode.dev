import { NextResponse } from "next/server";
import { db, reportsTable } from "@/lib/db";

const MAX_DETAIL_LENGTH = 1000;

function validateBody(body: unknown): { ok: true; data: { puzzleId: string; reason: string; optionalDetail?: string; clientReportedAt?: string } } | { ok: false; status: number; error: string } {
  if (body == null || typeof body !== "object") {
    return { ok: false, status: 400, error: "Invalid body" };
  }
  const b = body as Record<string, unknown>;
  const puzzleId = b.puzzleId;
  if (typeof puzzleId !== "string" || puzzleId.length === 0 || puzzleId.length > 500) {
    return { ok: false, status: 400, error: "Invalid puzzleId" };
  }
  const reason = b.reason;
  if (typeof reason !== "string" || reason.length === 0 || reason.length > 200) {
    return { ok: false, status: 400, error: "Invalid reason" };
  }
  let optionalDetail: string | undefined;
  if (b.optionalDetail != null) {
    if (typeof b.optionalDetail !== "string") {
      return { ok: false, status: 400, error: "Invalid optionalDetail" };
    }
    if (b.optionalDetail.length > MAX_DETAIL_LENGTH) {
      return { ok: false, status: 400, error: "optionalDetail too long" };
    }
    optionalDetail = b.optionalDetail;
  }
  let clientReportedAt: string | undefined;
  if (b.clientReportedAt != null && typeof b.clientReportedAt === "string") {
    clientReportedAt = b.clientReportedAt.slice(0, 50);
  }
  return {
    ok: true,
    data: { puzzleId, reason, optionalDetail, clientReportedAt },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = validateBody(body);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: validated.status });
    }
    const { puzzleId, reason, optionalDetail, clientReportedAt } = validated.data;
    await db.insert(reportsTable).values({
      puzzleId,
      reason,
      optionalDetail: optionalDetail ?? null,
      clientReportedAt: clientReportedAt ?? null,
      reportedAt: Date.now(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
