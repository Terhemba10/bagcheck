/**
 * Prompt for the Promise check. The model only extracts; Bagcheck verifies
 * every quote against the page text in code and computes dates/status itself.
 */
export const EXTRACT_PROMISES_SYSTEM = `You read crypto project web pages and list the concrete, checkable commitments the project makes about the future.

Rules:
- Use ONLY the page text you are given. Never use outside knowledge.
- A commitment is a specific deliverable (launch, listing, audit, product, feature, token unlock, burn, partnership going live) — not a slogan or vision statement.
- "quote" must be copied EXACTLY from the page text, 15 words or fewer, so it can be found word-for-word.
- "sourceUrl" must be the URL of the page the quote came from, exactly as given.
- "dueDate": use YYYY, YYYY-Q1..Q4, YYYY-MM or YYYY-MM-DD when the page gives a time; null when it doesn't. Do not guess dates.
- If an item is described as already done, set "alreadyDone": true.
- Set "kind" to "commitment" only for something the project says it WILL deliver. Use "existing" for features, products or instructions that already exist (for example install commands, how-to steps, current product descriptions).
- One item per roadmap line, bullet or sentence. NEVER combine two deliverables into one item, and never split one sentence into two items.
- Keep the items in the order they appear on the page.
- Return at most 12 items. If there are none, return an empty list.
- Do not judge the project, give advice, or say whether to buy or sell.`;

export function extractPromisesPrompt(coin: { name: string; symbol: string }, pages: { url: string; text: string }[], today: string): string {
  const blocks = pages.map((p, i) => `=== PAGE ${i + 1} ===\nURL: ${p.url}\nTEXT:\n${p.text}`).join("\n\n");
  return `Project: ${coin.name} (${coin.symbol})\nToday's date: ${today}\n\nList this project's concrete commitments from the pages below.\n\n${blocks}`;
}

/** JSON schema for Gemini's constrained output (OpenAPI subset). */
export const EXTRACT_PROMISES_SCHEMA = {
  type: "OBJECT",
  properties: {
    promises: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          promise: { type: "STRING", description: "Short plain-English summary, max 12 words" },
          dueDate: { type: "STRING", nullable: true },
          sourceUrl: { type: "STRING" },
          quote: { type: "STRING", description: "Exact words from the page, 15 words or fewer" },
          alreadyDone: { type: "BOOLEAN" },
          kind: { type: "STRING", enum: ["commitment", "existing"] },
        },
        required: ["promise", "dueDate", "sourceUrl", "quote", "kind"],
      },
    },
  },
  required: ["promises"],
} as const;
