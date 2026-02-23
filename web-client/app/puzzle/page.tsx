"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
import { CodePuzzleView } from "@/components/CodePuzzleView";
import { GradeResult } from "@/components/GradeResult";
import { ReportModal } from "@/components/ReportModal";
import type { Puzzle, GradeResult as GradeResultType, SelectedRange } from "@/lib/types";

export default function PuzzlePage() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSelection, setCurrentSelection] = useState<SelectedRange | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<SelectedRange[]>([]);
  const [optionalExplanation, setOptionalExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResultType | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const fetchPuzzle = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGradeResult(null);
    setCurrentSelection(null);
    setSelectedRanges([]);
    setOptionalExplanation("");
    try {
      const res = await fetch("/api/puzzle");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load puzzle");
        setPuzzle(null);
        return;
      }
      const data = (await res.json()) as Puzzle;
      setPuzzle(data);
    } catch {
      setError("Failed to load puzzle");
      setPuzzle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and when "Next puzzle" is clicked
  const loadPuzzle = useCallback(() => {
    setGradeResult(null);
    fetchPuzzle();
  }, [fetchPuzzle]);

  useEffect(() => {
    if (puzzle === null && error === null) {
      fetchPuzzle();
    }
  }, []);

  const handleSubmit = async () => {
    if (!puzzle) return;
    if (selectedRanges.length === 0 && optionalExplanation.trim() === "") return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.puzzleId,
          selectedRanges,
          optionalExplanation: optionalExplanation.trim() || null,
          insufficientContext: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Grading failed");
        return;
      }
      setGradeResult(data as GradeResultType);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInsufficientContext = async () => {
    if (!puzzle) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId: puzzle.puzzleId,
          selectedRange: null,
          optionalExplanation: null,
          insufficientContext: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Grading failed");
        return;
      }
      setGradeResult(data as GradeResultType);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !puzzle) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 px-4">
        <p className="text-zinc-600 dark:text-zinc-400">Loading puzzle…</p>
      </div>
    );
  }

  if (error && !puzzle) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={fetchPuzzle}
          className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          Try again
        </button>
        <Link href="/" className="text-sm text-zinc-600 underline dark:text-zinc-400">
          Home
        </Link>
      </div>
    );
  }

  if (gradeResult) {
    return (
      <div className="min-h-screen px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <AnimatePresence mode="wait">
            <GradeResult key="result" result={gradeResult} onNext={loadPuzzle} />
          </AnimatePresence>
        </div>
      </div>
    );
  }

  if (!puzzle) {
    return null;
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            aria-label="Home"
          >
            <HomeIcon />
            Home
          </Link>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Report problem
          </button>
        </div>
        <ReportModal
          puzzleId={puzzle.puzzleId}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          onSubmitted={() => {}}
        />
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300"
          >
            {error}
          </motion.p>
        )}
        <motion.div
          className="flex min-h-0 flex-1 flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <CodePuzzleView
            puzzle={puzzle}
            currentSelection={currentSelection}
            onCurrentSelectionChange={setCurrentSelection}
            selectedRanges={selectedRanges}
            onSelectedRangesChange={setSelectedRanges}
            optionalExplanation={optionalExplanation}
            onOptionalExplanationChange={setOptionalExplanation}
            onSubmit={handleSubmit}
            onInsufficientContext={handleInsufficientContext}
            isSubmitting={isSubmitting}
          />
        </motion.div>
      </div>
    </div>
  );
}
