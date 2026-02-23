/**
 * Puzzle generator for CLI seed script only. No "server-only" so seed can run under Bun.
 * Same logic as lib/puzzle-generator.ts but uses script-safe GitHub/Groq clients.
 */

import {
  getAllLanguages,
  getCategoryForLanguage,
  isPathForLanguage,
} from "../lib/categories";
import type { RepoSearchItem } from "./github-search-client";
import { getRandomRepoForLanguage } from "./github-search-client";
import {
  fetchRepoTree,
  fetchFileContent,
  getCommitSha,
} from "./github-client";
import { getGroqChatCompletion } from "./groq-client";
import { GENERATION_SYSTEM, buildGenerationUserPrompt } from "./prompts";
import { extractJsonObject, getKey } from "../lib/parse-llm-json";
import { stripThinkTags } from "../lib/sanitize";
import type { Puzzle, Repo, Commit, AnswerKey } from "../lib/types";

const MIN_LINES = 20;
const MAX_LINES = 200;
const MAX_FILE_TRIES_PER_REPO = 20;

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

/** Shuffle array in place using rng. */
function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/** Throw so seed can switch key/model. */
function isGroqRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|rate limit/i.test(msg);
}

export async function generatePuzzle(
  seed?: string,
  options?: {
    language?: string;
    apiKey?: string;
    model?: string;
    /** When provided, pick repo from this list (no GitHub Search API call). */
    repos?: RepoSearchItem[];
    onLog?: (msg: string) => void;
  }
): Promise<Puzzle | null> {
  const rng = seedRandom(seed);
  const log = options?.onLog ?? (() => {});
  const languages = getAllLanguages();
  if (languages.length === 0) return null;

  const targetLanguage = options?.language ?? languages[Math.floor(rng() * languages.length)]!;
  const maxRepoAttempts = 5;
  let lastError = "All 5 repo attempts failed.";

  for (let repoAttempt = 0; repoAttempt < maxRepoAttempts; repoAttempt++) {
    log(`  Repo attempt ${repoAttempt + 1}/${maxRepoAttempts}`);

    let repoItem: RepoSearchItem | null;
    if (options?.repos && options.repos.length > 0) {
      repoItem = options.repos[Math.floor(rng() * options.repos.length)]!;
      log(`  Picked repo: ${repoItem.full_name}`);
    } else {
      try {
        repoItem = await getRandomRepoForLanguage(targetLanguage, rng);
        if (repoItem) log(`  Picked repo: ${repoItem.full_name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("GITHUB_RATE_LIMIT")) throw err;
        lastError = String(msg);
        log(`  Search failed: ${msg}`);
        continue;
      }
    }
    if (!repoItem) {
      lastError = `No repos found for language ${targetLanguage}.`;
      continue;
    }

    const [owner, name] = repoItem.full_name.split("/");
    const ref = repoItem.default_branch || "main";

    log(`  Fetching tree: GET /repos/${owner}/${name}/git/trees/${ref}?recursive=1`);
    const tree = await fetchRepoTree(owner!, name!, ref);
    if (!tree || tree.length === 0) {
      log(`  Tree empty or failed, next repo`);
      continue;
    }
    const treeForLang = tree.filter((f) => isPathForLanguage(f.path, targetLanguage));
    const fileList = treeForLang.length > 0 ? treeForLang : tree;
    shuffle(fileList, rng);
    log(`  Tree has ${fileList.length} files; will try up to ${MAX_FILE_TRIES_PER_REPO} from this repo`);

    const sha = await getCommitSha(owner!, name!, ref);

    for (let fileTry = 0; fileTry < Math.min(MAX_FILE_TRIES_PER_REPO, fileList.length); fileTry++) {
      const fileEntry = fileList[fileTry]!;
      const path = fileEntry.path;
      log(`  File ${fileTry + 1}/${Math.min(MAX_FILE_TRIES_PER_REPO, fileList.length)}: ${path}`);

      const fileInfo = await fetchFileContent(owner!, name!, path, ref);
      if (!fileInfo || fileInfo.content.length < 100) {
        log(`    Too short or missing, next file`);
        continue;
      }

      const contentForLlm = stripThinkTags(fileInfo.content);
      const lineCount = contentForLlm.split(/\n/).length;
      if (lineCount < MIN_LINES) {
        log(`    ${lineCount} lines (min ${MIN_LINES}), next file`);
        continue;
      }
      if (lineCount > MAX_LINES) {
        log(`    ${lineCount} lines (max ${MAX_LINES}), next file`);
        continue;
      }
      log(`    ${lineCount} lines (OK), calling Groq...`);

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
          log(`    LLM invalid JSON, next file`);
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

        log(`  Built puzzle: ${puzzle.puzzleId}`);
        return puzzle;
      } catch (err) {
        if (isGroqRateLimit(err)) {
          log(`  Groq rate limit (429) — rethrowing so seed can switch key/model`);
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        log(`  Groq error: ${message}, next file`);
      }
    }

    log(`  No suitable file in this repo, trying next repo`);
  }

  log(`  All ${maxRepoAttempts} repo attempts failed. Last error: ${lastError}`);
  return null;
}
