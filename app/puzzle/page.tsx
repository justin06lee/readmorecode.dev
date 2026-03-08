"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useAuth } from "@/components/AuthProvider";
import { CATEGORIES, LANGUAGES_BY_CATEGORY } from "@/lib/categories";
import type { AccessState, Puzzle, PuzzleCategory, GradeResult as GradeResultType, SelectedRange } from "@/lib/types";

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

const GUEST_BATCH_SIZE = 3;
const MEMBER_BATCH_SIZE = 5;

type CachedPuzzle = Puzzle & {
  reportCount?: number;
};

function getTargetBatchSize(access: AccessState | null) {
  if (!access || access.blocked) {
    return 0;
  }
  if (access.tier === "paid") {
    return MEMBER_BATCH_SIZE;
  }
  const cap = access.tier === "guest" ? GUEST_BATCH_SIZE : MEMBER_BATCH_SIZE;
  return Math.max(0, Math.min(cap, access.remainingToday ?? 0));
}

export default function PuzzlePage() {
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const [activeBatch, setActiveBatch] = useState<CachedPuzzle[]>([]);
  const [nextBatch, setNextBatch] = useState<CachedPuzzle[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [isPrefetchingNext, setIsPrefetchingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [currentSelection, setCurrentSelection] = useState<SelectedRange | null>(null);
  const [selectedRanges, setSelectedRanges] = useState<SelectedRange[]>([]);
  const [optionalExplanation, setOptionalExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResultType | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const [filterCategory, setFilterCategory] = useState<PuzzleCategory | "">(() => {
    if (typeof window === "undefined") return "";
    return (localStorage.getItem("puzzle_filter_category") as PuzzleCategory | "") || "";
  });
  const [filterLanguage, setFilterLanguage] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("puzzle_filter_language") || "";
  });
  const [appliedCategory, setAppliedCategory] = useState<PuzzleCategory | "">(filterCategory);
  const [appliedLanguage, setAppliedLanguage] = useState(filterLanguage);
  const initialFiltersRef = useRef<{ category: PuzzleCategory | ""; language: string }>({
    category: appliedCategory,
    language: appliedLanguage,
  });
  const queueVersionRef = useRef(0);
  const lastPrefetchBatchKeyRef = useRef<string | null>(null);

  const availableLanguages = filterCategory
    ? LANGUAGES_BY_CATEGORY[filterCategory] ?? []
    : Object.values(LANGUAGES_BY_CATEGORY).flat();

  const puzzle = activeBatch[activeIndex] ?? null;
  const reportCount = puzzle?.reportCount ?? 0;
  const accessBlocked = access?.blocked ?? false;
  const canUseFilters = !!user;
  const activeBatchKey = activeBatch.map((item) => item.puzzleId).join("|");
  const targetBatchSize = getTargetBatchSize(access);
  const requestedCategory = canUseFilters ? appliedCategory : "";
  const requestedLanguage = canUseFilters ? appliedLanguage : "";

  const resetAnswerState = useCallback(() => {
    setError(null);
    setGradeResult(null);
    setCurrentSelection(null);
    setSelectedRanges([]);
    setOptionalExplanation("");
  }, []);

  const fetchPuzzleData = useCallback(async (category?: string, language?: string): Promise<CachedPuzzle> => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (language) params.set("language", language);
    const qs = params.toString();
    const res = await fetch(`/api/puzzle${qs ? `?${qs}` : ""}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Failed to load puzzle");
    }
    return data as CachedPuzzle;
  }, []);

  const loadAccess = useCallback(async () => {
    setAccessLoading(true);
    try {
      const res = await fetch("/api/access", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setAccess(data as AccessState);
      }
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const fetchPuzzleBatch = useCallback(
    async (
      targetSize: number,
      category?: string,
      language?: string,
      excludeIds?: Set<string>
    ): Promise<CachedPuzzle[]> => {
      if (targetSize <= 0) {
        return [];
      }
      const puzzles = new Map<string, CachedPuzzle>();
      const blockedIds = new Set(excludeIds);
      let lastError: string | null = null;
      let attempts = 0;
      const maxAttempts = Math.max(targetSize * 4, targetSize);

      while (puzzles.size < targetSize && attempts < maxAttempts) {
        const remaining = targetSize - puzzles.size;
        const requestCount = Math.min(targetSize, remaining);
        const results = await Promise.allSettled(
          Array.from({ length: requestCount }, () => fetchPuzzleData(category, language))
        );
        attempts += requestCount;

        for (const result of results) {
          if (result.status === "fulfilled") {
            const candidate = result.value;
            if (blockedIds.has(candidate.puzzleId) || puzzles.has(candidate.puzzleId)) {
              continue;
            }
            puzzles.set(candidate.puzzleId, candidate);
            continue;
          }

          const reason = result.reason;
          lastError = reason instanceof Error ? reason.message : "Failed to load puzzle";
        }
      }

      if (puzzles.size === 0 && lastError) {
        throw new Error(lastError);
      }

      return Array.from(puzzles.values());
    },
    [fetchPuzzleData]
  );

  const initializeQueue = useCallback(
    async (category?: string, language?: string, targetSize = targetBatchSize) => {
      const version = ++queueVersionRef.current;
      setLoading(true);
      setIsPrefetchingNext(false);
      lastPrefetchBatchKeyRef.current = null;
      setActiveBatch([]);
      setNextBatch([]);
      setActiveIndex(0);
      resetAnswerState();

      try {
        const batch = await fetchPuzzleBatch(targetSize, category, language);
        if (queueVersionRef.current !== version) return;
        if (batch.length === 0) {
          setError("Failed to load puzzle");
          return;
        }
        setActiveBatch(batch);
      } catch (err) {
        if (queueVersionRef.current !== version) return;
        setError(err instanceof Error ? err.message : "Failed to load puzzle");
      } finally {
        if (queueVersionRef.current === version) {
          setLoading(false);
        }
      }
    },
    [fetchPuzzleBatch, resetAnswerState, targetBatchSize]
  );

  const prefetchNextBatch = useCallback(async () => {
    if (access?.tier !== "paid") return;
    if (isPrefetchingNext || nextBatch.length > 0 || activeBatch.length === 0) return;

    const version = queueVersionRef.current;
    setIsPrefetchingNext(true);

    try {
      const excludedIds = new Set(activeBatch.map((item) => item.puzzleId));
      const batch = await fetchPuzzleBatch(
        MEMBER_BATCH_SIZE,
        appliedCategory || undefined,
        appliedLanguage || undefined,
        excludedIds
      );
      if (queueVersionRef.current !== version) return;
      if (batch.length > 0) {
        setNextBatch(batch);
      }
    } finally {
      if (queueVersionRef.current === version) {
        setIsPrefetchingNext(false);
      }
    }
  }, [
    activeBatch,
    access?.tier,
    appliedCategory,
    appliedLanguage,
    fetchPuzzleBatch,
    isPrefetchingNext,
    nextBatch.length,
  ]);

  useEffect(() => {
    if (authLoading) return;
    void loadAccess();
  }, [authLoading, loadAccess, user]);

  useEffect(() => {
    if (authLoading || accessLoading || !access || accessBlocked) {
      if (accessBlocked && activeBatch.length === 0) {
        setLoading(false);
      }
      return;
    }
    if (queueVersionRef.current > 0) return;
    const { category, language } = initialFiltersRef.current;
    void initializeQueue(
      canUseFilters ? category || undefined : undefined,
      canUseFilters ? language || undefined : undefined
    );
  }, [access, accessBlocked, accessLoading, activeBatch.length, authLoading, canUseFilters, initializeQueue]);

  useEffect(() => {
    if (access?.tier !== "paid") return;
    if (activeBatch.length !== MEMBER_BATCH_SIZE) return;
    if (activeIndex !== activeBatch.length - 1) return;
    if (!activeBatchKey) return;
    if (lastPrefetchBatchKeyRef.current === activeBatchKey) return;
    if (nextBatch.length > 0 || isPrefetchingNext) return;
    lastPrefetchBatchKeyRef.current = activeBatchKey;
    void prefetchNextBatch();
  }, [access?.tier, activeBatch.length, activeBatchKey, activeIndex, isPrefetchingNext, nextBatch.length, prefetchNextBatch]);

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

  const loadNextPuzzle = useCallback(async () => {
    if (access?.blocked) {
      if (access.reason === "signup") {
        openAuthModal("signup");
      }
      return;
    }

    resetAnswerState();

    const nextIndex = activeIndex + 1;
    if (nextIndex < activeBatch.length) {
      setActiveIndex(nextIndex);
      return;
    }

    if (nextBatch.length > 0) {
      setActiveBatch(nextBatch);
      setNextBatch([]);
      setActiveIndex(0);
      return;
    }

    await initializeQueue(appliedCategory || undefined, appliedLanguage || undefined);
  }, [
    activeBatch.length,
    activeIndex,
    access,
    initializeQueue,
    nextBatch,
    appliedCategory,
    appliedLanguage,
    openAuthModal,
    resetAnswerState,
  ]);

  const applyFilters = useCallback(() => {
    if (!canUseFilters) {
      openAuthModal("signup");
      return;
    }
    setAppliedCategory(filterCategory);
    setAppliedLanguage(filterLanguage);
    void initializeQueue(filterCategory || undefined, filterLanguage || undefined);
  }, [canUseFilters, filterCategory, filterLanguage, initializeQueue, openAuthModal]);

  const clearFilters = useCallback(() => {
    setFilterCategory("");
    setFilterLanguage("");
    setAppliedCategory("");
    setAppliedLanguage("");
    localStorage.setItem("puzzle_filter_category", "");
    localStorage.setItem("puzzle_filter_language", "");
    if (canUseFilters) {
      void initializeQueue(undefined, undefined);
    }
  }, [canUseFilters, initializeQueue]);

  const handleReportSubmitted = useCallback(() => {
    if (!puzzle) return;
    setActiveBatch((prev) =>
      prev.map((item) =>
        item.puzzleId === puzzle.puzzleId
          ? { ...item, reportCount: (item.reportCount ?? 0) + 1 }
          : item
      )
    );
  }, [puzzle]);

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
        if (data.access) {
          setAccess(data.access as AccessState);
        }
        return;
      }
      const result = data as GradeResultType;
      setGradeResult(result);
      if ((data as { access?: AccessState }).access) {
        const nextAccess = (data as { access: AccessState }).access;
        setAccess(nextAccess);
        if (nextAccess.blocked && nextAccess.reason === "signup") {
          openAuthModal("signup");
        }
      }
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
        if (data.access) {
          setAccess(data.access as AccessState);
        }
        return;
      }
      const result = data as GradeResultType;
      setGradeResult(result);
      if ((data as { access?: AccessState }).access) {
        const nextAccess = (data as { access: AccessState }).access;
        setAccess(nextAccess);
        if (nextAccess.blocked && nextAccess.reason === "signup") {
          openAuthModal("signup");
        }
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  if ((authLoading || accessLoading || loading) && !puzzle && !accessBlocked) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 px-4">
        <p className="text-zinc-600 dark:text-zinc-400">Loading puzzle…</p>
      </div>
    );
  }

  if (accessBlocked && !puzzle && access?.reason === "signup") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white/85 p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <h1
            className="text-4xl text-zinc-900 dark:text-zinc-100"
            style={{ fontFamily: "var(--font-instrument-serif), serif" }}
          >
            Free run complete.
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            You’ve finished your 3 guest puzzles. Create an account to unlock unlimited puzzles, saved history, streaks, and your profile heatmap.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => openAuthModal("signup")}
              className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              Sign up to continue
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (accessBlocked && !puzzle && access?.reason === "subscription") {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white/85 p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <h1
            className="text-4xl text-zinc-900 dark:text-zinc-100"
            style={{ fontFamily: "var(--font-instrument-serif), serif" }}
          >
            Daily free limit reached.
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Free accounts can solve 5 puzzles per day. Upgrade for $0.49/month to keep going without the daily cap.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <form action="/api/billing/checkout" method="POST">
              <button
                type="submit"
                className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
              >
                Upgrade for $0.49/month
              </button>
            </form>
            <Link
              href="/profile"
              className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
            >
              View profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error && !puzzle) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => void initializeQueue(requestedCategory || undefined, requestedLanguage || undefined)}
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
            {access && access.dailyLimit != null && (
              <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {access.usedToday}/{access.dailyLimit} today
              </span>
            )}
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
          onSubmitted={handleReportSubmitted}
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
        {accessBlocked && gradeResult && access?.reason === "signup" && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
          >
            Guest access ends here. Sign up to keep solving and save your progress.
          </motion.p>
        )}
        {accessBlocked && gradeResult && access?.reason === "subscription" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-300"
          >
            <p>Free accounts stop at 5 puzzles per day. Upgrade to continue today.</p>
            <form action="/api/billing/checkout" method="POST">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
              >
                Upgrade for $0.49/month
              </button>
            </form>
          </motion.div>
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
            onNextPuzzle={loadNextPuzzle}
            filterCategory={canUseFilters ? filterCategory : ""}
            filterLanguage={canUseFilters ? filterLanguage : ""}
            onFilterCategoryChange={handleCategoryChange}
            onFilterLanguageChange={handleLanguageChange}
            availableLanguages={availableLanguages}
            onApplyFilters={applyFilters}
            onClearFilters={clearFilters}
            categories={CATEGORIES}
            filterLocked={!canUseFilters}
            filterApplyLabel={canUseFilters ? "Apply" : "Sign up to use filters"}
          />
        </motion.div>
      </div>
    </div>
  );
}
