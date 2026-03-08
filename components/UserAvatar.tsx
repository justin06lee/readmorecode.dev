"use client";

import { useMemo } from "react";

interface UserAvatarProps {
  username: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

function initialsForName(username: string): string {
  return username
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

export function UserAvatar({
  username,
  avatarUrl,
  size = 36,
  className = "",
}: UserAvatarProps) {
  const initials = useMemo(() => initialsForName(username), [username]);

  if (avatarUrl) {
    return (
      <div
        role="img"
        aria-label={`${username} avatar`}
        className={`rounded-full bg-zinc-200 bg-cover bg-center ring-1 ring-black/10 dark:bg-zinc-800 dark:ring-white/10 ${className}`}
        style={{
          width: size,
          height: size,
          backgroundImage: `url("${avatarUrl}")`,
        }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900 ${className}`}
      style={{ width: size, height: size }}
      aria-label={`${username} avatar`}
    >
      {initials}
    </div>
  );
}
