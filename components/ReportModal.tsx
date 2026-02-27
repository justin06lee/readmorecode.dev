"use client";

import { useState } from "react";

const REASONS = [
  { value: "invalid", label: "Invalid problem" },
  { value: "wrong", label: "Wrong or misleading" },
  { value: "error", label: "Error / bug" },
] as const;

interface ReportModalProps {
  puzzleId: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export function ReportModal({ puzzleId, open, onClose, onSubmitted }: ReportModalProps) {
  const [reason, setReason] = useState<string>("invalid");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          puzzleId,
          reason,
          optionalDetail: detail.trim() || undefined,
          clientReportedAt: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        setDone(true);
        onSubmitted();
        setTimeout(() => {
          onClose();
          setDone(false);
          setDetail("");
        }, 1500);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      onClick={onClose}
      aria-modal="true"
      aria-labelledby="report-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-title" className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Report problem
        </h2>
        {done ? (
          <p className="text-zinc-600 dark:text-zinc-400">Thanks for your report.</p>
        ) : (
          <>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Details (optional)
            </label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Any additional context…"
              className="mb-4 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-900 placeholder-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {submitting ? "Sending…" : "Submit report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
