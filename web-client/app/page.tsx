"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useTheme } from "@/components/ThemeProvider";

const NAVBAR_H = "3.5rem";

export default function Home() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50 dark:bg-zinc-950">
      <main
        className="relative flex flex-col items-center justify-center px-6 py-16"
        style={{ minHeight: `calc(100vh - ${NAVBAR_H})` }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(120,120,120,0.08),transparent)] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(120,120,120,0.12),transparent)]" />
        <div className="relative flex w-full max-w-2xl flex-col items-center gap-10 text-center">
          <motion.h1
            className={`text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl [background-clip:text] [-webkit-background-clip:text] [color:transparent]
              ${theme === "light" ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 via-amber-400 to-emerald-500" : "bg-[linear-gradient(180deg,#e4e4e7_0%,#a1a1aa_50%,#71717a_100%)]"}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            Reading code is the new skill.
          </motion.h1>
          <motion.p
            className="max-w-lg text-lg text-zinc-600 sm:text-xl dark:text-zinc-400"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            Practice with code comprehension puzzles. Find the exact lines, trace
            the flow.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          >
            <Link href="/puzzle">
              <motion.span
                className="inline-flex min-h-[52px] items-center rounded-xl bg-zinc-900 px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                Start a puzzle
              </motion.span>
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
