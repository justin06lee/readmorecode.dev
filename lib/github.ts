import "server-only";
import {
  MAX_FILE_BYTES,
  isSourceFile,
  isBlockedFile,
  isAllowedSize,
  getLanguageFromPath,
} from "./allowlist";
import { sanitizeContent } from "./sanitize";
import type { FileInfo } from "./types";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  content: string;
  sizeBytes: number;
  timestamp: number;
}

const fileCache = new Map<string, CacheEntry>();

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

/**
 * Fetch raw file content from GitHub. Server-only.
 * Uses allowlist; caches by owner:repo:path:ref with 1h TTL.
 * Sanitizes content and enforces max size.
 */
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

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: ghHeaders({ Accept: "application/vnd.github.raw" }),
    next: { revalidate: 3600 },
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

/**
 * Get repository tree (recursive) from GitHub API. Server-only.
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  ref: string
): Promise<TreeFile[] | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: ghHeaders(),
  });
  if (!res.ok) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[fetchRepoTree]", owner, repo, ref, "→", res.status, res.statusText);
    }
    return null;
  }

  const data = (await res.json()) as { tree?: { path: string; type: string; size?: number }[] };
  const tree = data.tree ?? [];
  return tree
    .filter((f) => f.type === "blob")
    .filter((f) => isSourceFile(f.path) && !isBlockedFile(f.path))
    .filter((f) => (f.size == null ? true : isAllowedSize(f.size)))
    .map((f) => ({ path: f.path, type: f.type, size: f.size }));
}

/**
 * Get latest commit SHA for a ref (branch or tag). Server-only.
 */
export async function getCommitSha(
  owner: string,
  repo: string,
  ref: string
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: ghHeaders(),
    next: { revalidate: 300 },
  });
  if (!res.ok) return ref;
  const data = (await res.json()) as { sha?: string };
  return data.sha ?? ref;
}
