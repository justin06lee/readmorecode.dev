/**
 * CLI: Regenerate every puzzle's question/answer/explanation using the new generation prompt.
 * Run with: bun run db:regenerate
 * Uses same 7 Groq API keys and 5 models; rotates model then key on 429.
 *
 * Optional env:
 * - START_FROM_PUZZLE_INDEX=15  — start at the 15th puzzle (1-based), skip earlier ones
 * - START_FROM_PUZZLE_ID=owner:repo:path:sha — start at the puzzle with this id
 */
import { config } from "dotenv";
import { join } from "path";
import { extractJsonObject, getKey } from "../lib/parse-llm-json";
import { stripThinkTags } from "../lib/sanitize";
import type { AnswerKey } from "../lib/types";

config({ path: join(process.cwd(), ".env.local") });

const THROTTLE_MS = 2000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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

interface GeneratedJson {
  task_type?: string;
  question?: string;
  given?: Record<string, unknown>;
  choices?: string[];
  answer?: string;
  explanation?: string;
  common_mistakes?: string[];
  startLine?: number;
  endLine?: number;
}

function parsedToGenerated(parsed: Record<string, unknown>): GeneratedJson | null {
  const question = parsed.question ?? parsed.Question;
  const startLine = parsed.startLine ?? parsed.start_line;
  const endLine = parsed.endLine ?? parsed.end_line;
  if (typeof question !== "string") return null;
  const sl = Number(startLine);
  const el = Number(endLine);
  if (!Number.isInteger(sl) || !Number.isInteger(el) || sl < 1 || el < 1) return null;
  return {
    task_type: getKey(parsed, "task_type", "taskType") as string | undefined,
    question: String(question),
    given: (getKey(parsed, "given", "given") as Record<string, unknown>) ?? undefined,
    choices: (getKey(parsed, "choices", "choices") as string[] | undefined) ?? undefined,
    answer: (getKey(parsed, "answer", "answer") as string) ?? undefined,
    explanation: (getKey(parsed, "explanation", "explanation") as string) ?? undefined,
    common_mistakes:
      (getKey(parsed, "common_mistakes", "commonMistakes") as string[] | undefined) ?? undefined,
    startLine: sl,
    endLine: el,
  };
}

function toAnswerKey(parsed: GeneratedJson, lineCount: number): AnswerKey {
  let startLine = Math.max(1, Math.min(Number(parsed.startLine) || 1, lineCount));
  let endLine = Math.max(1, Math.min(Number(parsed.endLine) || 1, lineCount));
  if (startLine > endLine) [startLine, endLine] = [endLine, startLine];
  return {
    startLine,
    endLine,
    insufficientContextAllowed: false,
    task_type: parsed.task_type,
    given: parsed.given,
    choices: Array.isArray(parsed.choices) ? parsed.choices : undefined,
    answer: parsed.answer,
    common_mistakes: Array.isArray(parsed.common_mistakes) ? parsed.common_mistakes : undefined,
  };
}

async function main() {
  const { getAllPuzzles, updatePuzzleContent } = await import("./db-client");
  const { getGroqChatCompletion, SEED_MODELS } = await import("./groq-client");
  const { GENERATION_SYSTEM, buildGenerationUserPrompt } = await import("./prompts");

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    console.error("Set at least GROQ_API_KEY in .env.local");
    process.exit(1);
  }
  const models = [...SEED_MODELS];
  const puzzles = await getAllPuzzles();

  let startIndex = 0;
  const fromIndexEnv = process.env.START_FROM_PUZZLE_INDEX?.trim();
  const fromIdEnv = process.env.START_FROM_PUZZLE_ID?.trim();
  if (fromIndexEnv) {
    const n = parseInt(fromIndexEnv, 10);
    if (!Number.isNaN(n) && n >= 1) {
      startIndex = Math.min(n - 1, puzzles.length);
      console.log(`START_FROM_PUZZLE_INDEX: starting at puzzle ${startIndex + 1}/${puzzles.length}`);
    }
  } else if (fromIdEnv) {
    const idx = puzzles.findIndex((p) => p.puzzleId === fromIdEnv);
    if (idx >= 0) {
      startIndex = idx;
      console.log(`START_FROM_PUZZLE_ID: starting at puzzle ${startIndex + 1}/${puzzles.length} (${fromIdEnv})`);
    } else {
      console.warn(`START_FROM_PUZZLE_ID not found in list; starting from puzzle 1.`);
    }
  }

  console.log("=== Regenerate config ===");
  console.log(`Total puzzles: ${puzzles.length}`);
  if (startIndex > 0) console.log(`Will process puzzles ${startIndex + 1}–${puzzles.length} (${puzzles.length - startIndex} puzzles).`);
  console.log(`API keys: ${apiKeys.length} (GROQ_API_KEY, GROQ_API_KEY2, ...)`);
  console.log(`Models: ${models.join(", ")}`);
  console.log("Regenerating each puzzle's question/answer/explanation with new generation prompt.\n");

  let keyIndex = 0;
  let modelIndex = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = startIndex; i < puzzles.length; i++) {
    const puzzle = puzzles[i]!;
    const apiKey = apiKeys[keyIndex];
    const model = models[modelIndex];
    const keyLabel = keyIndex + 1;

    console.log(`\n--- Puzzle ${i + 1}/${puzzles.length} (key #${keyLabel}, model: ${model}) ---`);
    console.log(`  puzzleId: ${puzzle.puzzleId}`);
    console.log(`  Calling Groq (generation prompt)...`);

    const snippet = stripThinkTags(puzzle.file.content).slice(0, 12000);
    const context = `Language: ${puzzle.file.language}. Path: ${puzzle.file.path}. Repo: ${puzzle.repo.owner}/${puzzle.repo.name}.`;
    const userPrompt = buildGenerationUserPrompt(snippet, context);

    try {
      const MAX_LLM_RETRIES = 3;
      let parsed: GeneratedJson | null = null;
      for (let llmTry = 0; llmTry < MAX_LLM_RETRIES; llmTry++) {
        const completion = await getGroqChatCompletion(
          [
            { role: "system", content: GENERATION_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          { model, apiKey, jsonMode: true }
        );
        const raw = completion.choices[0]?.message?.content?.trim() ?? "";
        const obj = extractJsonObject(raw);
        parsed = obj ? parsedToGenerated(obj) : null;
        if (parsed) break;
        if (llmTry < MAX_LLM_RETRIES - 1) {
          console.log(`  Invalid JSON (attempt ${llmTry + 1}/${MAX_LLM_RETRIES}), retrying...`);
        }
      }

      if (!parsed) {
        skipped++;
        console.log(`  Skipped (invalid JSON after ${MAX_LLM_RETRIES} attempts).`);
        if ((i + 1) % 50 === 0) {
          console.log(`  Progress: ${i + 1}/${puzzles.length} — Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
        }
        await sleep(THROTTLE_MS);
        continue;
      }

      const lineCount = puzzle.file.content.split(/\n/).length;
      const answerKey = toAnswerKey(parsed, lineCount);
      const question = String(parsed.question);
      const explanation = String(parsed.explanation ?? "");
      const gradingRubric =
        typeof parsed.answer === "string"
          ? `Correct answer: ${parsed.answer}. Grade by exact match or rubric in explanation.`
          : "";
      await updatePuzzleContent(puzzle.id, { question, answerKey, explanation, gradingRubric });
      updated++;
      console.log(`  Updated DB with new question/answer/explanation.`);
      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${puzzles.length} — Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/429|rate limit/i.test(msg)) {
        const oldModel = model;
        modelIndex = (modelIndex + 1) % models.length;
        const newModel = models[modelIndex];
        if (modelIndex === 0) {
          keyIndex = (keyIndex + 1) % apiKeys.length;
          console.warn(`  Groq rate limit (429). All models tried for this key. Switching to key #${keyIndex + 1}, model: ${newModel}. Retrying this puzzle.`);
          if (keyIndex === 0) {
            console.warn("  All keys cycled. Sleeping 1 day...");
            await sleep(ONE_DAY_MS);
          }
        } else {
          console.warn(`  Groq rate limit (429). Trying next model: ${oldModel} → ${newModel}. Retrying this puzzle.`);
        }
        i--;
        continue;
      }
      errors++;
      console.warn(`  Error:`, msg);
    }

    await sleep(THROTTLE_MS);
  }

  console.log("\n=== Regenerate complete ===");
  console.log(`Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
