import "server-only";
import Groq from "groq-sdk";

const MODEL_GENERATION = "openai/gpt-oss-120b";

const GRADING_MODELS = [
  "openai/gpt-oss-20b",
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
  if (apiKeys.length === 0) {
    throw new Error("No GROQ_API_KEY configured");
  }
  const maxAttempts = apiKeys.length * GRADING_MODELS.length;

  // Snapshot the rotation indices into locals so concurrent requests don't
  // clobber each other mid-loop; persist the advance back once at the end.
  let keyIndex = gradingKeyIndex;
  let modelIndex = gradingModelIndex;
  let lastErr: unknown;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const apiKey = apiKeys[keyIndex % apiKeys.length]!;
      const model = GRADING_MODELS[modelIndex % GRADING_MODELS.length]!;
      const client = new Groq({ apiKey });

      try {
        return await client.chat.completions.create({
          messages,
          model,
          temperature: 0.3,
          response_format: { type: "json_object" as const },
        });
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        // Retry on rate-limit and transient server/timeout errors.
        if (/429|rate limit|50[0-9]|timeout|ETIMEDOUT|ECONNRESET/i.test(msg)) {
          modelIndex++;
          if (modelIndex % GRADING_MODELS.length === 0) {
            keyIndex++;
          }
          continue;
        }
        throw err;
      }
    }
  } finally {
    gradingKeyIndex = keyIndex;
    gradingModelIndex = modelIndex;
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("All grading API keys and models exhausted");
}
