import "server-only";

const githubToken = process.env.GITHUB_TOKEN;

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

/**
 * Search GitHub for public repos by language. Returns up to 100 items per page.
 * Search API is capped at 1000 total results; use page/sort to vary.
 */
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

/**
 * Get a random repo for the given language by querying a random page (1–10).
 */
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
