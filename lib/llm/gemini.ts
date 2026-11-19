import "server-only";
import type { z } from "zod";
import { LlmError, type JsonRequest, type LlmProvider } from "./types";

/**
 * Google Gemini via the REST API. The key goes in the x-goog-api-key header
 * (never in the URL, so it can't leak into logs).
 *
 * Model choice (tested 19 Nov 2026 with this key):
 *  - gemini-3.5-flash-lite + minimal thinking: correct structured output in ~1 s
 *  - full Flash models (3.8 / -latest) timed out (>40 s) even at "low" thinking
 *  - gemini-2.5-flash is no longer available to new keys
 * Every AI output is verified in code (quotes must appear word-for-word), so a
 * fast lite model is enough. Override with GEMINI_MODEL.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
export const FALLBACK_MODEL = "gemini-flash-lite-latest";
const TIMEOUT_MS = 30_000;

function primaryModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

async function call(modelName: string, req: JsonRequest<z.ZodTypeAny>, key: string, withThinking: boolean): Promise<Response> {
  return fetch(`${BASE}/${encodeURIComponent(modelName)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.prompt }] }],
      generationConfig: {
        temperature: req.temperature ?? 0.1,
        maxOutputTokens: req.maxOutputTokens ?? 4096,
        responseMimeType: "application/json",
        responseSchema: req.jsonSchema,
        ...(withThinking ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

/** One model, with an automatic retry without thinkingConfig if the model rejects it. */
async function callModel(modelName: string, req: JsonRequest<z.ZodTypeAny>, key: string): Promise<Response | null> {
  let res = await call(modelName, req, key, true).catch(() => null);
  if (res?.status === 400) {
    const text = await res.clone().text().catch(() => "");
    if (/thinking/i.test(text)) res = await call(modelName, req, key, false).catch(() => null);
  }
  return res;
}

export const geminiProvider: LlmProvider = {
  name: "gemini",
  configured: () => Boolean(process.env.GEMINI_API_KEY),

  async json(req) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new LlmError("not_configured", "GEMINI_API_KEY is not set");

    const models = [...new Set([primaryModel(), FALLBACK_MODEL])];
    let lastErr: LlmError = new LlmError("upstream", "Gemini unavailable");

    for (const m of models) {
      const res = await callModel(m, req, key);
      if (!res) {
        lastErr = new LlmError("upstream", `Gemini ${m}: timeout or network error`);
        continue; // try the fallback model
      }
      if (res.status === 429) throw new LlmError("rate_limited", "Gemini rate limit");
      if (res.status === 404 || res.status === 503 || res.status >= 500) {
        lastErr = new LlmError("upstream", `Gemini ${m}: HTTP ${res.status}`);
        continue; // retired or overloaded: try the fallback model
      }
      if (!res.ok) throw new LlmError("upstream", `Gemini ${m}: HTTP ${res.status}`);

      const body = (await res.json().catch(() => null)) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        promptFeedback?: { blockReason?: string };
      } | null;
      if (body?.promptFeedback?.blockReason) throw new LlmError("blocked", `Blocked: ${body.promptFeedback.blockReason}`);
      const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        lastErr = new LlmError("bad_output", `Gemini ${m}: invalid JSON`);
        continue;
      }
      const v = req.schema.safeParse(parsed);
      if (v.success) return v.data;
      lastErr = new LlmError("bad_output", `Gemini ${m}: output failed validation`);
    }
    console.warn("[llm]", lastErr.message);
    throw lastErr;
  },
};
