/**
 * Shrinks a JSON response for display on /evidence: arrays keep their first
 * few items, long strings are cut, deep objects are summarised. Also strips
 * anything that looks like a key, as a belt-and-braces measure.
 */
export interface TrimOptions {
  maxArray?: number;
  maxString?: number;
  maxDepth?: number;
  maxKeys?: number;
}

// Exact key names only: a loose /token/ match would hide useful public fields like `token_address`.
const SECRET_KEY_RE = /^(x-cmc_pro_api_key|api[_-]?key|access[_-]?token|token|secret|authorization|password)$/i;

export function trimJson(value: unknown, opts: TrimOptions = {}, depth = 0): unknown {
  const { maxArray = 3, maxString = 160, maxDepth = 6, maxKeys = 40 } = opts;

  if (value === null || typeof value !== "object") {
    if (typeof value === "string" && value.length > maxString)
      return `${value.slice(0, maxString)}… (${value.length} chars)`;
    return value;
  }
  if (depth >= maxDepth) return Array.isArray(value) ? `[${value.length} items]` : "{…}";

  if (Array.isArray(value)) {
    const head = value.slice(0, maxArray).map((v) => trimJson(v, opts, depth + 1));
    if (value.length > maxArray) head.push(`… ${value.length - maxArray} more items`);
    return head;
  }

  const out: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [k, v] of entries.slice(0, maxKeys)) {
    out[k] = SECRET_KEY_RE.test(k) ? "[redacted]" : trimJson(v, opts, depth + 1);
  }
  if (entries.length > maxKeys) out["…"] = `${entries.length - maxKeys} more keys`;
  return out;
}

/** Remove the API key from any string (URLs, error messages). */
export function redactKey(text: string, key = process.env.CMC_API_KEY): string {
  if (!key) return text;
  return text.split(key).join("[CMC_API_KEY]");
}
