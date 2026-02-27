import "server-only";
import { getGroqChatCompletionForGrading } from "./groq";
import { getCachedPuzzle } from "./puzzle-generator";
import type { Puzzle, Submission, GradeResult, SelectedRange } from "./types";

interface LLMGradeRaw {
  correct?: boolean;
  explanation?: string;
  whatYouMissed?: string | null;
  insufficientContextAllowed?: boolean;
}

function parseGradeJson(text: string): LLMGradeRaw | null {
  const trimmed = text.trim().replace(/^```json?\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed) as LLMGradeRaw;
  } catch {
    return null;
  }
}

/**
 * Grade a submission using Groq. Server-only.
 * If insufficientContext is true, asks LLM whether that's valid per rubric.
 * Otherwise compares selection + explanation to expected.
 */
export async function gradeSubmission(
  submission: Submission
): Promise<GradeResult | null> {
  const puzzle = getCachedPuzzle(submission.puzzleId);
  if (!puzzle) return null;

  const { answerKey, question, gradingRubric, file } = puzzle;
  const expectedRange: SelectedRange = {
    startLine: answerKey.startLine,
    endLine: answerKey.endLine,
  };

  if (submission.insufficientContext) {
    const systemPrompt =
      "You grade code comprehension answers. Output only valid JSON.";
    const userPrompt = `User chose "Insufficient context" for this question: ${question}
Grading rubric: ${gradingRubric}
The rubric says insufficientContextAllowed: ${answerKey.insufficientContextAllowed}.
Was the user's choice valid? Return a single JSON object: { "correct": boolean, "explanation": string, "insufficientContextAllowed": boolean }.`;

    try {
      const completion = await getGroqChatCompletionForGrading([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);
      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      const parsed = parseGradeJson(raw);
      if (!parsed) return null;
      return {
        correct: Boolean(parsed.correct),
        insufficientContextAllowed: Boolean(parsed.insufficientContextAllowed),
        explanation: String(parsed.explanation ?? ""),
        whatYouMissed: null,
        expectedRange: parsed.correct ? null : expectedRange,
      };
    } catch {
      return null;
    }
  }

  const ranges = submission.selectedRanges ?? (submission.selectedRange ? [submission.selectedRange] : []);
  const rangesStr =
    ranges.length === 0
      ? "(none)"
      : ranges
          .map((r) => (r.startLine === r.endLine ? `line ${r.startLine}` : `lines ${r.startLine}-${r.endLine}`))
          .join("; ");
  const systemPrompt =
    "You grade code comprehension answers. Output only valid JSON.";
  const userPrompt = `Question: ${question}
Expected answer: lines ${answerKey.startLine}-${answerKey.endLine}.
Grading rubric: ${gradingRubric}
User selected (can be multiple ranges): ${rangesStr}.
User explanation: ${submission.optionalExplanation ?? "(none)"}
Is the answer correct? Consider whether the user's selected line(s) cover or overlap the expected range; multiple disjoint ranges are allowed if they together answer the question.
Return a single JSON object: { "correct": boolean, "explanation": string, "whatYouMissed": string | null }.`;

  try {
    const completion = await getGroqChatCompletionForGrading([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = parseGradeJson(raw);
    if (!parsed) return null;
    return {
      correct: Boolean(parsed.correct),
      insufficientContextAllowed: answerKey.insufficientContextAllowed,
      explanation: String(parsed.explanation ?? ""),
      whatYouMissed: parsed.whatYouMissed ?? null,
      expectedRange: parsed.correct ? null : expectedRange,
    };
  } catch {
    return null;
  }
}
