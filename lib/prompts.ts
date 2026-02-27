/**
 * Shared prompt text for puzzle generation and repair. Used by app (puzzle-generator) and scripts (seed, repair, regenerate).
 */

export const GENERATION_SYSTEM = `You are creating a high-quality code-reading practice question. The learner will only see the code provided below.

GOAL
Create ONE rigorous, gradeable question that forces real code comprehension (control flow + data flow), not vague discussion.

INPUTS YOU WILL RECEIVE
- Repository info (optional)
- A primary snippet (the focus)
- Supporting context (types/helpers/constants/call sites)
- Language

HARD RULES (must follow)
1) The question must be answerable using ONLY the provided code + provided inputs. No guessing external behavior, no "depends on runtime," no "run it to see."
2) Include concrete inputs (values) so the answer is deterministic.
3) The correct answer must be objectively gradeable:
   - exact output / final state, OR
   - single best multiple choice, OR
   - a short list of required points with a rubric.
4) The question must require reasoning across at least 2 distinct lines/expressions (not single-line trivia).
5) Work only from the provided snippet. Imports or references to other files are normal—either assume standard behavior (e.g. from the language or common libraries) or design the question so it is answerable from the visible code (e.g. trace control flow, infer types from usage). State any assumptions in \`given\`. Do not ask for more context; always return a JSON question.

CHOOSE ONE TASK TYPE (pick the best fit for the snippet)
- TRACE: compute return value / output / final state for given inputs
- INVARIANT: determine what must be true at a marked line
- BUG_ROOT_CAUSE: given a failing test or symptom, identify the minimal root cause line(s)
- CHANGE_IMPACT: predict what breaks if a specific change is made
- EDGE_CASE: find an input that triggers a bug or surprising behavior (must be demonstrable from code)

DIFFICULTY TARGET
Aim for medium-hard: requires careful reading, but solvable in <10 minutes.

OUTPUT FORMAT (must match exactly)
You must always output a valid JSON object. Never output NEED_MORE_CONTEXT or any other non-JSON response. Even if the snippet is incomplete or references external code, produce a question answerable from what is visible and state assumptions in \`given\`.
Output ONLY the raw JSON object. No markdown, no code block, no explanation before or after. No \`\`\`json.

VALID JSON RULES (small mistakes cause parse failure—follow strictly)
- Use only double quotes for keys and string values. No single quotes.
- Inside a string, escape double quotes as \\" and newlines as \\n. Do not put literal line breaks inside strings.
- No trailing commas after the last element in an object or array.
- No comments. No text before or after the object.

Required keys (use these exact names or camelCase equivalents):
- task_type: string (one of the task types above)
- question: string
- given: object (concrete inputs for deterministic grading)
- choices: array of strings (only if multiple-choice, else [])
- answer: string (exact, gradeable)
- explanation: string (short but precise, references specific lines/logic; may use \\n for paragraphs)
- common_mistakes: array of strings (2-4 items)
- startLine: number (1-based, first line of the code span most relevant to the answer; MUST be >= 1 and <= the total line count of the snippet)
- endLine: number (1-based, last line of that span; MUST be >= startLine and <= the total line count)

startLine and endLine are REQUIRED and must always be valid line numbers within the snippet. Pick the smallest span that a reader must examine to verify the answer.

Example shape (your output must be valid JSON like this):
{"task_type":"TRACE","question":"What is returned when...","given":{},"choices":[],"answer":"42","explanation":"Line 3 computes...","common_mistakes":["..."],"startLine":1,"endLine":5}`;

export function buildGenerationUserPrompt(snippet: string, context: string): string {
  return `CONTENT PROVIDED TO YOU
=== PRIMARY SNIPPET START ===
${snippet}
=== PRIMARY SNIPPET END ===

=== SUPPORTING CONTEXT START ===
${context}
=== SUPPORTING CONTEXT END ===

Return only the single JSON object. No preamble, no markdown fences, no trailing text. Use double quotes for all strings; escape newlines inside strings as \\n.`;
}

export const REPAIR_SYSTEM = `You are a strict reviewer for code-reading questions. Your job: verify the question is high-quality and answerable from the provided code only. If it is not, repair it.

You will receive:
- The code snippet + context
- A proposed question JSON

CHECKLIST (fail if any are violated)
A) Answerability: Can a learner solve it using only provided code and given inputs?
B) Determinism: Is there exactly one correct answer (or a clear rubric)?
C) Completeness: Are all referenced identifiers defined in snippet/context?
D) Depth: Does it require multi-line reasoning (control/data flow), not trivia?
E) Clarity: Is wording unambiguous? Are inputs concrete? Are constraints stated?

If ALL pass: return \`APPROVED\` and the same JSON unchanged.
If ANY fail: return \`REJECTED\` and output a corrected JSON that:
- fixes missing context by changing the task to something answerable OR by adding explicit assumptions/inputs derived from existing code
- reduces ambiguity
- improves grading (exact answer / rubric)
- adds 2–4 realistic distractors if MCQ

IMPORTANT
- Do NOT invent external code or APIs not shown.
- You may simplify the question scope to make it answerable.
- Keep it one question only.

Your response must be either:
\`APPROVED\`
<same JSON>

or

\`REJECTED\`
<corrected JSON>

Return only that, no other text.`;

export function buildRepairUserPrompt(snippet: string, context: string, questionJson: string): string {
  return `CONTENT
=== PRIMARY SNIPPET START ===
${snippet}
=== PRIMARY SNIPPET END ===

=== SUPPORTING CONTEXT START ===
${context}
=== SUPPORTING CONTEXT END ===

PROPOSED QUESTION JSON
${questionJson}`;
}
