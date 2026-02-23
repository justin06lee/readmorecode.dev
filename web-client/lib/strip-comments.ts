/**
 * Strip line and block comments from source code for display.
 * Used so the user sees code without comments. DB and grading keep raw content.
 */

const LINE_COMMENT: Record<string, RegExp> = {
  javascript: /\/\/.*$/gm,
  typescript: /\/\/.*$/gm,
  python: /#.*$/gm,
  ruby: /#.*$/gm,
  go: /\/\/.*$/gm,
  rust: /\/\/.*$/gm,
  java: /\/\/.*$/gm,
  kotlin: /\/\/.*$/gm,
  swift: /\/\/.*$/gm,
  c: /\/\/.*$/gm,
  cpp: /\/\/.*$/gm,
  csharp: /\/\/.*$/gm,
  css: /\/\*[\s\S]*?\*\//g,
  scss: /\/\*[\s\S]*?\*\//g,
  shell: /#.*$/gm,
  bash: /#.*$/gm,
  yaml: /#.*$/gm,
  plaintext: /^$/gm,
};

const BLOCK_COMMENT: Record<string, RegExp> = {
  javascript: /\/\*[\s\S]*?\*\//g,
  typescript: /\/\*[\s\S]*?\*\//g,
  python: /'''(?:[\s\S]*?)'''|"""(?:[\s\S]*?)"""/g,
  go: /\/\*[\s\S]*?\*\//g,
  rust: /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
  java: /\/\*[\s\S]*?\*\//g,
  kotlin: /\/\*[\s\S]*?\*\//g,
  swift: /\/\*[\s\S]*?\*\//g,
  c: /\/\*[\s\S]*?\*\//g,
  cpp: /\/\*[\s\S]*?\*\//g,
  csharp: /\/\*[\s\S]*?\*\/|\/\/.*$/gm,
  html: /<!--[\s\S]*?-->/g,
  markdown: /^$/gm,
  json: /^$/gm,
  plaintext: /^$/gm,
};

export function stripComments(content: string, language: string): string {
  const lang = language.toLowerCase();
  let out = content;

  const blockRe = BLOCK_COMMENT[lang] ?? /\/\*[\s\S]*?\*\//g;
  if (blockRe) {
    out = out.replace(blockRe, (match) => {
      const lines = match.split("\n");
      return lines.map(() => "").join("\n");
    });
  }

  const lineRe = LINE_COMMENT[lang];
  if (lineRe) {
    out = out.replace(lineRe, "");
  }

  return out
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
