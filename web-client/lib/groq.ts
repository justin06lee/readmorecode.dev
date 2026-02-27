import "server-only";
import Groq from "groq-sdk";

const MODEL_GENERATION = "openai/gpt-oss-120b";

const GRADING_MODELS = [
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "groq/compound",
  "moonshotai/kimi-k2-instruct-0905",
] as const;

export const SEED_MODELS = [
  "openai/gpt-oss-120b",
  "llama-3.3-70b-versatile",
  "groq/compound",
  "moonshotai/kimi-k2-instruct-0905",
] as const;

function getApiKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const key = process.env[i === 1 ? "GROQ_API_KEY" : `GROQ_API_KEY${i}`];
    if (key) keys.push(key);
  }
  return keys;
}

let gradingKeyIndex = 0;
let gradingModelIndex = 0;

export async function getGroqChatCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options?: { model?: string; apiKey?: string; jsonMode?: boolean; temperature?: number }
) {
  const client = options?.apiKey
    ? new Groq({ apiKey: options.apiKey })
    : new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client.chat.completions.create({
    messages,
    model: options?.model ?? MODEL_GENERATION,
    temperature: options?.temperature ?? 0.7,
    ...(options?.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });
}

export async function getGroqChatCompletionForGrading(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
) {
  const apiKeys = getApiKeys();
  const maxAttempts = apiKeys.length * GRADING_MODELS.length;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const apiKey = apiKeys[gradingKeyIndex % apiKeys.length]!;
    const model = GRADING_MODELS[gradingModelIndex % GRADING_MODELS.length]!;
    const client = new Groq({ apiKey });

    try {
      return await client.chat.completions.create({
        messages,
        model,
        temperature: 0.3,
        response_format: { type: "json_object" as const },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/429|rate limit/i.test(msg)) {
        gradingModelIndex++;
        if (gradingModelIndex % GRADING_MODELS.length === 0) {
          gradingKeyIndex++;
        }
        continue;
      }
      throw err;
    }
  }
  throw new Error("All grading API keys and models exhausted (429)");
}
