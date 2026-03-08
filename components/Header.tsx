"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "./AuthProvider";
import { useTheme } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeProvider";
import { UserAvatar } from "./UserAvatar";

export function Header() {
  const { theme, mounted } = useTheme();
  const { user, loading, openAuthModal, logout } = useAuth();
  const resolvedTheme = mounted ? theme : "dark";

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
      <Link
        href="/"
        className="group flex items-center gap-2 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
      >
        <Image
          src={resolvedTheme === "dark" ? "/readmorecode-white.png" : "/readmorecode.png"}
          alt="readmorecode.dev logo"
          width={33}
          height={33}
          className="h-7 w-7"
        />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:max-w-[200px] group-hover:opacity-100">
          readmorecode.dev
        </span>
      </Link>
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        ) : user ? (
          <>
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <UserAvatar username={user.username} avatarUrl={user.avatarUrl} size={32} />
              <span className="hidden text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:inline">
                {user.username}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("signup")}
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Sign up
            </button>
          </>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
