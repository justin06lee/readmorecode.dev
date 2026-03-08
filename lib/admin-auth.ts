import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  createAdminSession,
  deleteAdminSessionByTokenHash,
  hasValidAdminSession,
} from "@/lib/db/users";

export const ADMIN_SESSION_COOKIE_NAME = "readmorecode_admin_session";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function adminCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(expiresAt),
  };
}

export function hashAdminSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyAdminPassword(password: string, adminPassword: string): boolean {
  const provided = Buffer.from(password, "utf8");
  const expected = Buffer.from(adminPassword, "utf8");
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}

export async function createAdminUserSession(): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashAdminSessionToken(token);
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  await createAdminSession({ tokenHash, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, adminCookieOptions(expiresAt));
}

export async function clearAdminUserSession(token?: string | null): Promise<void> {
  if (token) {
    await deleteAdminSessionByTokenHash(hashAdminSessionToken(token));
  }
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE_NAME);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }
  return hasValidAdminSession(hashAdminSessionToken(token));
}
