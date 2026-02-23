const MIN_LINES = 20;

/**
 * CLI-only: (1) Delete puzzles whose file is Markdown or has fewer than MIN_LINES lines.
 *           (2) Backfill category and language for all remaining puzzles from file path.
 * Run with: bun run db:filter
 * Not callable from the app.
 */
import { config } from "dotenv";
import { join } from "path";
import { getCategoryAndLanguageFromPath } from "../lib/categories";

config({ path: join(process.cwd(), ".env.local") });

function lineCount(content: string): number {
  return (content || "").split(/\n/).length;
}

async function main() {
  const {
    getAllPuzzleIdsAndFiles,
    deletePuzzleById,
    updatePuzzleCategoryAndLanguage,
  } = await import("./db-client");

  console.log("=== Filter (db:filter) ===");
  console.log("(1) Delete puzzles: Markdown files or files with < 20 lines.");
  console.log("(2) Backfill category and language from file path for remaining puzzles.\n");

  const rows = await getAllPuzzleIdsAndFiles();
  console.log(`Loaded ${rows.length} puzzle(s). Processing...\n`);
  let deleted = 0;
  let updated = 0;
  for (const row of rows) {
    let path: string;
    let content: string;
    try {
      const file = JSON.parse(row.file) as { path?: string; content?: string };
      path = file.path ?? "";
      content = file.content ?? "";
    } catch {
      continue;
    }
    const lines = lineCount(content);
    const isMarkdown =
      path.toLowerCase().endsWith(".md") || path.toLowerCase().endsWith(".markdown");
    if (isMarkdown || lines < MIN_LINES) {
      await deletePuzzleById(row.id);
      deleted++;
      const reason = isMarkdown ? "markdown" : `< ${MIN_LINES} lines`;
      console.log("Deleted:", row.puzzleId, `(${reason})`);
    } else {
      const { category, language } = getCategoryAndLanguageFromPath(path);
      await updatePuzzleCategoryAndLanguage(row.id, category, language);
      updated++;
    }
  }
  console.log("\n=== Filter complete ===");
  console.log(`Deleted: ${deleted}, Updated category/language: ${updated}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
