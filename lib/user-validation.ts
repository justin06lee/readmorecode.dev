import type { PuzzleCategory } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,24}$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string): string {
  return value.trim();
}

export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized) || normalized.length > 120) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validateUsername(username: string): string | null {
  const normalized = normalizeUsername(username);
  if (!USERNAME_RE.test(normalized)) {
    return "Username must be 3-24 characters and use only letters, numbers, underscores, or hyphens.";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8 || password.length > 128) {
    return "Password must be between 8 and 128 characters.";
  }
  return null;
}

export function normalizeCategory(value: unknown): PuzzleCategory | null {
  if (value == null) return null;
  if (value === "web" || value === "systems" || value === "mobile" || value === "data" || value === "other") {
    return value;
  }
  return null;
}
