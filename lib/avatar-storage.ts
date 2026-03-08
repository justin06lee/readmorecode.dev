import type { AuthUser } from "@/lib/types";

function avatarStorageKey(userId: number): string {
  return `readmorecode-avatar:${userId}`;
}

export function getStoredAvatar(userId: number): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(avatarStorageKey(userId));
}

export function setStoredAvatar(userId: number, dataUrl: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(avatarStorageKey(userId), dataUrl);
}

export function mergeUserWithStoredAvatar(user: AuthUser | null): AuthUser | null {
  if (!user) return null;
  const storedAvatar = getStoredAvatar(user.id);
  return {
    ...user,
    avatarUrl: storedAvatar ?? null,
  };
}
