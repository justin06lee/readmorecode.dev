import { NextResponse } from "next/server";
import { gradeSubmission } from "@/lib/grading";
import type { Submission, SelectedRange } from "@/lib/types";

const MAX_EXPLANATION_LENGTH = 2000;

function validateSubmission(body: unknown): { ok: true; data: Submission } | { ok: false; status: number; error: string } {
  if (body == null || typeof body !== "object") {
    return { ok: false, status: 400, error: "Invalid body" };
  }
  const b = body as Record<string, unknown>;
  const puzzleId = b.puzzleId;
  if (typeof puzzleId !== "string" || puzzleId.length === 0 || puzzleId.length > 500) {
    return { ok: false, status: 400, error: "Invalid puzzleId" };
  }
  const insufficientContext = b.insufficientContext;
  if (typeof insufficientContext !== "boolean") {
    return { ok: false, status: 400, error: "Invalid insufficientContext" };
  }
  const selectedRanges: SelectedRange[] = [];
  if (b.selectedRanges != null && Array.isArray(b.selectedRanges)) {
    for (let i = 0; i < b.selectedRanges.length; i++) {
      const r = b.selectedRanges[i] as Record<string, unknown> | undefined;
      if (r == null || typeof r !== "object") {
        return { ok: false, status: 400, error: "Invalid selectedRanges item" };
      }
      const startLine = r.startLine;
      const endLine = r.endLine;
      if (typeof startLine !== "number" || typeof endLine !== "number" || startLine < 1 || endLine < 1 || startLine > 100_000 || endLine > 100_000) {
        return { ok: false, status: 400, error: "Invalid selectedRanges line numbers" };
      }
      selectedRanges.push({ startLine, endLine });
    }
  }
  if (selectedRanges.length === 0 && b.selectedRange != null) {
    if (typeof b.selectedRange !== "object") {
      return { ok: false, status: 400, error: "Invalid selectedRange" };
    }
    const r = b.selectedRange as Record<string, unknown>;
    const startLine = r.startLine;
    const endLine = r.endLine;
    if (typeof startLine !== "number" || typeof endLine !== "number" || startLine < 1 || endLine < 1 || startLine > 100_000 || endLine > 100_000) {
      return { ok: false, status: 400, error: "Invalid selectedRange line numbers" };
    }
    selectedRanges.push({ startLine, endLine });
  }
  let optionalExplanation: string | null = null;
  if (b.optionalExplanation != null) {
    if (typeof b.optionalExplanation !== "string") {
      return { ok: false, status: 400, error: "Invalid optionalExplanation" };
    }
    if (b.optionalExplanation.length > MAX_EXPLANATION_LENGTH) {
      return { ok: false, status: 400, error: "optionalExplanation too long" };
    }
    optionalExplanation = b.optionalExplanation;
  }
  if (!insufficientContext && selectedRanges.length === 0) {
    return { ok: false, status: 400, error: "Select at least one line range or choose Insufficient context" };
  }
  return {
    ok: true,
    data: {
      puzzleId,
      selectedRange: selectedRanges[0] ?? null,
      selectedRanges,
      optionalExplanation,
      insufficientContext,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = validateSubmission(body);
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error },
        { status: validated.status }
      );
    }
    const result = await gradeSubmission(validated.data);
    if (!result) {
      return NextResponse.json(
        { error: "Puzzle not found or grading failed." },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
