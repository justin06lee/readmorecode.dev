/**
 * Server-only: strip secrets-like patterns from file content before use.
 */

const SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key
  /\bghp_[a-zA-Z0-9]{36}\b/g, // GitHub personal access token
  /\bgho_[a-zA-Z0-9]{36}\b/g,
  /\bgithub_pat_[a-zA-Z0-9_]{22,}\b/g,
  /\bsk-[a-zA-Z0-9]{20,}\b/g, // OpenAI-style secret key
  /\bgsk_[a-zA-Z0-9]{20,}\b/g, // Groq-style
  /["']?[0-9a-fA-F]{32}["']?/g, // generic 32-char hex (weakened: only if looks like key)
];

const REDACT = "[REDACTED]";

/**
 * Sanitize file content by replacing secrets-like substrings.
 * Call this on any file content before sending to LLM or caching.
 */
export function sanitizeContent(content: string): string {
  let out = content;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, REDACT);
  }
  return out;
}

/** Remove <think>...</think> blocks so they are not sent to the LLM or counted as attempts. */
export function stripThinkTags(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}
