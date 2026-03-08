import { NextResponse } from "next/server";
import { setCachedPuzzle } from "@/lib/puzzle-generator";
import { getPuzzleCount, getRandomPuzzle, getReportCount } from "@/lib/db/puzzles";
import { stripComments } from "@/lib/strip-comments";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
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

      return NextResponse.json(
        {
          error:
            language || category
              ? "No stored puzzles matched the selected filters."
              : "No stored puzzles are available yet.",
        },
        { status: 404 }
      );
    } catch (dbErr) {
      if (process.env.NODE_ENV === "development") {
        console.error("[puzzle] DB fallback:", dbErr);
      }
      return NextResponse.json(
        { error: "Stored puzzles are unavailable right now." },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
