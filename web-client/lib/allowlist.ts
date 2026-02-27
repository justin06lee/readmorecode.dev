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

/** Extensions we consider source files for puzzles — must stay in sync with EXTENSIONS_BY_LANGUAGE in categories.ts */
const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx",
  ".js", ".jsx", ".mjs", ".cjs",
  ".vue",
  ".svelte",
  ".html", ".htm",
  ".css",
  ".scss", ".sass",
  ".c", ".h",
  ".cpp", ".hpp", ".cc", ".cxx",
  ".rs",
  ".go",
  ".zig",
  ".nim",
  ".swift",
  ".kt", ".kts",
  ".dart",
  ".yaml", ".yml",
  ".json",
  ".toml",
  ".ini", ".cfg",
  ".py",
  ".rb",
  ".java",
  ".cs",
  ".php",
  ".hs",
  ".ml", ".mli",
  ".ex", ".exs",
  ".clj", ".cljs",
  ".scala", ".sc",
  ".sh", ".bash",
  ".md",
  ".sql",
  ".r",
  ".jl",
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
    vue: "vue",
    svelte: "svelte",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "scss",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    rs: "rust",
    go: "go",
    zig: "zig",
    nim: "nim",
    swift: "swift",
    kt: "kotlin",
    kts: "kotlin",
    dart: "dart",
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    toml: "toml",
    ini: "ini",
    cfg: "ini",
    py: "python",
    rb: "ruby",
    java: "java",
    cs: "csharp",
    php: "php",
    hs: "haskell",
    ml: "ocaml",
    mli: "ocaml",
    ex: "elixir",
    exs: "elixir",
    clj: "clojure",
    cljs: "clojure",
    scala: "scala",
    sc: "scala",
    sh: "shell",
    bash: "shell",
    md: "markdown",
    sql: "sql",
    r: "r",
    jl: "julia",
  };
  return map[ext] ?? "plaintext";
}
