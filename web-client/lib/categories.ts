/**
 * Puzzle categories and language mapping for discovery and filtering.
 */

import type { PuzzleCategory } from "./types";

/** Languages we support for puzzle generation, grouped by category. */
export const LANGUAGES_BY_CATEGORY: Record<PuzzleCategory, string[]> = {
  web: ["TypeScript", "JavaScript", "Vue", "Svelte", "HTML", "CSS", "SCSS"],
  systems: ["C", "C++", "Rust", "Go", "Zig", "Nim"],
  mobile: ["Swift", "Kotlin", "Dart"],
  config: ["YAML", "JSON", "TOML", "INI"],
  data: ["Python", "SQL", "R", "Julia"],
  other: ["Ruby", "Java", "C#", "PHP", "Haskell", "OCaml", "Elixir", "Clojure", "Scala", "Shell"],
};

export const CATEGORIES: PuzzleCategory[] = [
  "web",
  "systems",
  "mobile",
  "config",
  "data",
  "other",
];

/** GitHub Search API language names (may differ from display names). */
export const GITHUB_LANGUAGE_NAMES: Record<string, string> = {
  TypeScript: "TypeScript",
  JavaScript: "JavaScript",
  Vue: "Vue",
  Svelte: "Svelte",
  HTML: "HTML",
  CSS: "CSS",
  SCSS: "SCSS",
  C: "C",
  "C++": "C++",
  Rust: "Rust",
  Go: "Go",
  Zig: "Zig",
  Nim: "Nim",
  Swift: "Swift",
  Kotlin: "Kotlin",
  Dart: "Dart",
  YAML: "YAML",
  JSON: "JSON",
  Python: "Python",
  Ruby: "Ruby",
  Java: "Java",
  "C#": "C%23",
  PHP: "PHP",
  Haskell: "Haskell",
  OCaml: "OCaml",
  Elixir: "Elixir",
  Clojure: "Clojure",
  Scala: "Scala",
  Shell: "Shell",
};

export function getCategoryForLanguage(lang: string): PuzzleCategory {
  for (const [cat, langs] of Object.entries(LANGUAGES_BY_CATEGORY)) {
    if (langs.includes(lang)) return cat as PuzzleCategory;
  }
  return "other";
}

export function getAllLanguages(): string[] {
  const set = new Set<string>();
  for (const langs of Object.values(LANGUAGES_BY_CATEGORY)) {
    for (const l of langs) set.add(l);
  }
  return Array.from(set);
}

/** File extensions that map to this language (for filtering repo tree). */
export const EXTENSIONS_BY_LANGUAGE: Record<string, string[]> = {
  TypeScript: [".ts", ".tsx"],
  JavaScript: [".js", ".jsx", ".mjs", ".cjs"],
  Vue: [".vue"],
  Svelte: [".svelte"],
  HTML: [".html", ".htm"],
  CSS: [".css"],
  SCSS: [".scss", ".sass"],
  C: [".c", ".h"],
  "C++": [".cpp", ".hpp", ".cc", ".cxx"],
  Rust: [".rs"],
  Go: [".go"],
  Zig: [".zig"],
  Nim: [".nim"],
  Swift: [".swift"],
  Kotlin: [".kt", ".kts"],
  Dart: [".dart"],
  YAML: [".yaml", ".yml"],
  JSON: [".json"],
  TOML: [".toml"],
  INI: [".ini", ".cfg"],
  Python: [".py"],
  Ruby: [".rb"],
  Java: [".java"],
  "C#": [".cs"],
  PHP: [".php"],
  Haskell: [".hs"],
  OCaml: [".ml", ".mli"],
  Elixir: [".ex", ".exs"],
  Clojure: [".clj", ".cljs"],
  Scala: [".scala", ".sc"],
  Shell: [".sh", ".bash"],
};

export function isPathForLanguage(path: string, language: string): boolean {
  const ext = path.toLowerCase().replace(/^.*\./, ".");
  const exts = EXTENSIONS_BY_LANGUAGE[language];
  if (!exts) return true;
  return exts.some((e) => path.toLowerCase().endsWith(e));
}

/** Reverse map: file extension (lowercase, with dot) -> canonical language name. */
const EXT_TO_LANGUAGE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [lang, exts] of Object.entries(EXTENSIONS_BY_LANGUAGE)) {
    for (const e of exts) {
      const key = e.toLowerCase();
      if (!m[key]) m[key] = lang;
    }
  }
  return m;
})();

/**
 * Derive category and canonical language from a file path (extension).
 * Used by the filter script to backfill category/language columns.
 */
export function getCategoryAndLanguageFromPath(path: string): { category: PuzzleCategory; language: string } {
  const lower = path.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? "." + lower.slice(dot + 1) : "";
  const language = EXT_TO_LANGUAGE[ext] ?? "Other";
  const category = getCategoryForLanguage(language);
  return { category, language };
}
