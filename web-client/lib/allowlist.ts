/**
 * Server-only: allowlist of repos for puzzle generation.
 * Only MIT/Apache/BSD-style licensed repos should be used.
 */

export const MAX_FILE_BYTES = 50 * 1024; // 50KB

/** Extensions to exclude (binary, minified, etc.) */
const BLOCKED_EXTENSIONS = new Set([
  ".min.js",
  ".min.css",
  ".min.mjs",
  ".bundle.js",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
]);

/** Extensions we consider source files for puzzles */
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".css",
  ".scss",
  ".html",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".sh",
  ".bash",
]);

export interface AllowlistRepo {
  owner: string;
  name: string;
  branch: string;
}

export const ALLOWLIST: AllowlistRepo[] = [
  { owner: "vercel", name: "next.js", branch: "canary" },
  { owner: "facebook", name: "react", branch: "main" },
  { owner: "vuejs", name: "core", branch: "main" },
  { owner: "sveltejs", name: "svelte", branch: "main" },
  { owner: "remix-run", name: "remix", branch: "main" },
  { owner: "denoland", name: "deno", branch: "main" },
  { owner: "nodejs", name: "node", branch: "main" },
  { owner: "microsoft", name: "TypeScript", branch: "main" },
  { owner: "lodash", name: "lodash", branch: "main" },
  { owner: "chalk", name: "chalk", branch: "main" },
];

export function isSourceFile(path: string): boolean {
  const lower = path.toLowerCase();
  for (const ext of SOURCE_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

export function isBlockedFile(path: string): boolean {
  const lower = path.toLowerCase();
  for (const ext of BLOCKED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  if (/\.min\./i.test(lower)) return true;
  return false;
}

export function isAllowedSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_FILE_BYTES;
}

export function getAllowlist(): AllowlistRepo[] {
  return [...ALLOWLIST];
}

export function getLanguageFromPath(path: string): string {
  const ext = path.replace(/^.*\./, "").toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    css: "css",
    scss: "scss",
    html: "html",
    md: "markdown",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    bash: "shell",
  };
  return map[ext] ?? "plaintext";
}
