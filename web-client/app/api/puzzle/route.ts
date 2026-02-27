import { NextResponse } from "next/server";
import { generatePuzzle, setCachedPuzzle } from "@/lib/puzzle-generator";
import { getPuzzleCount, getRandomPuzzle, getReportCount, insertPuzzle } from "@/lib/db/puzzles";
import { stripComments } from "@/lib/strip-comments";
import type { Puzzle } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seed = searchParams.get("seed") ?? undefined;
    const language = searchParams.get("language") ?? undefined;
    const category = searchParams.get("category") ?? undefined;

    try {
      const count = await getPuzzleCount();
      if (count > 0) {
        const fromDb = await getRandomPuzzle({ language, category });
        if (fromDb) {
          setCachedPuzzle(fromDb);
          const reportCount = await getReportCount(fromDb.puzzleId);
          const forClient = {
            ...fromDb,
            file: {
              ...fromDb.file,
              content: stripComments(fromDb.file.content, fromDb.file.language),
            },
            reportCount,
          };
          return NextResponse.json(forClient);
        }
      }
    } catch (dbErr) {
      if (process.env.NODE_ENV === "development") {
        console.error("[puzzle] DB fallback:", dbErr);
      }
    }

    const puzzle = await generatePuzzle(seed);
    if (!puzzle) {
      const msg =
        process.env.NODE_ENV === "development" && (globalThis as unknown as { __lastPuzzleError?: string }).__lastPuzzleError
          ? (globalThis as unknown as { __lastPuzzleError: string }).__lastPuzzleError
          : "Could not generate a puzzle. Try again.";
      return NextResponse.json(
        { error: msg },
        { status: 503 }
      );
    }

    try {
      await insertPuzzle(puzzle);
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[puzzle] insert failed:", err);
      }
      // ignore insert errors (e.g. duplicate or missing tables)
    }

    const forClient: Puzzle = {
      ...puzzle,
      file: {
        ...puzzle.file,
        content: stripComments(puzzle.file.content, puzzle.file.language),
      },
    };
    return NextResponse.json(forClient);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
