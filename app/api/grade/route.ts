import { NextResponse } from "next/server";
import { getAccessContext } from "@/lib/access";
import { requireSameOrigin } from "@/lib/csrf";
import { getPuzzleByPuzzleId } from "@/lib/db/puzzles";
import { incrementGuestDailyUsage, recordPuzzleAttempt } from "@/lib/db/users";
import { gradeSubmission } from "@/lib/grading";
import { getCachedPuzzle } from "@/lib/puzzle-generator";
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
    const csrfError = requireSameOrigin(request);
    if (csrfError) {
      return csrfError;
    }

    const body = await request.json();
    const validated = validateSubmission(body);
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error },
        { status: validated.status }
      );
    }

    const accessContext = await getAccessContext(request);
    if (accessContext.access.blocked) {
      return NextResponse.json(
        {
          error:
            accessContext.access.reason === "signup"
              ? "Guest limit reached for today. Sign up to keep solving."
              : "Daily free limit reached. Subscribe to keep solving today.",
          access: accessContext.access,
        },
        { status: 403 }
      );
    }

    const result = await gradeSubmission(validated.data);
    if (!result) {
      return NextResponse.json(
        { error: "Puzzle not found or grading failed." },
        { status: 404 }
      );
    }

    const puzzle =
      getCachedPuzzle(validated.data.puzzleId) ??
      (await getPuzzleByPuzzleId(validated.data.puzzleId));

    if (accessContext.user && puzzle) {
      await recordPuzzleAttempt({
        userId: accessContext.user.id,
        puzzleId: puzzle.puzzleId,
        question: puzzle.question,
        language: puzzle.language ?? null,
        category: puzzle.category ?? null,
        correct: result.correct,
      });
    } else if (accessContext.guestKey) {
      await incrementGuestDailyUsage(accessContext.guestKey, new Date().toISOString().slice(0, 10));
    }

    const nextAccess = accessContext.access.dailyLimit == null
      ? {
          ...accessContext.access,
          usedToday: accessContext.access.usedToday + 1,
        }
      : (() => {
          const usedToday = accessContext.access.usedToday + 1;
          const remainingToday = Math.max(0, accessContext.access.dailyLimit - usedToday);
          return {
            ...accessContext.access,
            usedToday,
            remainingToday,
            blocked: remainingToday <= 0,
          };
        })();

    return NextResponse.json({
      ...result,
      access: nextAccess,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
