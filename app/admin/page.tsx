"use client";

import { useState, useEffect, useCallback } from "react";

interface ReportedPuzzle {
  puzzleId: string;
  reportCount: number;
  reasons: string;
  latestReport: number;
  puzzle: {
    id: number;
    puzzleId: string;
    question: string;
    language: string | null;
    category: string | null;
  } | null;
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onLogin();
      } else {
        setError("Invalid password");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Admin Login</h1>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}

function AdminDashboard() {
  const [puzzles, setPuzzles] = useState<ReportedPuzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReported = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/puzzles");
      if (res.status === 401) {
        setError("Session expired. Please reload.");
        return;
      }
      const data = await res.json();
      setPuzzles(data);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReported();
  }, [fetchReported]);

  const handleDelete = async (puzzleId: string) => {
    if (!confirm(`Delete puzzle "${puzzleId}" and all its reports?`)) return;
    setActionLoading(puzzleId);
    try {
      await fetch(`/api/admin/puzzles/${encodeURIComponent(puzzleId)}`, { method: "DELETE" });
      setPuzzles((prev) => prev.filter((p) => p.puzzleId !== puzzleId));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (puzzleId: string) => {
    setActionLoading(puzzleId);
    try {
      await fetch(`/api/admin/puzzles/${encodeURIComponent(puzzleId)}/dismiss`, { method: "POST" });
      setPuzzles((prev) => prev.filter((p) => p.puzzleId !== puzzleId));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <p className="p-8 text-zinc-500">Loading reported puzzles…</p>;
  }

  if (error) {
    return <p className="p-8 text-red-500">{error}</p>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Reported Puzzles
            <span className="ml-2 text-base font-normal text-zinc-500">({puzzles.length})</span>
          </h1>
          <button
            type="button"
            onClick={fetchReported}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Refresh
          </button>
        </div>

        {puzzles.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-zinc-500">No reported puzzles. All clear!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {puzzles.map((item) => (
              <div
                key={item.puzzleId}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {item.puzzle?.question ?? item.puzzleId}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      {item.puzzle?.language && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium dark:bg-zinc-800">
                          {item.puzzle.language}
                        </span>
                      )}
                      {item.puzzle?.category && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                          {item.puzzle.category}
                        </span>
                      )}
                      <span className="text-zinc-400">ID: {item.puzzleId.slice(0, 16)}…</span>
                    </div>
                  </div>
                  <span className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    {item.reportCount} report{item.reportCount !== 1 ? "s" : ""}
                  </span>
                </div>

                <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                  Reasons: {item.reasons}
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDismiss(item.puzzleId)}
                    disabled={actionLoading === item.puzzleId}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Dismiss reports
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.puzzleId)}
                    disabled={actionLoading === item.puzzleId}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    Delete puzzle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/admin/puzzles")
      .then((res) => {
        if (res.ok) setAuthenticated(true);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginForm onLogin={() => setAuthenticated(true)} />;
  }

  return <AdminDashboard />;
}
