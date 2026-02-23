/**
 * CLI: Review every puzzle with the repair prompt; if REJECTED, update with corrected JSON.
 * Run with: bun run db:repair
 * Uses same 7 Groq API keys and 5 models; rotates model then key on 429.
 */
import { config } from "dotenv";
import { join } from "path";
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

function parseRepairResponse(text: string): { status: "APPROVED" | "REJECTED"; json?: string } {
  const cleaned = stripThinkTags(text).trim();
  const firstLine = cleaned.split("\n")[0]?.trim().toUpperCase() ?? "";
  if (firstLine === "APPROVED") {
    const rest = cleaned.slice(cleaned.indexOf("\n") + 1).trim();
    return { status: "APPROVED", json: rest || undefined };
  }
  if (firstLine === "REJECTED") {
    const rest = cleaned.slice(cleaned.indexOf("\n") + 1).trim().replace(/^```json?\s*|\s*```$/g, "");
    return { status: "REJECTED", json: rest || undefined };
  }
  return { status: "APPROVED" };
}

interface RepairJson {
  question?: string;
  explanation?: string;
  gradingRubric?: string;
  startLine?: number;
  endLine?: number;
  task_type?: string;
  given?: Record<string, unknown>;
  choices?: string[];
  answer?: string;
  common_mistakes?: string[];
}

function repairJsonToAnswerKey(parsed: RepairJson, lineCount: number): AnswerKey {
  let startLine = typeof parsed.startLine === "number" ? parsed.startLine : 1;
  let endLine = typeof parsed.endLine === "number" ? parsed.endLine : 1;
  startLine = Math.max(1, Math.min(startLine, lineCount));
  endLine = Math.max(1, Math.min(endLine, lineCount));
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
  const { REPAIR_SYSTEM, buildRepairUserPrompt } = await import("./prompts");

  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    console.error("Set at least GROQ_API_KEY in .env.local");
    process.exit(1);
  }
  const models = [...SEED_MODELS];
  const puzzles = await getAllPuzzles();

  console.log("=== Repair config ===");
  console.log(`Total puzzles: ${puzzles.length}`);
  console.log(`API keys: ${apiKeys.length} (GROQ_API_KEY, GROQ_API_KEY2, ...)`);
  console.log(`Models: ${models.join(", ")}`);
  console.log("Reviewing each puzzle with repair prompt; REJECTED → update DB with corrected JSON.\n");

  let keyIndex = 0;
  let modelIndex = 0;
  let approved = 0;
  let rejected = 0;
  let errors = 0;

  for (let i = 0; i < puzzles.length; i++) {
    const puzzle = puzzles[i]!;
    const apiKey = apiKeys[keyIndex];
    const model = models[modelIndex];
    const keyLabel = keyIndex + 1;

    console.log(`\n--- Puzzle ${i + 1}/${puzzles.length} (key #${keyLabel}, model: ${model}) ---`);
    console.log(`  puzzleId: ${puzzle.puzzleId}`);
    console.log(`  Calling Groq (repair prompt)...`);

    const snippet = puzzle.file.content.slice(0, 12000);
    const context = `Language: ${puzzle.file.language}. Path: ${puzzle.file.path}. Repo: ${puzzle.repo.owner}/${puzzle.repo.name}.`;
    const questionJson = JSON.stringify({
      question: puzzle.question,
      answerKey: puzzle.answerKey,
      explanation: puzzle.explanation,
      gradingRubric: puzzle.gradingRubric,
    });

    try {
      const completion = await getGroqChatCompletion(
        [
          { role: "system", content: REPAIR_SYSTEM },
          { role: "user", content: buildRepairUserPrompt(snippet, context, questionJson) },
        ],
        { model, apiKey }
      );
      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      const { status, json } = parseRepairResponse(raw);

      if (status === "APPROVED") {
        approved++;
        console.log(`  APPROVED (no change).`);
        if ((i + 1) % 50 === 0) {
          console.log(`  Progress: ${i + 1}/${puzzles.length} — Approved: ${approved}, Rejected: ${rejected}, Errors: ${errors}`);
        }
        await sleep(THROTTLE_MS);
        continue;
      }

      if (status === "REJECTED" && json) {
        try {
          const corrected = JSON.parse(json) as RepairJson;
          const lineCount = puzzle.file.content.split(/\n/).length;
          const answerKey = repairJsonToAnswerKey(corrected, lineCount);
          const question = String(corrected.question ?? puzzle.question);
          const explanation = String(corrected.explanation ?? puzzle.explanation);
          const gradingRubric =
            typeof corrected.answer === "string"
              ? `Correct answer: ${corrected.answer}.`
              : String(corrected.gradingRubric ?? puzzle.gradingRubric);
          await updatePuzzleContent(puzzle.id, { question, answerKey, explanation, gradingRubric });
          rejected++;
          console.log(`  REJECTED → updated DB with corrected question/answer/explanation.`);
        } catch (parseErr) {
          console.warn(`  REJECTED but corrected JSON invalid:`, parseErr);
          errors++;
        }
      } else {
        rejected++;
        console.warn(`  REJECTED but no JSON in response.`);
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

  console.log("\n=== Repair complete ===");
  console.log(`Approved: ${approved}, Rejected (updated): ${rejected}, Errors: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
