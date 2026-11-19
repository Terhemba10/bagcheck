import "server-only";
import { geminiProvider } from "./gemini";
import type { LlmProvider } from "./types";

/**
 * Swappable LLM adapter. The app only ever asks for JSON that matches a zod
 * schema; the provider is an implementation detail (Gemini today).
 *
 * Code decides, AI explains: the LLM never produces scores or numbers that
 * are shown as facts. Its outputs are checked in code (see lib/promises).
 */
export { LlmError, type JsonRequest, type LlmProvider } from "./types";

export function llm(): LlmProvider {
  return geminiProvider;
}
