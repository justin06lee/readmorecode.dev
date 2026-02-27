"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CATEGORIES, LANGUAGES_BY_CATEGORY } from "@/lib/categories";
import type { PuzzleCategory } from "@/lib/types";

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

import { CodePuzzleView } from "@/components/CodePuzzleView";
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
  const [reportCount, setReportCount] = useState(0);

  const [filterCategory, setFilterCategory] = useState<PuzzleCategory | "">(() => {
    if (typeof window === "undefined") return "";
    return (localStorage.getItem("puzzle_filter_category") as PuzzleCategory | "") || "";
  });
  const [filterLanguage, setFilterLanguage] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("puzzle_filter_language") || "";
  });

  const availableLanguages = filterCategory
    ? LANGUAGES_BY_CATEGORY[filterCategory] ?? []
    : Object.values(LANGUAGES_BY_CATEGORY).flat();

  const fetchPuzzle = useCallback(async (category?: string, language?: string) => {
    setLoading(true);
    setError(null);
    setGradeResult(null);
    setCurrentSelection(null);
    setSelectedRanges([]);
    setOptionalExplanation("");
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (language) params.set("language", language);
      const qs = params.toString();
      const res = await fetch(`/api/puzzle${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load puzzle");
        setPuzzle(null);
        return;
      }
      const data = await res.json();
      setReportCount(data.reportCount ?? 0);
      setPuzzle(data as Puzzle);
    } catch {
      setError("Failed to load puzzle");
      setPuzzle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPuzzle = useCallback(() => {
    setGradeResult(null);
    fetchPuzzle(filterCategory || undefined, filterLanguage || undefined);
  }, [fetchPuzzle, filterCategory, filterLanguage]);

  useEffect(() => {
    if (puzzle === null && error === null) {
      fetchPuzzle(filterCategory || undefined, filterLanguage || undefined);
    }
  }, []);

  const handleCategoryChange = (cat: PuzzleCategory | "") => {
    setFilterCategory(cat);
    localStorage.setItem("puzzle_filter_category", cat);
    if (cat && filterLanguage && !(LANGUAGES_BY_CATEGORY[cat] ?? []).includes(filterLanguage)) {
      setFilterLanguage("");
      localStorage.setItem("puzzle_filter_language", "");
    }
  };

  const handleLanguageChange = (lang: string) => {
    setFilterLanguage(lang);
    localStorage.setItem("puzzle_filter_language", lang);
  };

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
          onClick={() => fetchPuzzle()}
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

  if (!puzzle) {
    return null;
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto -mt-40 flex w-full max-w-[1600px] flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            aria-label="Home"
          >
            <HomeIcon />
            Home
          </Link>
          <div className="flex items-center gap-3">
            {reportCount > 0 && (
              <span className="flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" /><path d="M12 17h.01" />
                </svg>
                {reportCount} report{reportCount !== 1 ? "s" : ""}
              </span>
            )}
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Report
            </button>
          </div>
        </div>

        <ReportModal
          puzzleId={puzzle.puzzleId}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          onSubmitted={() => setReportCount((c) => c + 1)}
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
            gradeResult={gradeResult}
            onNextPuzzle={loadPuzzle}
            filterCategory={filterCategory}
            filterLanguage={filterLanguage}
            onFilterCategoryChange={handleCategoryChange}
            onFilterLanguageChange={handleLanguageChange}
            availableLanguages={availableLanguages}
            onApplyFilters={loadPuzzle}
            onClearFilters={() => { setFilterCategory(""); setFilterLanguage(""); localStorage.setItem("puzzle_filter_category", ""); localStorage.setItem("puzzle_filter_language", ""); }}
            categories={CATEGORIES}
          />
        </motion.div>
      </div>
    </div>
  );
}
