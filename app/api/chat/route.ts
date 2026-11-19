import { NextResponse } from "next/server";
import { z } from "zod";
import { buildFacts, checkAnswer, fallbackAnswer } from "@/lib/chat/facts";
import { buildReport } from "@/lib/core/report";
import { errorResponse } from "@/lib/http";
import { llm, LlmError } from "@/lib/llm";
import { promisesKey, type PromiseCheck } from "@/lib/promises/check";
import { LIMITS, rateLimit } from "@/lib/ratelimit";
import { detectSecret } from "@/lib/safety/secrets";
import { kv } from "@/lib/store/kv";
import { ASK_BAG_SCHEMA, ASK_BAG_SYSTEM, askBagPrompt } from "@/prompts/askBag";

export const maxDuration = 30;

const Body = z.object({
  coinId: z.number().int().positive().max(10_000_000),
  question: z.string().trim().min(2).max(400),
});

const AiAnswer = z.object({ answer: z.string().min(1).max(1200), signals: z.array(z.string()).optional() });

/**
 * "Ask Bag about this coin". Answers only from the computed report (+ cached
 * promise check). The question is never logged or stored.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { kind: "bad_request", message: "Please type a question (up to 400 characters)." } }, { status: 400 });
  const { coinId, question } = parsed.data;

  // Never accept secrets, even if the browser check was bypassed.
  const secret = detectSecret(question);
  if (secret) return NextResponse.json({ error: { kind: "secret_blocked", message: secret.message } }, { status: 400 });

  const limited = await rateLimit(req, LIMITS.chat);
  if (limited) return limited;

  try {
    const report = await buildReport(coinId); // cached for 5 min
    const promises = await kv().get<PromiseCheck>(promisesKey(coinId)).catch(() => null);
    const facts = buildFacts(report, promises);

    let answer: string | null = null;
    let source: "ai" | "report" = "report";
    if (llm().configured()) {
      for (let attempt = 0; attempt < 2 && !answer; attempt++) {
        try {
          const out = await llm().json({
            system: ASK_BAG_SYSTEM,
            prompt: askBagPrompt(facts, question) + (attempt ? "\n\nReminder: use only numbers that appear in FACTS, and give no advice." : ""),
            schema: AiAnswer,
            jsonSchema: ASK_BAG_SCHEMA as unknown as Record<string, unknown>,
            temperature: 0.2,
            maxOutputTokens: 400,
          });
          const check = checkAnswer(out.answer, facts);
          if (check.ok) {
            answer = out.answer.trim();
            source = "ai";
          }
        } catch (e) {
          if (!(e instanceof LlmError) || e.kind === "rate_limited") break;
        }
      }
    }
    if (!answer) answer = fallbackAnswer(question, report, promises);

    return NextResponse.json({ answer, source, coin: report.coin.name }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
