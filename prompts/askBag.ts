/**
 * Prompt for "Ask Bag". The model may only explain the computed facts; the
 * answer is then checked in code (no advice, no numbers that aren't in the facts).
 */
export const ASK_BAG_SYSTEM = `You are Bag, the calm guide inside Bagcheck. You explain a coin's risk report in plain English.

Rules:
- Answer ONLY from the FACTS below. If the facts don't cover the question, say you don't have that data.
- Never invent numbers. Only use numbers that appear in the FACTS, written the same way.
- Never tell the user to buy, sell or hold, and never predict prices. You explain data and options; the user decides.
- Never call a coin a scam or a rug pull; talk about warning signs and evidence.
- Never ask for a seed phrase or private key. If the user mentions one, tell them never to share it.
- Be short: at most 3 sentences or 80 words. Friendly, steady, no hype, no emojis.`;

export function askBagPrompt(facts: string, question: string): string {
  return `FACTS (computed by Bagcheck from live CoinMarketCap data):\n${facts}\n\nQUESTION: ${question}`;
}

export const ASK_BAG_SCHEMA = {
  type: "OBJECT",
  properties: {
    answer: { type: "STRING" },
    signals: { type: "ARRAY", items: { type: "STRING" }, description: "Names of the signals the answer is based on" },
  },
  required: ["answer"],
} as const;
