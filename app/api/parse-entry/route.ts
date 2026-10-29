import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/parse-entry
// Body: { text: string, lang?: string }
// Parses a spoken expense phrase (Roman Urdu / Urdu) into a structured diary
// entry using Meta's muse-spark-open via Baseten (OpenAI-compatible).
//
// Honesty rule: if the model is not confident (confidence < 0.6) or no amount
// was spoken, we return { needs_clarification: true } and ask "kitne diye?"
// instead of guessing. We NEVER invent an amount.
// ---------------------------------------------------------------------------

const BASETEN_URL = "https://inference.baseten.co/v1/chat/completions";
const MODEL = "meta-models/muse-spark-open";

const CATEGORIES = [
  "sabzi",
  "doodh",
  "kiraya",
  "copy-kitaab",
  "dawai",
  "bills",
  "kapde",
  "other",
] as const;

type Category = (typeof CATEGORIES)[number];

const SYSTEM_PROMPT = `You are a precise expense parser for a Pakistani cash household.
The user speaks an expense aloud in Roman Urdu or Urdu (sometimes mixed with English numbers).

Extract exactly:
- amount: number, in rupees. If NO amount was spoken, use 0.
- currency: "PKR" (default).
- category: exactly one of: sabzi, doodh, kiraya, copy-kitaab, dawai, bills, kapde, other.
  Guide: sabzi = groceries/vegetables/fruit/food/rashan; doodh = milk/dairy; kiraya = transport/fares/fuel; copy-kitaab = school/books/fees/stationery; dawai = medicine/doctor/health; bills = utility bills/mobile recharge; kapde = clothes; other = anything else.
- item: short item name in Roman Urdu (e.g. "sabzi", "doodh", "bus kiraya").
- note: any extra detail, or empty string.
- confidence: 0 to 1 — how sure you are about BOTH amount and category. Be strict: if the amount is unclear or missing, confidence must be below 0.6.

Call the return_result function exactly once with your best extraction.
NEVER invent an amount that was not spoken.`;

interface ParsedEntry {
  amount: number;
  currency: string;
  category: Category;
  item: string;
  note: string;
  confidence: number;
}

interface BasetenToolCall {
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface BasetenMessage {
  // Baseten may return reasoning_content on the message; we deliberately
  // ignore it and only read the tool call arguments (reasoning stripped).
  tool_calls?: BasetenToolCall[];
}

interface BasetenResponse {
  choices?: Array<{ message?: BasetenMessage }>;
  error?: { message?: string };
}

function buildBody(text: string, lang: string, includeReasoningEffort: boolean) {
  const body: Record<string, unknown> = {
    model: MODEL,
    temperature: 0.2,
    max_tokens: 1500,
    tool_choice: "required",
    tools: [
      {
        type: "function",
        function: {
          name: "return_result",
          description:
            "Return the parsed expense entry. Call exactly once per request.",
          parameters: {
            type: "object",
            properties: {
              amount: {
                type: "number",
                description:
                  "Amount in rupees. Use 0 if no amount was spoken.",
              },
              currency: {
                type: "string",
                description: "Currency code, e.g. PKR",
              },
              category: {
                type: "string",
                enum: [...CATEGORIES],
                description: "Exactly one of the 8 fixed categories",
              },
              item: {
                type: "string",
                description: "Short item name in Roman Urdu",
              },
              note: {
                type: "string",
                description: "Extra detail, or empty string",
              },
              confidence: {
                type: "number",
                description:
                  "0 to 1 — confidence in amount AND category. Below 0.6 when unsure.",
              },
            },
            required: ["amount", "category", "item", "confidence"],
          },
        },
      },
    ],
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Language hint: ${lang}\nExpense said aloud: "${text}"`,
      },
    ],
  };
  if (includeReasoningEffort) {
    body["reasoning_effort"] = "low";
  }
  return body;
}

async function callBaseten(
  apiKey: string,
  text: string,
  lang: string,
  includeReasoningEffort: boolean
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    return await fetch(BASETEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildBody(text, lang, includeReasoningEffort)),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractEntry(data: BasetenResponse): ParsedEntry | null {
  const toolCalls = data?.choices?.[0]?.message?.tool_calls;
  if (!toolCalls || toolCalls.length === 0) return null;
  const rawArgs = toolCalls[0]?.function?.arguments;
  if (!rawArgs || typeof rawArgs !== "string") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;

  const amount = typeof p["amount"] === "number" ? p["amount"] : NaN;
  const category = p["category"];
  const item = typeof p["item"] === "string" ? p["item"].trim() : "";
  const note = typeof p["note"] === "string" ? p["note"].trim() : "";
  const currency =
    typeof p["currency"] === "string" && p["currency"].trim() !== ""
      ? p["currency"].trim()
      : "PKR";
  const confidence =
    typeof p["confidence"] === "number" ? p["confidence"] : 0;

  if (!Number.isFinite(amount)) return null;
  if (typeof category !== "string") return null;
  if (!(CATEGORIES as readonly string[]).includes(category)) return null;
  if (item === "") return null;

  return {
    amount,
    currency,
    category: category as Category,
    item,
    note,
    confidence: Math.min(1, Math.max(0, confidence)),
  };
}

async function tryParse(
  apiKey: string,
  text: string,
  lang: string
): Promise<{ entry: ParsedEntry | null; error?: string }> {
  // Attempt 1: with reasoning_effort (fast + cheap per spec).
  let res: Response;
  try {
    res = await callBaseten(apiKey, text, lang, true);
  } catch (e) {
    return {
      entry: null,
      error: e instanceof Error && e.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
    };
  }

  // If the endpoint rejects the reasoning_effort param, retry once without it.
  if (res.status === 400) {
    let msg = "";
    try {
      const errBody = (await res.json()) as BasetenResponse;
      msg = errBody?.error?.message ?? "";
    } catch {
      msg = "";
    }
    if (/reasoning/i.test(msg)) {
      try {
        res = await callBaseten(apiKey, text, lang, false);
      } catch (e) {
        return {
          entry: null,
          error:
            e instanceof Error && e.name === "AbortError"
              ? "TIMEOUT"
              : "NETWORK_ERROR",
        };
      }
    } else {
      return { entry: null, error: `UPSTREAM_400: ${msg}`.slice(0, 200) };
    }
  }

  if (!res.ok) {
    return { entry: null, error: `UPSTREAM_${res.status}` };
  }

  let data: BasetenResponse;
  try {
    data = (await res.json()) as BasetenResponse;
  } catch {
    return { entry: null, error: "BAD_UPSTREAM_JSON" };
  }

  const entry = extractEntry(data);
  if (entry) return { entry };

  // ONE retry on parse failure (spec rule), without reasoning_effort to vary it.
  try {
    res = await callBaseten(apiKey, text, lang, false);
  } catch (e) {
    return {
      entry: null,
      error: e instanceof Error && e.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
    };
  }
  if (!res.ok) return { entry: null, error: `UPSTREAM_${res.status}` };
  try {
    data = (await res.json()) as BasetenResponse;
  } catch {
    return { entry: null, error: "BAD_UPSTREAM_JSON" };
  }
  const retryEntry = extractEntry(data);
  if (retryEntry) return { entry: retryEntry };
  return { entry: null, error: "PARSE_FAILED" };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_JSON_BODY" },
      { status: 400 }
    );
  }

  const text =
    typeof (body as Record<string, unknown>)?.["text"] === "string"
      ? ((body as Record<string, unknown>)["text"] as string).trim()
      : "";
  const lang =
    typeof (body as Record<string, unknown>)?.["lang"] === "string"
      ? ((body as Record<string, unknown>)["lang"] as string).trim()
      : "ur-PK";

  if (!text) {
    return NextResponse.json(
      { ok: false, error: "EMPTY_TEXT" },
      { status: 400 }
    );
  }

  const apiKey = process.env.BASETEN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "MISSING_API_KEY — add BASETEN_API_KEY in Vercel Environment Variables and redeploy.",
      },
      { status: 500 }
    );
  }

  const { entry, error } = await tryParse(apiKey, text, lang);
  if (!entry) {
    return NextResponse.json(
      { ok: false, error: error ?? "PARSE_FAILED" },
      { status: 502 }
    );
  }

  // Honesty rule: never guess. Low confidence or missing amount -> ask back.
  if (entry.confidence < 0.6 || entry.amount <= 0) {
    return NextResponse.json({
      ok: true,
      needs_clarification: true,
      question: "kitne diye?",
      hint: entry.item || undefined,
    });
  }

  return NextResponse.json({ ok: true, entry });
}
