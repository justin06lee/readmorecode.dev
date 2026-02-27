"use client";

import Link from "next/link";
import Image from "next/image";
import { useTheme } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeProvider";

export function Header() {
  const { theme } = useTheme();

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
      <Link
        href="/"
        className="group flex items-center gap-2 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
      >
        <Image
          src={theme === "dark" ? "/readmorecode-white.png" : "/readmorecode.png"}
          alt="readmorecode.dev logo"
          width={33}
          height={33}
          className="h-7 w-7"
        />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:max-w-[200px] group-hover:opacity-100">
          readmorecode.dev
        </span>
      </Link>
      <ThemeToggle />
    </header>
  );
}
