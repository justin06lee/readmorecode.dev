"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { useAuth } from "@/components/AuthProvider";
import { ProfileHeatmap } from "@/components/ProfileHeatmap";
import { UserAvatar } from "@/components/UserAvatar";
import { mergeUserWithStoredAvatar, setStoredAvatar } from "@/lib/avatar-storage";
import type { ProfileData } from "@/lib/types";

export default function ProfilePage() {
  const { user, loading: authLoading, openAuthModal, setUser } = useAuth();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load profile.");
        return;
      }
      const nextProfile = data as ProfileData;
      const mergedUser = mergeUserWithStoredAvatar(nextProfile.user);
      setProfile({
        ...nextProfile,
        user: mergedUser ?? nextProfile.user,
      });
    } catch {
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const billingSuccess = searchParams.get("success") === "true";
  const billingCanceled = searchParams.get("canceled") === "true";

  const handleAvatarFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profile) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > 700_000) {
      setError("Profile image must be under 700 KB.");
      return;
    }

    const reader = new FileReader();
    setUploadingAvatar(true);
    setError(null);

    reader.onload = async () => {
      try {
        const avatarDataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!avatarDataUrl.startsWith("data:image/")) {
          setError("Choose a valid image file.");
          return;
        }
        setStoredAvatar(profile.user.id, avatarDataUrl);
        const nextUser = {
          ...profile.user,
          avatarUrl: avatarDataUrl,
        };
        setProfile((prev) => (prev ? { ...prev, user: nextUser } : prev));
        setUser(nextUser);
      } catch {
        setError("Failed to update profile image.");
      } finally {
        setUploadingAvatar(false);
      }
    };

    reader.onerror = () => {
      setUploadingAvatar(false);
      setError("Failed to read image.");
    };

    reader.readAsDataURL(file);
  }, [profile, setUser]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <p className="text-zinc-500 dark:text-zinc-400">Loading profile…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white/80 p-8 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900/70">
          <h1
            className="text-4xl text-zinc-900 dark:text-zinc-100"
            style={{ fontFamily: "var(--font-instrument-serif), serif" }}
          >
            Sign up to keep your streak alive.
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Your profile tracks history, streaks, and contribution heat across every puzzle you solve.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => openAuthModal("signup")}
              className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              Create account
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

  if (!profile) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <p className="text-red-500">{error ?? "Profile not found."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-zinc-50 px-4 py-10 dark:bg-zinc-950 sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="group relative rounded-full focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-60"
                >
                  <UserAvatar username={profile.user.username} avatarUrl={profile.user.avatarUrl} size={68} />
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-[10px] font-medium text-white transition-colors group-hover:bg-black/45">
                    {uploadingAvatar ? "Saving" : "Upload"}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarFile}
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Tap avatar to upload</p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Profile</p>
                <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
                  {profile.user.username}
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{profile.user.email}</p>
              </div>
            </div>
            <Link
              href="/puzzle"
              className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
            >
              Back to puzzles
            </Link>
          </div>
        </motion.div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {billingSuccess && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
            Stripe checkout completed. Your subscription status will refresh as soon as the webhook lands.
          </div>
        )}

        {billingCanceled && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            Checkout canceled. You can subscribe again anytime.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total attempts", value: profile.stats.totalAttempts },
            { label: "Correct", value: profile.stats.correctAttempts },
            { label: "Current streak", value: `${profile.stats.currentStreak} day${profile.stats.currentStreak === 1 ? "" : "s"}` },
            { label: "Longest streak", value: `${profile.stats.longestStreak} day${profile.stats.longestStreak === 1 ? "" : "s"}` },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-zinc-200 bg-white/80 p-5 dark:border-zinc-700 dark:bg-zinc-900/70"
            >
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.label}</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Plan</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {profile.user.isPaid
                  ? `Paid subscription (${profile.user.subscriptionStatus ?? "active"})`
                  : "Free plan: 5 puzzles per day"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {profile.user.isPaid ? (
                <form action="/api/billing/portal" method="POST">
                  <button
                    type="submit"
                    className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
                  >
                    Manage billing
                  </button>
                </form>
              ) : (
                <form action="/api/billing/checkout" method="POST">
                  <button
                    type="submit"
                    className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
                  >
                    Upgrade for $0.49/month
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Contribution heatmap</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Activity over the last 26 weeks.
              </p>
            </div>
          </div>
          <ProfileHeatmap data={profile.heatmap} />
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Recent history</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your latest puzzle attempts.
            </p>
          </div>
          {profile.history.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No attempts yet. Solve a puzzle to start your streak.</p>
          ) : (
            <div className="space-y-3">
              {profile.history.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${attempt.correct ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}
                    >
                      {attempt.correct ? "Correct" : "Incorrect"}
                    </span>
                    {attempt.language && (
                      <span className="rounded-lg bg-zinc-200 px-2.5 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {attempt.language}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(attempt.attemptedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">{attempt.question}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
