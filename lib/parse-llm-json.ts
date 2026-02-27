/**
 * Robust extraction of a single JSON object from LLM output.
 * Handles <think> tags, leading/trailing text, markdown code fences, trailing commas,
 * and unescaped newlines inside double-quoted strings.
 */

import { stripThinkTags } from "./sanitize";

/**
 * Escape unescaped newlines and carriage returns inside double-quoted strings
 * so JSON.parse can succeed. Leaves content outside strings unchanged.
 */
function escapeNewlinesInJsonStrings(jsonStr: string): string {
  let result = "";
  let i = 0;
  let inString = false;
  let escapeNext = false;
  while (i < jsonStr.length) {
    const c = jsonStr[i];
    if (escapeNext) {
      result += c;
      escapeNext = false;
      i++;
      continue;
    }
    if (c === "\\" && inString) {
      escapeNext = true;
      result += c;
      i++;
      continue;
    }
    if (c === '"' && !inString) {
      inString = true;
      result += c;
      i++;
      continue;
    }
    if (c === '"' && inString) {
      inString = false;
      result += c;
      i++;
      continue;
    }
    if (inString && (c === "\n" || c === "\r")) {
      result += "\\n";
      if (c === "\r" && jsonStr[i + 1] === "\n") i++;
      i++;
      continue;
    }
    result += c;
    i++;
  }
  return result;
}

/**
 * Extract a JSON object from raw LLM output.
 * - Strips think-tag blocks.
 * - Finds first { and matching closing }, parses that substring.
 * - Removes trailing commas before } or ].
 * - Escapes unescaped newlines inside double-quoted strings.
 */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = stripThinkTags(raw).trim();

  const first = cleaned.indexOf("{");
  if (first === -1) return null;

  let depth = 0;
  let end = -1;
  let inString = false;
  let escapeNext = false;
  let quoteChar = '"';
  for (let i = first; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (c === "\\") {
        escapeNext = true;
        continue;
      }
      if (c === quoteChar) {
        inString = false;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quoteChar = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;

  let jsonStr = cleaned.slice(first, end + 1);
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");
  jsonStr = escapeNewlinesInJsonStrings(jsonStr);

  try {
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Get value from parsed object supporting both snake_case and camelCase keys. */
export function getKey(obj: Record<string, unknown>, snake: string, camel: string): unknown {
  return obj[snake] ?? obj[camel];
}
