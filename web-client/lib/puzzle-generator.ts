import "server-only";
import {
  getAllLanguages,
  getCategoryForLanguage,
  isPathForLanguage,
} from "./categories";
import { getRandomRepoForLanguage } from "./github-search";
import {
  fetchRepoTree,
  fetchFileContent,
  getCommitSha,
} from "./github";
import { getGroqChatCompletion } from "./groq";
import { extractJsonObject, getKey } from "./parse-llm-json";
import { GENERATION_SYSTEM, buildGenerationUserPrompt } from "./prompts";
import { stripThinkTags } from "./sanitize";
import type { Puzzle, Repo, Commit, AnswerKey } from "./types";

const PUZZLE_CACHE_MAX = 50;
const MIN_LINES = 20;
const puzzleCache = new Map<string, Puzzle>();

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function seedRandom(seed?: string): () => number {
  if (!seed) return Math.random;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 2 ** 32;
  };
}

interface LLMPuzzleRaw {
  task_type?: string;
  question?: string;
  given?: Record<string, unknown>;
  choices?: string[];
  answer?: string;
  explanation?: string;
  common_mistakes?: string[];
  startLine?: number;
  endLine?: number;
  explanationHints?: string[];
  gradingRubric?: string;
  insufficientContextAllowed?: boolean;
}

function objToLLMPuzzleRaw(obj: Record<string, unknown>): LLMPuzzleRaw | null {
  const question = obj.question ?? obj.Question;
  const startLine = obj.startLine ?? obj.start_line;
  const endLine = obj.endLine ?? obj.end_line;
  if (typeof question !== "string") return null;
  const sl = Number(startLine);
  const el = Number(endLine);
  if (!Number.isInteger(sl) || !Number.isInteger(el) || sl < 1 || el < 1) return null;
  return {
    task_type: getKey(obj, "task_type", "taskType") as string | undefined,
    question: String(question),
    given: getKey(obj, "given", "given") as Record<string, unknown> | undefined,
    choices: (getKey(obj, "choices", "choices") as string[] | undefined) ?? undefined,
    answer: getKey(obj, "answer", "answer") as string | undefined,
    explanation: getKey(obj, "explanation", "explanation") as string | undefined,
    common_mistakes:
      (getKey(obj, "common_mistakes", "commonMistakes") as string[] | undefined) ?? undefined,
    startLine: sl,
    endLine: el,
    explanationHints: (getKey(obj, "explanationHints", "explanationHints") as string[] | undefined) ?? undefined,
    gradingRubric: getKey(obj, "gradingRubric", "grading_rubric") as string | undefined,
    insufficientContextAllowed: Boolean(getKey(obj, "insufficientContextAllowed", "insufficient_context_allowed")),
  };
}

/**
 * Generate one puzzle: pick random repo/file, fetch content, call Groq, return Puzzle.
 * Caches by puzzleId (repo:path:sha). Server-only.
 */
function setLastPuzzleError(msg: string): void {
  try {
    (globalThis as unknown as { __lastPuzzleError?: string }).__lastPuzzleError = msg;
  } catch {
    // ignore
  }
}

export async function generatePuzzle(
  seed?: string,
  options?: { language?: string; category?: string; apiKey?: string; model?: string }
): Promise<Puzzle | null> {
  const rng = seedRandom(seed);
  const languages = getAllLanguages();
  if (languages.length === 0) {
    setLastPuzzleError("No languages configured.");
    return null;
  }

  const targetLanguage = options?.language ?? languages[Math.floor(rng() * languages.length)]!;
  const maxAttempts = 5;
  let lastError = "All 5 attempts failed.";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let repoItem: Awaited<ReturnType<typeof getRandomRepoForLanguage>>;
    try {
      repoItem = await getRandomRepoForLanguage(targetLanguage, rng);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("GITHUB_RATE_LIMIT")) {
        throw err; // Let caller (e.g. seed script) sleep and retry
      }
      lastError = `Attempt ${attempt + 1}: ${msg}`;
      if (process.env.NODE_ENV === "development") console.warn("[generatePuzzle]", lastError);
      continue;
    }
    if (!repoItem) {
      lastError = `Attempt ${attempt + 1}: no repos found for language ${targetLanguage}.`;
      continue;
    }
    const [owner, name] = repoItem.full_name.split("/");
    const ref = repoItem.default_branch || "main";

    const tree = await fetchRepoTree(owner!, name!, ref);
    if (!tree || tree.length === 0) {
      lastError = `Attempt ${attempt + 1}: no files in tree for ${owner}/${name}.`;
      if (process.env.NODE_ENV === "development") console.warn("[generatePuzzle]", lastError);
      continue;
    }

    const treeForLang = tree.filter((f) => isPathForLanguage(f.path, targetLanguage));
    const files = treeForLang.length > 0 ? treeForLang : tree;
    const fileEntry = files[Math.floor(rng() * files.length)]!;
    const path = fileEntry.path;

    const fileInfo = await fetchFileContent(owner!, name!, path, ref);
    if (!fileInfo || fileInfo.content.length < 100) {
      lastError = `Attempt ${attempt + 1}: file too short or missing (${path}).`;
      if (process.env.NODE_ENV === "development") console.warn("[generatePuzzle]", lastError);
      continue;
    }

    const contentForLlm = stripThinkTags(fileInfo.content);
    const lineCount = contentForLlm.split(/\n/).length;
    if (lineCount < MIN_LINES) {
      lastError = `Attempt ${attempt + 1}: file has fewer than ${MIN_LINES} lines (${path}).`;
      if (process.env.NODE_ENV === "development") console.warn("[generatePuzzle]", lastError);
      continue;
    }

    const sha = await getCommitSha(owner!, name!, ref);

    const snippet = contentForLlm.slice(0, 12000);
    const context = `Language: ${fileInfo.language}. File path: ${path}. Repo: ${owner}/${name}. Line count: ${lineCount}.`;
    const userPrompt = buildGenerationUserPrompt(snippet, context);

    try {
      const completion = await getGroqChatCompletion(
        [
          { role: "system", content: GENERATION_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        { model: options?.model, apiKey: options?.apiKey }
      );
      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      const obj = extractJsonObject(raw);
      const parsed = obj ? objToLLMPuzzleRaw(obj) : null;
      if (!parsed) {
        lastError = `Attempt ${attempt + 1}: LLM returned invalid JSON or missing question/startLine/endLine.`;
        if (process.env.NODE_ENV === "development") console.warn("[generatePuzzle]", lastError, "raw:", raw?.slice(0, 200));
        continue;
      }

      let startLine = Math.max(1, Math.min(parsed.startLine ?? 1, lineCount));
      let endLine = Math.max(1, Math.min(parsed.endLine ?? 1, lineCount));
      if (startLine > endLine) [startLine, endLine] = [endLine, startLine];

      const puzzleId = `${owner}:${name}:${path}:${sha}`;
      const licenseUrl = `https://github.com/${owner}/${name}/blob/${ref}/LICENSE`;
      const repo: Repo = {
        owner: owner!,
        name: name!,
        defaultBranch: ref,
        licenseUrl,
      };
      const commit: Commit = { sha, branch: ref };
      const answerKey: AnswerKey = {
        startLine,
        endLine,
        explanationHints: Array.isArray(parsed.explanationHints) ? parsed.explanationHints : [],
        insufficientContextAllowed: Boolean(parsed.insufficientContextAllowed),
        task_type: typeof parsed.task_type === "string" ? parsed.task_type : undefined,
        given: parsed.given && typeof parsed.given === "object" ? parsed.given : undefined,
        choices: Array.isArray(parsed.choices) ? parsed.choices : undefined,
        answer: typeof parsed.answer === "string" ? parsed.answer : undefined,
        common_mistakes: Array.isArray(parsed.common_mistakes) ? parsed.common_mistakes : undefined,
      };
      const category = getCategoryForLanguage(targetLanguage);
      const gradingRubric =
        typeof parsed.answer === "string"
          ? `Correct answer: ${parsed.answer}. Grade by exact match or rubric in explanation.`
          : String(parsed.gradingRubric ?? "");

      const puzzle: Puzzle = {
        puzzleId,
        repo,
        file: fileInfo,
        commit,
        question: String(parsed.question),
        answerKey,
        explanation: String(parsed.explanation ?? ""),
        gradingRubric,
        category,
        language: targetLanguage,
      };

      if (puzzleCache.size >= PUZZLE_CACHE_MAX) {
        const firstKey = puzzleCache.keys().next().value;
        if (firstKey) puzzleCache.delete(firstKey);
      }
      puzzleCache.set(puzzleId, puzzle);
      return puzzle;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = `Attempt ${attempt + 1}: ${message}`;
      if (process.env.NODE_ENV === "development") {
        console.warn("[generatePuzzle]", lastError);
        console.error(err);
      }
      continue;
    }
  }
  setLastPuzzleError(lastError);
  return null;
}

/**
 * Get a cached puzzle by puzzleId. Server-only.
 */
export function getCachedPuzzle(puzzleId: string): Puzzle | null {
  return puzzleCache.get(puzzleId) ?? null;
}

/**
 * Put a puzzle into the in-memory cache (e.g. when loaded from DB for grading). Server-only.
 */
export function setCachedPuzzle(puzzle: Puzzle): void {
  if (puzzleCache.size >= PUZZLE_CACHE_MAX) {
    const firstKey = puzzleCache.keys().next().value;
    if (firstKey) puzzleCache.delete(firstKey);
  }
  puzzleCache.set(puzzle.puzzleId, puzzle);
}
