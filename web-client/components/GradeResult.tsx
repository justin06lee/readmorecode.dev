import Link from "next/link";
import { motion } from "motion/react";
import type { GradeResult as GradeResultType } from "@/lib/types";

interface GradeResultProps {
  result: GradeResultType;
  onNext: () => void;
}

export function GradeResult({ result, onNext }: GradeResultProps) {
  return (
    <motion.div
      className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-zinc-50/90 p-6 dark:border-zinc-700/80 dark:bg-zinc-800/40"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex rounded-xl px-3.5 py-1.5 text-sm font-medium ${
            result.correct
              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              : "bg-red-500/20 text-red-700 dark:text-red-300"
          }`}
        >
          {result.correct ? "Correct" : "Incorrect"}
        </span>
      </div>
      <p className="leading-relaxed text-zinc-700 dark:text-zinc-300">{result.explanation}</p>
      {result.whatYouMissed && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-300">What you missed:</span> {result.whatYouMissed}
        </p>
      )}
      {result.expectedRange && !result.correct && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Expected range: lines {result.expectedRange.startLine}–{result.expectedRange.endLine}
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-2">
        <motion.button
          type="button"
          onClick={onNext}
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
    </motion.div>
  );
}
