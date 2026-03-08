import "server-only";
import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { createSession, deleteSessionByTokenHash, getUserBySessionTokenHash } from "@/lib/db/users";
import type { AuthUser } from "@/lib/types";

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE_NAME = "readmorecode_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function normalizePassword(password: string): string {
  return password.normalize("NFKC");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(normalizePassword(password), salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(normalizePassword(password), salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(expiresAt),
  };
}

export async function createUserSession(userId: number): Promise<string> {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await createSession({ userId, tokenHash, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));
  return token;
}

export async function clearUserSession(token?: string | null): Promise<void> {
  if (token) {
    await deleteSessionByTokenHash(hashSessionToken(token));
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return getUserBySessionTokenHash(hashSessionToken(token));
}

export async function requireCurrentUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
