"use client";

import { useCallback, useRef, useEffect, type ReactNode } from "react";
import Editor from "@monaco-editor/react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { Attribution } from "@/components/Attribution";
import type { Puzzle, SelectedRange, GradeResult as GradeResultType } from "@/lib/types";

function RichText({ text }: { text: string }): ReactNode {
  const parts = text.split(/\n/);
  if (parts.length <= 1) return <>{text}</>;
  return (
    <>
      {parts.map((line, i) => (
        <span key={i}>
          {line}
          {i < parts.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

type PuzzleCategory = "web" | "systems" | "mobile" | "data" | "other";

interface CodePuzzleViewProps {
  puzzle: Puzzle;
  currentSelection: SelectedRange | null;
  onCurrentSelectionChange: (range: SelectedRange | null) => void;
  selectedRanges: SelectedRange[];
  onSelectedRangesChange: (ranges: SelectedRange[]) => void;
  optionalExplanation: string;
  onOptionalExplanationChange: (value: string) => void;
  onSubmit: () => void;
  onInsufficientContext: () => void;
  isSubmitting: boolean;
  gradeResult?: GradeResultType | null;
  onNextPuzzle?: () => void;
  filterCategory?: PuzzleCategory | "";
  filterLanguage?: string;
  onFilterCategoryChange?: (cat: PuzzleCategory | "") => void;
  onFilterLanguageChange?: (lang: string) => void;
  availableLanguages?: string[];
  onApplyFilters?: () => void;
  onClearFilters?: () => void;
  categories?: PuzzleCategory[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type MonacoInstance = any;
type MonacoEditorInstance = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function CodePuzzleView({
  puzzle,
  currentSelection,
  onCurrentSelectionChange,
  selectedRanges,
  onSelectedRangesChange,
  optionalExplanation,
  onOptionalExplanationChange,
  onSubmit,
  onInsufficientContext,
  isSubmitting,
  gradeResult,
  onNextPuzzle,
  filterCategory = "",
  filterLanguage = "",
  onFilterCategoryChange,
  onFilterLanguageChange,
  availableLanguages = [],
  onApplyFilters,
  onClearFilters,
  categories = [],
}: CodePuzzleViewProps) {
  const { theme } = useTheme();
  const editorTheme = theme === "dark" ? "vs-dark" : "vs-light";
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<MonacoInstance | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const isGraded = !!gradeResult;

  const handleEditorMount = useCallback(
    (editor: MonacoEditorInstance, monaco: MonacoInstance) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      if (!editor?.onDidChangeCursorSelection) return;
      editor.onDidChangeCursorSelection(
        (e: { selection: { startLineNumber: number; endLineNumber: number } }) => {
          const { startLineNumber, endLineNumber } = e.selection;
          if (startLineNumber === endLineNumber && startLineNumber === 1) {
            const model = editor.getModel?.();
            const lineCount = model?.getLineCount?.() ?? 0;
            if (lineCount <= 1) {
              onCurrentSelectionChange(null);
              return;
            }
          }
          onCurrentSelectionChange({
            startLine: startLineNumber,
            endLine: endLineNumber,
          });
        }
      );
    },
    [onCurrentSelectionChange]
  );

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const mkRange = (sl: number, sc: number, el: number, ec: number) =>
      new monaco.Range(sl, sc, el, ec);

    const decorations: Array<{ range: unknown; options: { isWholeLine: boolean; className: string; glyphMarginClassName?: string } }> = [];

    if (isGraded) {
      if (selectedRanges.length > 0) {
        for (const r of selectedRanges) {
          decorations.push({
            range: mkRange(r.startLine, 1, r.endLine, 1),
            options: { isWholeLine: true, className: "monaco-highlight-red", glyphMarginClassName: "monaco-highlight-red-glyph" },
          });
        }
      }
      if (gradeResult?.expectedRange) {
        decorations.push({
          range: mkRange(
            gradeResult.expectedRange.startLine, 1,
            gradeResult.expectedRange.endLine, 1
          ),
          options: { isWholeLine: true, className: "monaco-highlight-green", glyphMarginClassName: "monaco-highlight-green-glyph" },
        });
        editor.revealLineInCenter(gradeResult.expectedRange.startLine);
      }
    } else if (selectedRanges.length > 0) {
      for (const r of selectedRanges) {
        decorations.push({
          range: mkRange(r.startLine, 1, r.endLine, 1),
          options: { isWholeLine: true, className: "monaco-highlight-selected", glyphMarginClassName: "monaco-highlight-selected-glyph" },
        });
      }
    }

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  }, [isGraded, gradeResult, selectedRanges]);

  const addSelectionToAnswer = useCallback(() => {
    if (!currentSelection) return;
    const isDuplicate = selectedRanges.some(
      (r) => r.startLine === currentSelection.startLine && r.endLine === currentSelection.endLine
    );
    if (isDuplicate) return;

    const overlaps = (a: SelectedRange, b: SelectedRange) =>
      a.startLine <= b.endLine && b.startLine <= a.endLine;

    const merged = [...selectedRanges];
    let newRange = { ...currentSelection };
    let i = merged.length - 1;
    while (i >= 0) {
      if (overlaps(merged[i]!, newRange)) {
        newRange = {
          startLine: Math.min(merged[i]!.startLine, newRange.startLine),
          endLine: Math.max(merged[i]!.endLine, newRange.endLine),
        };
        merged.splice(i, 1);
      }
      i--;
    }
    merged.push(newRange);
    merged.sort((a, b) => a.startLine - b.startLine);
    onSelectedRangesChange(merged);
  }, [currentSelection, selectedRanges, onSelectedRangesChange]);

  const removeRange = useCallback(
    (index: number) => {
      onSelectedRangesChange(selectedRanges.filter((_, i) => i !== index));
    },
    [selectedRanges, onSelectedRangesChange]
  );

  const rangeLabel =
    selectedRanges.length === 0
      ? "Select lines and add them to your answer"
      : selectedRanges.length === 1
        ? selectedRanges[0]!.startLine === selectedRanges[0]!.endLine
          ? `Line ${selectedRanges[0]!.startLine}`
          : `Lines ${selectedRanges[0]!.startLine}–${selectedRanges[0]!.endLine}`
        : `${selectedRanges.length} range(s) added`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr] lg:gap-6">
      {/* Code panel */}
      <motion.div
        className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100/80 dark:border-zinc-700/80 dark:bg-zinc-900/50"
        style={{ height: "min(60vh, 600px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative flex-1">
          <Editor
            key={editorTheme}
            height="100%"
            language={puzzle.file.language}
            value={puzzle.file.content}
            theme={editorTheme}
            options={{
              readOnly: true,
              lineNumbers: "on",
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              padding: { top: 16 },
              fontSize: 14,
              automaticLayout: true,
              glyphMargin: isGraded || selectedRanges.length > 0,
            }}
            onMount={handleEditorMount}
            loading={
              <div className="flex h-full min-h-[320px] items-center justify-center bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                Loading editor…
              </div>
            }
          />
        </div>
      </motion.div>

      {/* Right panel */}
      <motion.div
        className="flex flex-col gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      >
        <Attribution
          puzzle={puzzle}
          className="rounded-xl border-zinc-200 bg-zinc-50/80 dark:border-zinc-700/80 dark:bg-zinc-800/40"
        />

        {isGraded ? (
          /* --- Grade result view --- */
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`inline-flex rounded-xl px-3.5 py-1.5 text-sm font-medium ${
                    gradeResult!.correct
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-500/20 text-red-700 dark:text-red-300"
                  }`}
                >
                  {gradeResult!.correct ? "Correct" : "Incorrect"}
                </span>
              </div>
              <p className="mb-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                {puzzle.question}
              </p>
              <p className="leading-relaxed text-sm text-zinc-700 dark:text-zinc-300">
                <RichText text={gradeResult!.explanation} />
              </p>
              {gradeResult!.whatYouMissed && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium text-zinc-800 dark:text-zinc-300">What you missed:</span>{" "}
                  <RichText text={gradeResult!.whatYouMissed} />
                </p>
              )}
            </div>

            {/* Legend */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Highlights in code
              </p>
              <div className="flex flex-col gap-1.5 text-sm">
                {selectedRanges.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm bg-red-400/25 border border-red-400/40" />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      Your selection{selectedRanges.length > 1 ? "s" : ""}
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {" "}({selectedRanges.map((r) =>
                          r.startLine === r.endLine ? `L${r.startLine}` : `L${r.startLine}–${r.endLine}`
                        ).join(", ")})
                      </span>
                    </span>
                  </div>
                )}
                {gradeResult!.expectedRange && (
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm bg-emerald-400/25 border border-emerald-400/40" />
                    <span className="text-zinc-700 dark:text-zinc-300">
                      Expected answer
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {" "}(L{gradeResult!.expectedRange.startLine}–{gradeResult!.expectedRange.endLine})
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <motion.button
                type="button"
                onClick={onNextPuzzle}
                className="min-h-[44px] rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Next puzzle
              </motion.button>
              <Link
                href="/"
                className="flex min-h-[44px] items-center rounded-xl border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-500 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              >
                Home
              </Link>
            </div>
          </div>
        ) : (
          /* --- Puzzle answering view --- */
          <>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700/80 dark:bg-zinc-800/40">
              <p className="mb-1.5 font-medium text-zinc-900 dark:text-zinc-100">
                {puzzle.question}
              </p>
              <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
                {rangeLabel}
              </p>
              {selectedRanges.length > 0 && (
                <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedRanges.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span>
                        {r.startLine === r.endLine
                          ? `Line ${r.startLine}`
                          : `Lines ${r.startLine}–${r.endLine}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRange(i)}
                        className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  onClick={addSelectionToAnswer}
                  disabled={!currentSelection}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Add selection to answer
                </motion.button>
              </div>
            </div>

            <div>
              <label
                htmlFor="explanation"
                className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >
                Optional explanation
              </label>
              <textarea
                id="explanation"
                className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
                rows={3}
                placeholder="Add a short explanation (optional)"
                value={optionalExplanation}
                onChange={(e) => onOptionalExplanationChange(e.target.value)}
                maxLength={2000}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <motion.button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting || selectedRanges.length === 0}
                className="min-h-[44px] rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:disabled:hover:bg-white"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSubmitting ? "Submitting…" : "Submit"}
              </motion.button>
              <motion.button
                type="button"
                onClick={onInsufficientContext}
                disabled={isSubmitting}
                className="min-h-[44px] rounded-xl border border-zinc-300 bg-transparent px-6 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-500 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Insufficient context
              </motion.button>
            </div>

            {/* Category / language filters under submit */}
            {categories.length > 0 && onFilterCategoryChange && onFilterLanguageChange && onApplyFilters && onClearFilters && (
              <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700/80 dark:bg-zinc-800/40">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => onFilterCategoryChange(e.target.value as PuzzleCategory | "")}
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">All categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Language</label>
                  <select
                    value={filterLanguage}
                    onChange={(e) => onFilterLanguageChange(e.target.value)}
                    className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="">All languages</option>
                    {availableLanguages.map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={onApplyFilters}
                  className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  Apply
                </button>
                {(filterCategory || filterLanguage) && (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
