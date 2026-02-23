/**
 * GitHub file/tree fetch for CLI scripts only. No "server-only" so seed can run under Bun.
 */

import {
  MAX_FILE_BYTES,
  isSourceFile,
  isBlockedFile,
  isAllowedSize,
  getLanguageFromPath,
} from "../lib/allowlist";
import { sanitizeContent } from "../lib/sanitize";
import type { FileInfo } from "../lib/types";

const CACHE_TTL_MS = 60 * 60 * 1000;
const fileCache = new Map<string, { content: string; sizeBytes: number; timestamp: number }>();

const githubToken = process.env.GITHUB_TOKEN;

function ghHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(extra as Record<string, string>),
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  return headers;
}

function cacheKey(owner: string, repo: string, path: string, ref: string): string {
  return `${owner}:${repo}:${path}:${ref}`;
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<FileInfo | null> {
  const key = cacheKey(owner, repo, path, ref);
  const cached = fileCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      path,
      content: cached.content,
      language: getLanguageFromPath(path),
      sizeBytes: cached.sizeBytes,
    };
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: ghHeaders({ Accept: "application/vnd.github.raw" }),
  });
  if (!res.ok) return null;

  const raw = await res.text();
  if (raw.length > MAX_FILE_BYTES) return null;
  const sanitized = sanitizeContent(raw);

  fileCache.set(key, {
    content: sanitized,
    sizeBytes: Buffer.byteLength(sanitized, "utf8"),
    timestamp: Date.now(),
  });

  return {
    path,
    content: sanitized,
    language: getLanguageFromPath(path),
    sizeBytes: Buffer.byteLength(sanitized, "utf8"),
  };
}

export interface TreeFile {
  path: string;
  type: string;
  size?: number;
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  ref: string
): Promise<TreeFile[] | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
  const res = await fetch(url, { cache: "no-store", headers: ghHeaders() });
  if (!res.ok) return null;

  const data = (await res.json()) as { tree?: { path: string; type: string; size?: number }[] };
  const tree = data.tree ?? [];
  return tree
    .filter((f) => f.type === "blob")
    .filter((f) => isSourceFile(f.path) && !isBlockedFile(f.path))
    .filter((f) => (f.size == null ? true : isAllowedSize(f.size)))
    .map((f) => ({ path: f.path, type: f.type, size: f.size }));
}

export async function getCommitSha(
  owner: string,
  repo: string,
  ref: string
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (!res.ok) return ref;
  const data = (await res.json()) as { sha?: string };
  return data.sha ?? ref;
}
