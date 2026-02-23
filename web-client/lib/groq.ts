import "server-only";
import Groq from "groq-sdk";

const defaultGroq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL_GENERATION = "openai/gpt-oss-120b";
const MODEL_GRADING = "openai/gpt-oss-20b";

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
  const client = options?.apiKey ? new Groq({ apiKey: options.apiKey }) : defaultGroq;
  return client.chat.completions.create({
    messages,
    model: options?.model ?? MODEL_GENERATION,
  });
}

export async function getGroqChatCompletionForGrading(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
) {
  return defaultGroq.chat.completions.create({
    messages,
    model: MODEL_GRADING,
  });
}
