/**
 * CLI-only seed script. Run with: bun run db:seed
 *
 * Flow per language:
 *  1. Fetch up to 1000 repos via GitHub Search API (pages 1–10, 100 per page). Store in memory.
 *  2. Generate puzzles by round-robin through repos — each puzzle slot uses a different repo.
 *  3. For each puzzle: pick next repo → fetch tree → pick file → fetch content → call Groq → insert into DB.
 *
 * Uses 7 Groq API keys and 4 models. On Groq 429, cycles model/key and retries the same repo.
 * On success or generation failure, advances to the next repo for maximum diversity.
 * When all keys cycled, sleeps 1 day. On GitHub rate limit, sleeps 1 min then retries.
 * Files must have 20–200 lines. Category/language set from file.
 *
 * Env vars:
 *   START_FROM_REPO=owner/repo — use only repos starting from that one (inclusive) in the persisted list.
 *   SEED_REPO_START=N          — 0-based start index into the repo list (inclusive).
 *   SEED_REPO_END=N            — 0-based end index into the repo list (exclusive).
 *   SEED_REVERSE=false         — set to "false" to iterate repos from start→end. Default is true (end→start).
 */
import { config } from "dotenv";
import { join } from "path";

config({ path: join(process.cwd(), ".env.local") });

const TARGET_PER_LANGUAGE = 1000;
const THROTTLE_MS = 3000;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CONSECUTIVE_ERRORS = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const key = process.env[i === 1 ? "GROQ_API_KEY" : `GROQ_API_KEY${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

/** Build language track: ✓ done, ◐ current, ○ pending. Use currentIndex -1 for "none current yet". */
function languageTrack(languages: string[], currentIndex: number, currentSkipped: boolean): string {
  return languages
    .map((lang, i) => {
      if (i < currentIndex) return `${lang} ✓`;
      if (i === currentIndex) return currentSkipped ? `${lang} ✓` : `${lang} ◐`;
      return `${lang} ○`;
    })
    .join("  |  ");
}

async function main() {
  const { getAllLanguages } = await import("../lib/categories");
  const { SEED_MODELS } = await import("./groq-client");
  const { fetchReposWithPersistence } = await import("./github-search-client");
  const { generatePuzzle } = await import("./seed-puzzle-generator");
  const { getPuzzleCountByLanguage, insertPuzzle } = await import("./db-client");

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    console.error("Set at least GROQ_API_KEY in .env.local");
    process.exit(1);
  }
  const models = [...SEED_MODELS];
  const languages = getAllLanguages();

  console.log("=== Seed config ===");
  console.log(`Languages: ${languages.length}`);
  console.log(`API keys: ${apiKeys.length} (GROQ_API_KEY through GROQ_API_KEY7)`);
  console.log(`Models: ${models.join(", ")}`);
  console.log(`Target puzzles per language: ${TARGET_PER_LANGUAGE}`);
  console.log(`Repo direction: ${process.env.SEED_REVERSE === "false" ? "start → end" : "end → start (default)"}`);
  if (process.env.SEED_REPO_START || process.env.SEED_REPO_END) {
    console.log(`Repo slice: [${process.env.SEED_REPO_START ?? "0"}, ${process.env.SEED_REPO_END ?? "end"})`);
  }
  console.log("");
  console.log("Language track:  ✓ done  |  ◐ current  |  ○ pending");
  console.log(languageTrack(languages, -1, false));
  console.log("");

  let keyIndex = 0;
  let modelIndex = 0;

  for (let langIndex = 0; langIndex < languages.length; langIndex++) {
    const language = languages[langIndex]!;
    const countFromDb = await getPuzzleCountByLanguage(language);
    let count = countFromDb;
    const skip = count >= TARGET_PER_LANGUAGE;

    console.log("\n" + languageTrack(languages, langIndex, skip) + "\n");

    if (skip) {
      console.log(`[${language}] Already at target (${count}/${TARGET_PER_LANGUAGE}) from DB. Skipping.`);
      continue;
    }

    const toGenerate = TARGET_PER_LANGUAGE - count;
    console.log(`========== ${language} (current) ==========`);
    console.log(`[${language}] Puzzles in DB: ${count}. Will generate up to ${toGenerate} more (target ${TARGET_PER_LANGUAGE}).`);

    // --- Phase 1: Fetch up to 1000 repos (GitHub Search). Progress persisted in scripts/seed-data/repos-{lang}.json ---
    console.log(`[${language}] Phase 1: Fetching repos (progress saved to scripts/seed-data/; resumes on rate limit or restart)...`);
    let repos: Awaited<ReturnType<typeof fetchReposWithPersistence>>;
    for (;;) {
      try {
        repos = await fetchReposWithPersistence(language, (msg) => console.log(msg));
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("GITHUB_RATE_LIMIT")) {
          console.warn(`[${language}] GitHub rate limit. Sleeping 1 minute, then resuming from last saved page (no progress lost)...`);
          await sleep(ONE_MINUTE_MS);
          continue;
        }
        console.error(`[${language}] Failed to fetch repos:`, msg);
        repos = [];
        break;
      }
    }

    if (repos.length === 0) {
      console.warn(`[${language}] No repos available. Skipping language.`);
      continue;
    }

    const startFromRepo = process.env.START_FROM_REPO?.trim();
    if (startFromRepo) {
      const idx = repos.findIndex((r) => r.full_name === startFromRepo);
      if (idx >= 0) {
        repos = repos.slice(idx);
        console.log(`[${language}] START_FROM_REPO: using ${repos.length} repos starting from ${startFromRepo}`);
      } else {
        console.warn(`[${language}] START_FROM_REPO=${startFromRepo} not found in list; using all ${repos.length} repos.`);
      }
    }

    const seedStart = process.env.SEED_REPO_START ? parseInt(process.env.SEED_REPO_START, 10) : undefined;
    const seedEnd = process.env.SEED_REPO_END ? parseInt(process.env.SEED_REPO_END, 10) : undefined;

    if (seedStart !== undefined || seedEnd !== undefined) {
      const from = seedStart ?? 0;
      const to = seedEnd ?? repos.length;
      repos = repos.slice(from, to);
      console.log(`[${language}] SEED_REPO_START=${from}, SEED_REPO_END=${to}: sliced to ${repos.length} repos.`);
    }

    console.log(`[${language}] Using ${repos.length} repos (from file + any new pages). No further search API calls for ${language}.`);
    console.log(`[${language}] Phase 2: Generating puzzles from these repos (tree + contents + Groq only)...`);

    let consecutiveErrors = 0;
    let keysExhausted = 0;

    const seedReverse = process.env.SEED_REVERSE !== "false";
    let repoIndex = seedReverse ? repos.length - 1 : 0;

    while (count < TARGET_PER_LANGUAGE) {
      const apiKey = apiKeys[keyIndex];
      const model = models[modelIndex];
      const keyLabel = keyIndex + 1;
      const wrappedIndex = ((repoIndex % repos.length) + repos.length) % repos.length;
      const currentRepo = repos[wrappedIndex]!;

      console.log(`\n[${language}] --- Puzzle ${count + 1}/${TARGET_PER_LANGUAGE} (key #${keyLabel}, model: ${model}, repo: ${currentRepo.full_name}) ---`);

      try {
        const puzzle = await generatePuzzle(undefined, {
          language,
          apiKey,
          model,
          repos: [currentRepo],
          onLog: (msg) => console.log(msg),
        });

        if (puzzle) {
          console.log(`[${language}] Inserting into DB: ${puzzle.puzzleId}`);
          await insertPuzzle(puzzle);
          count++;
          consecutiveErrors = 0;
          console.log(`[${language}] Inserted. Count: ${count}/${TARGET_PER_LANGUAGE}`);
          if (count % 50 === 0 || count >= TARGET_PER_LANGUAGE) {
            console.log(`[${language}] Progress: ${count}/${TARGET_PER_LANGUAGE}`);
          }
        } else {
          console.log(`[${language}] No puzzle produced from ${currentRepo.full_name}, moving to next repo.`);
        }
        repoIndex += seedReverse ? -1 : 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("GITHUB_RATE_LIMIT")) {
          console.warn(`[${language}] GitHub rate limit. Sleeping 1 minute... (will retry same repo)`);
          await sleep(ONE_MINUTE_MS);
          continue;
        }
        if (/429|rate limit/i.test(msg)) {
          const oldModel = model;
          modelIndex = (modelIndex + 1) % models.length;
          const newModel = models[modelIndex];
          if (modelIndex === 0) {
            keyIndex = (keyIndex + 1) % apiKeys.length;
            console.warn(
              `[${language}] Groq rate limit (429). All models tried for this key. Switching to key #${keyIndex + 1}, model ${newModel}. Will retry same repo.`
            );
            if (keyIndex === 0) {
              keysExhausted++;
              console.warn(`[${language}] All ${apiKeys.length} keys cycled. Sleeping 1 day...`);
              await sleep(ONE_DAY_MS);
            }
          } else {
            console.warn(
              `[${language}] Groq rate limit (429). Trying next model for same key: ${oldModel} → ${newModel}. Will retry same repo.`
            );
          }
          continue;
        }
        consecutiveErrors++;
        console.warn(`[${language}] Error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, msg);
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.warn(`[${language}] Too many consecutive errors. Moving to next language.`);
          break;
        }
        repoIndex += seedReverse ? -1 : 1;
      }

      await sleep(THROTTLE_MS);
    }

    console.log(`[${language}] Done. Final count: ${count}/${TARGET_PER_LANGUAGE}.`);
  }

  console.log("\n=== Seed run complete ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
