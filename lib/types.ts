export interface Repo {
  owner: string;
  name: string;
  defaultBranch: string;
  licenseUrl: string | null;
}

export interface FileInfo {
  path: string;
  content: string;
  language: string;
  sizeBytes: number;
}

export interface Commit {
  sha: string;
  branch: string;
}

export interface AnswerKey {
  startLine: number;
  endLine: number;
  explanationHints?: string[];
  insufficientContextAllowed: boolean;
  /** New format: task type (TRACE, INVARIANT, etc.) */
  task_type?: string;
  /** Concrete inputs for deterministic grading */
  given?: Record<string, unknown>;
  /** Multiple-choice options; empty if not MCQ */
  choices?: string[];
  /** Exact gradeable answer (output / state / selected choice) */
  answer?: string;
  /** Common wrong answers or misconceptions */
  common_mistakes?: string[];
}

export type PuzzleCategory = "web" | "systems" | "mobile" | "data" | "other";

export interface Puzzle {
  puzzleId: string;
  repo: Repo;
  file: FileInfo;
  commit: Commit;
  question: string;
  answerKey: AnswerKey;
  explanation: string;
  gradingRubric: string;
  category?: PuzzleCategory;
  language?: string;
}

export interface SelectedRange {
  startLine: number;
  endLine: number;
}

export interface Submission {
  puzzleId: string;
  /** Single range (legacy) or use selectedRanges */
  selectedRange?: SelectedRange | null;
  /** Multiple line ranges (e.g. "add line to answer" like Cursor refs) */
  selectedRanges?: SelectedRange[];
  optionalExplanation: string | null;
  insufficientContext: boolean;
}

export interface GradeResult {
  correct: boolean;
  insufficientContextAllowed: boolean;
  explanation: string;
  whatYouMissed: string | null;
  expectedRange: SelectedRange | null;
}
