import type { z } from "zod";

/** Shared LLM types (kept separate so providers don't import the adapter). */
export interface JsonRequest<S extends z.ZodTypeAny> {
  /** Short system instruction (role + hard rules). */
  system: string;
  /** The user prompt (task + data). */
  prompt: string;
  /** zod schema the reply must satisfy. */
  schema: S;
  /** JSON schema sent to the provider for constrained output (subset of OpenAPI). */
  jsonSchema: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LlmProvider {
  name: string;
  configured(): boolean;
  json<S extends z.ZodTypeAny>(req: JsonRequest<S>): Promise<z.infer<S>>;
}

export class LlmError extends Error {
  constructor(
    public readonly kind: "not_configured" | "rate_limited" | "bad_output" | "upstream" | "blocked",
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
  get userMessage(): string {
    switch (this.kind) {
      case "not_configured":
        return "The AI reader isn't set up on this server.";
      case "rate_limited":
        return "The AI reader is busy. Please try again in a minute.";
      case "blocked":
        return "The AI reader declined to read this page.";
      default:
        return "The AI reader couldn't process this page right now.";
    }
  }
}
