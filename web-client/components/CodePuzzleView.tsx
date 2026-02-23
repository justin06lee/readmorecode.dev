"use client";

import { useCallback } from "react";
import Editor from "@monaco-editor/react";
import { motion } from "motion/react";
import { useTheme } from "@/components/ThemeProvider";
import { Attribution } from "@/components/Attribution";
import type { Puzzle } from "@/lib/types";
import type { SelectedRange } from "@/lib/types";

interface CodePuzzleViewProps {
  puzzle: Puzzle;
  /** Current editor selection (for "Add to answer" and display) */
  currentSelection: SelectedRange | null;
  onCurrentSelectionChange: (range: SelectedRange | null) => void;
  /** Committed line ranges (added to answer) */
  selectedRanges: SelectedRange[];
  onSelectedRangesChange: (ranges: SelectedRange[]) => void;
  optionalExplanation: string;
  onOptionalExplanationChange: (value: string) => void;
  onSubmit: () => void;
  onInsufficientContext: () => void;
  isSubmitting: boolean;
}

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
}: CodePuzzleViewProps) {
  const { theme } = useTheme();
  const editorTheme = theme === "dark" ? "vs-dark" : "vs-light";

  const handleEditorMount = useCallback(
    (_editor: unknown) => {
      const monacoEditor = _editor as { onDidChangeCursorSelection: (listener: (e: { selection: { startLineNumber: number; endLineNumber: number } }) => void) => { dispose: () => void } };
      if (!monacoEditor?.onDidChangeCursorSelection) return;
      monacoEditor.onDidChangeCursorSelection((e: { selection: { startLineNumber: number; endLineNumber: number } }) => {
        const { startLineNumber, endLineNumber } = e.selection;
        if (startLineNumber === endLineNumber && startLineNumber === 1) {
          const model = (monacoEditor as { getModel?: () => { getLineCount: () => number } }).getModel?.();
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
      });
    },
    [onCurrentSelectionChange]
  );

  const addSelectionToAnswer = useCallback(() => {
    if (!currentSelection) return;
    onSelectedRangesChange([...selectedRanges, currentSelection]);
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
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
      <motion.div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100/80 dark:border-zinc-700/80 dark:bg-zinc-900/50 lg:mr-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div className="relative flex-1 min-h-[400px]">
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

      <motion.div
        className="flex min-h-0 flex-col gap-4 overflow-y-auto lg:ml-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.05 }}
      >
        <Attribution puzzle={puzzle} className="rounded-xl border-zinc-200 bg-zinc-50/80 dark:border-zinc-700/80 dark:bg-zinc-800/40" />
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
                    {r.startLine === r.endLine ? `Line ${r.startLine}` : `Lines ${r.startLine}–${r.endLine}`}
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
          <label htmlFor="explanation" className="mb-1.5 block text-sm font-medium text-zinc-600 dark:text-zinc-400">
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
      </motion.div>
    </div>
  );
}
