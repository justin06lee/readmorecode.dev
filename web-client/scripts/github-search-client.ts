/**
 * GitHub Search API for CLI scripts only. No "server-only" so seed can run under Bun.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const githubToken = process.env.GITHUB_TOKEN;

/** Filesystem-safe slug for language (e.g. "C#" -> "C_"). */
function languageSlug(language: string): string {
  return language.replace(/[^a-zA-Z0-9-]/g, "_");
}

const SEED_DATA_DIR = join(process.cwd(), "scripts", "seed-data");

export interface PersistedRepos {
  language: string;
  repos: RepoSearchItem[];
  lastFetchedPage: number;
}

function getReposFilePath(language: string): string {
  return join(SEED_DATA_DIR, `repos-${languageSlug(language)}.json`);
}

export async function loadPersistedRepos(language: string): Promise<PersistedRepos | null> {
  const filePath = getReposFilePath(language);
  try {
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as PersistedRepos;
    if (!Array.isArray(data.repos) || typeof data.lastFetchedPage !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

export async function savePersistedRepos(data: PersistedRepos): Promise<void> {
  await mkdir(SEED_DATA_DIR, { recursive: true });
  const filePath = getReposFilePath(data.language);
  await writeFile(filePath, JSON.stringify(data, null, 0), "utf-8");
}

function ghHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
  return headers;
}

export interface RepoSearchItem {
  full_name: string;
  default_branch: string;
  owner: { login: string };
  name: string;
}

export async function searchRepositories(params: {
  language: string;
  page?: number;
  sort?: "updated" | "stars" | "forks";
  perPage?: number;
}): Promise<RepoSearchItem[]> {
  const { language, page = 1, sort = "updated", perPage = 100 } = params;
  const q = `language:${encodeURIComponent(language)} fork:false archived:false`;
  const url = `https://api.github.com/search/repositories?q=${q}&sort=${sort}&order=desc&per_page=${perPage}&page=${page}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: ghHeaders(),
  });
  if (res.status === 403 || res.status === 429) {
    throw new Error(`GITHUB_RATE_LIMIT:${res.status}`);
  }
  if (!res.ok) {
    throw new Error(`GitHub search failed: ${res.status}`);
  }
  const data = (await res.json()) as { items?: RepoSearchItem[] };
  return data.items ?? [];
}

export async function getRandomRepoForLanguage(
  language: string,
  rng: () => number
): Promise<RepoSearchItem | null> {
  const page = Math.min(10, Math.max(1, Math.floor(rng() * 10) + 1));
  const sort = rng() < 0.5 ? "updated" : "stars";
  const items = await searchRepositories({ language, page, sort, perPage: 100 });
  if (items.length === 0) return null;
  return items[Math.floor(rng() * items.length)]!;
}

/** GitHub Search returns at most 1000 results total; pages 1–10 give 100 each. Fetches all and dedupes by full_name. */
export async function fetchUpTo1000ReposForLanguage(
  language: string,
  onLog?: (msg: string) => void
): Promise<RepoSearchItem[]> {
  const seen = new Set<string>();
  const repos: RepoSearchItem[] = [];
  const sort = "updated";
  for (let page = 1; page <= 10; page++) {
    onLog?.(`  GitHub Search: GET /search/repositories?q=language:${language}&page=${page}&per_page=100&sort=${sort}`);
    const items = await searchRepositories({ language, page, sort, perPage: 100 });
    for (const item of items) {
      if (seen.has(item.full_name)) continue;
      seen.add(item.full_name);
      repos.push(item);
    }
    onLog?.(`  Page ${page}: got ${items.length} repos (total unique so far: ${repos.length})`);
    if (items.length < 100) break;
  }
  return repos;
}

/**
 * Fetch up to 1000 repos with persistent progress in scripts/seed-data/repos-{language}.json.
 * Loads existing data if present and resumes from lastFetchedPage+1. Saves after each page so
 * rate-limit or process restart does not lose progress. On GitHub rate limit throws so caller can sleep and retry.
 */
export async function fetchReposWithPersistence(
  language: string,
  onLog?: (msg: string) => void
): Promise<RepoSearchItem[]> {
  const sort = "updated";
  const seen = new Set<string>();
  let repos: RepoSearchItem[] = [];
  let lastFetchedPage = 0;

  const existing = await loadPersistedRepos(language);
  if (existing && existing.language === language) {
    repos = existing.repos;
    lastFetchedPage = existing.lastFetchedPage;
    for (const r of repos) seen.add(r.full_name);
    onLog?.(`  Loaded ${repos.length} repos from file (lastFetchedPage=${lastFetchedPage}). Resuming from page ${lastFetchedPage + 1}.`);
  } else {
    onLog?.(`  No existing data for ${language}. Starting from page 1.`);
  }

  for (let page = lastFetchedPage + 1; page <= 10; page++) {
    onLog?.(`  GitHub Search: GET /search/repositories?q=language:${language}&page=${page}&per_page=100&sort=${sort}`);
    const items = await searchRepositories({ language, page, sort, perPage: 100 });
    for (const item of items) {
      if (seen.has(item.full_name)) continue;
      seen.add(item.full_name);
      repos.push(item);
    }
    lastFetchedPage = page;
    await savePersistedRepos({ language, repos, lastFetchedPage });
    onLog?.(`  Page ${page}: got ${items.length} repos (total unique: ${repos.length}). Saved to file.`);
    if (items.length < 100) break;
  }

  return repos;
}
