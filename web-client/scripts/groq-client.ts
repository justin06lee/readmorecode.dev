/**
 * Groq API for CLI scripts only. No "server-only" so seed can run under Bun.
 */

import Groq from "groq-sdk";

export const SEED_MODELS = [
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "groq/compound",
  "moonshotai/kimi-k2-instruct-0905",
] as const;

export async function getGroqChatCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: { model?: string; apiKey?: string }
) {
  const client = options?.apiKey
    ? new Groq({ apiKey: options.apiKey })
    : new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client.chat.completions.create({
    messages,
    model: options?.model ?? SEED_MODELS[0],
  });
}
