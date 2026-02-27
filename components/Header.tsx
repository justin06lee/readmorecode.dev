"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeProvider";

export function Header() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
      <Link
        href="/"
        className="text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
      >
        readmorecode.dev
      </Link>
      <ThemeToggle />
    </header>
  );
}
