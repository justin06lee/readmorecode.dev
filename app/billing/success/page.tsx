"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useAuth } from "@/components/AuthProvider";
import { mergeUserWithStoredAvatar } from "@/lib/avatar-storage";
import type { AuthUser } from "@/lib/types";

type SyncState = "syncing" | "ready" | "error";

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#f97316", "#8b5cf6"];

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const [state, setState] = useState<SyncState>("syncing");
  const [error, setError] = useState<string | null>(null);
  const sessionId = searchParams.get("session_id");

  const confetti = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => ({
        id: index,
        left: `${(index * 13) % 100}%`,
        color: COLORS[index % COLORS.length]!,
        delay: index * 0.04,
        duration: 2.2 + (index % 5) * 0.25,
        rotate: (index % 2 === 0 ? 1 : -1) * (160 + index * 9),
      })),
    []
  );

  useEffect(() => {
    if (!sessionId) {
      setState("error");
      setError("Missing checkout session.");
      return;
    }

    let cancelled = false;

    const syncBilling = async () => {
      try {
        const res = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error ?? "Could not confirm subscription.");
        }
        if (!cancelled) {
          setUser(mergeUserWithStoredAvatar(data.user as AuthUser));
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setError(err instanceof Error ? err.message : "Could not confirm subscription.");
        }
      }
    };

    void syncBilling();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setUser]);

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <div className="pointer-events-none absolute inset-0">
        {confetti.map((piece) => (
          <motion.span
            key={piece.id}
            className="absolute top-[-10%] h-4 w-2 rounded-full opacity-90"
            style={{ left: piece.left, backgroundColor: piece.color }}
            initial={{ y: -80, rotate: 0, opacity: 0 }}
            animate={{ y: "120vh", rotate: piece.rotate, opacity: [0, 1, 1, 0] }}
            transition={{
              duration: piece.duration,
              delay: piece.delay,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 w-full max-w-xl rounded-[2rem] border border-zinc-200 bg-white/92 p-8 text-center shadow-xl dark:border-zinc-700 dark:bg-zinc-900/88"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-600 dark:text-emerald-400">
          Subscription unlocked
        </p>
        <h1
          className="mt-4 text-5xl text-zinc-900 dark:text-zinc-100"
          style={{ fontFamily: "var(--font-instrument-serif), serif" }}
        >
          {state === "ready" ? "You’re in." : state === "syncing" ? "Finishing up…" : "Almost there."}
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {state === "ready"
            ? "Your paid plan is active. Daily limits are lifted, and you can go straight back to solving."
            : state === "syncing"
              ? "We’re confirming your checkout session and unlocking unlimited puzzles."
              : error ?? "We couldn’t confirm your subscription yet."}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/puzzle"
            className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            Start solving
          </Link>
          <Link
            href="/profile"
            className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
          >
            Go to profile
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
