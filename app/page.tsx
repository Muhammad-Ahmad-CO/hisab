"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Hisab — Day 1 home screen.
// Big mic button (Web Speech, ur-PK with en-US fallback) + text input fallback.
// Today's entries persist in localStorage.
//
// ANTI-VERDICT DESIGN LAW (hard rule): no red numbers, no "overspent"
// language, no grades, no scolding charts — anywhere, ever. The diary only
// records and (from D2) narrates warmly. It never judges.
// ---------------------------------------------------------------------------

type CategoryKey =
  | "sabzi"
  | "doodh"
  | "kiraya"
  | "copy-kitaab"
  | "dawai"
  | "bills"
  | "kapde"
  | "other";

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  sabzi: "Sabzi / Rashan",
  doodh: "Doodh",
  kiraya: "Kiraya / Safar",
  "copy-kitaab": "Copy-Kitaab",
  dawai: "Dawai / Sehat",
  bills: "Bills",
  kapde: "Kapde",
  other: "Other",
};

// Warm earth-tone accents per category — deliberately no red/green anywhere
// (both read as verdicts in a money diary).
const CATEGORY_STYLES: Record<
  CategoryKey,
  { chipBg: string; chipText: string; rail: string }
> = {
  sabzi: { chipBg: "rgba(201,111,74,0.16)", chipText: "#eaa87f", rail: "#c96f4a" },
  doodh: { chipBg: "rgba(217,164,65,0.16)", chipText: "#f0c67c", rail: "#d9a441" },
  kiraya: { chipBg: "rgba(176,114,46,0.18)", chipText: "#dda55e", rail: "#b0722e" },
  "copy-kitaab": { chipBg: "rgba(168,137,58,0.16)", chipText: "#d7bd6b", rail: "#a8893a" },
  dawai: { chipBg: "rgba(183,110,93,0.16)", chipText: "#dd9c8d", rail: "#b76e5d" },
  bills: { chipBg: "rgba(201,168,106,0.16)", chipText: "#e2c48d", rail: "#c9a86a" },
  kapde: { chipBg: "rgba(165,113,63,0.18)", chipText: "#d3a068", rail: "#a5713f" },
  other: { chipBg: "rgba(138,122,99,0.16)", chipText: "#b7a891", rail: "#8a7a63" },
};

interface Entry {
  id: string;
  amount: number;
  currency: string;
  category: CategoryKey;
  item: string;
  note: string;
  createdAt: number;
}

interface ParseOkEntry {
  amount: number;
  currency: string;
  category: string;
  item: string;
  note: string;
  confidence: number;
}

interface ParseResponse {
  ok: boolean;
  entry?: ParseOkEntry;
  needs_clarification?: boolean;
  question?: string;
  error?: string;
}

const STORAGE_KEY = "hisab-entries-v1";

function isCategoryKey(v: string): v is CategoryKey {
  return (Object.keys(CATEGORY_LABELS) as string[]).includes(v);
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadEntries(): Entry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is Entry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as Entry).id === "string" &&
        typeof (e as Entry).amount === "number" &&
        typeof (e as Entry).createdAt === "number"
    );
  } catch {
    return [];
  }
}

function todayEntries(all: Entry[]): Entry[] {
  const key = dayKey(Date.now());
  return all
    .filter((e) => dayKey(e.createdAt) === key)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function todayLabel(): string {
  try {
    return new Date().toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return "";
  }
}

// --- Inline SVG icons (zero emoji, hard rule) ---

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
      <path d="M8.5 21h7" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function LedgerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 4a2 2 0 0 1 2-2h12v17H7a2 2 0 0 0-2 2V4z" />
      <path d="M5 19a2 2 0 0 1 2-2h12" />
      <path d="M9 7h7M9 11h5" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 20l1.2-4.1A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.5L22 20H2L12 3.5z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.6v.4" />
    </svg>
  );
}

export default function HomePage() {
  const [entries, setEntries] = useState<Entry[]>(() => loadEntries());
  const [input, setInput] = useState("");
  const [recogLang, setRecogLang] = useState("ur-PK");
  const [listening, setListening] = useState(false);
  const [sending, setSending] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // storage full / private mode — diary just won't persist; keep going
    }
  }, [entries]);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  async function submitText(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setError(null);
    setQuestion(null);
    try {
      const res = await fetch("/api/parse-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, lang: recogLang }),
      });
      const data = (await res.json()) as ParseResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ? `Masla: ${data.error}` : "Kuch masla hua — dobara bolo.");
        return;
      }
      if (data.needs_clarification) {
        setQuestion(data.question ?? "kitne diye?");
        inputRef.current?.focus();
        return;
      }
      const e = data.entry;
      if (e && isCategoryKey(e.category)) {
        const entry: Entry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          amount: e.amount,
          currency: e.currency || "PKR",
          category: e.category,
          item: e.item,
          note: e.note || "",
          createdAt: Date.now(),
        };
        setEntries((prev) => [entry, ...prev]);
        setInput("");
      } else {
        setError("Samajh nahi aaya — dobara bolo.");
      }
    } catch {
      setError("Internet ka masla lagta hai — dobara try karo.");
    } finally {
      setSending(false);
    }
  }

  function startListening() {
    setError(null);
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    if (!SR) {
      setError("Is phone/browser me voice input nahi chalta — neeche likh kar batao.");
      return;
    }
    try {
      recRef.current?.abort();
    } catch {
      // ignore
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = recogLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setInput(transcript);
      if (transcript.trim()) {
        void submitText(transcript);
      }
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Mic ki ijazat nahi mili — browser settings me mic allow karo, ya likh kar batao.");
      } else if (event.error === "no-speech") {
        setError("Kuch sunai nahi diya — dobara bolo.");
      } else if (event.error !== "aborted") {
        setError("Voice me masla hua — likh kar batao.");
      }
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Mic start nahi hua — likh kar batao.");
      setListening(false);
    }
  }

  function stopListening() {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const todays = todayEntries(entries);
  const total = todays.reduce((sum, e) => sum + e.amount, 0);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10">
      {/* Top bar */}
      <header className="flex items-start justify-between pt-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gold-600/40 bg-espresso-800 shadow-card">
            <LedgerIcon className="h-5 w-5 text-gold-400" />
          </span>
          <span>
            <span className="block font-display text-[22px] leading-none tracking-wide text-gold-300">
              Hisab
            </span>
            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.24em] text-paper-300/50">
              Voice money diary
            </span>
          </span>
        </div>
        <p className="pt-1 text-right text-[11px] leading-snug text-paper-300/50">
          {todayLabel()}
        </p>
      </header>

      {/* Ledger rule */}
      <div className="mt-4 border-t border-gold-600/25" aria-hidden="true" />
      <div className="mt-[3px] border-t border-gold-600/10" aria-hidden="true" />

      {/* Today's total — a ledger page, warm, never a verdict */}
      <section className="mt-5 overflow-hidden rounded-3xl border border-gold-600/25 bg-espresso-800/70 shadow-card shadow-card-inset">
        <div className="border-b border-gold-600/15 px-5 pb-2.5 pt-4">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-paper-300/55">
            Aaj ka hisab
          </p>
        </div>
        <div className="px-5 py-4 text-center">
          <p className="tnum font-display text-[44px] leading-none text-gold-300">
            Rs&nbsp;{total.toLocaleString("en-PK")}
          </p>
          <p className="mt-2.5 text-xs text-paper-300/60">
            {todays.length === 0
              ? "Abhi kuch nahi likha — diary khaali hai"
              : `${todays.length} ${todays.length === 1 ? "entry" : "entries"} likhi gayin`}
          </p>
        </div>
        <div className="border-t border-gold-600/15 px-5 py-1" aria-hidden="true" />
      </section>

      {/* Mic hero */}
      <section className="mt-7 flex flex-col items-center">
        <div className="relative">
          {/* ambient glow */}
          <div
            className="absolute -inset-10 animate-breathe rounded-full bg-gold-500/15 blur-2xl"
            aria-hidden="true"
          />
          {/* expanding pulse rings while listening */}
          {listening && (
            <>
              <span
                className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-gold-400/70"
                aria-hidden="true"
              />
              <span
                className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-gold-400/50"
                style={{ animationDelay: "0.55s" }}
                aria-hidden="true"
              />
            </>
          )}
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            aria-label={listening ? "Sunna band karo" : "Bolo — kharcha sunao"}
            className={`relative flex h-32 w-32 items-center justify-center rounded-full transition-transform duration-150 active:scale-95 ${
              listening
                ? "bg-gradient-to-b from-gold-200 via-gold-400 to-gold-600 text-espresso-950 shadow-glow-gold-lg"
                : "bg-gradient-to-b from-gold-300 via-gold-500 to-gold-700 text-espresso-950 shadow-glow-gold hover:brightness-110"
            }`}
          >
            <MicIcon className="h-14 w-14" />
            {/* machined inner ring */}
            <span
              className="pointer-events-none absolute inset-2 rounded-full border border-white/25"
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute inset-[7px] rounded-full border border-espresso-950/15"
              aria-hidden="true"
            />
          </button>
        </div>
        <p
          className={`mt-3.5 text-sm font-medium ${
            listening ? "text-gold-300" : "text-paper-300/70"
          }`}
          aria-live="polite"
        >
          {listening
            ? "Sun raha hun… bolo"
            : sending
              ? "Likha ja raha hai…"
              : "Mic dabao aur bolo"}
        </p>

        {/* Language segmented control */}
        <div
          className="mt-3 flex items-center gap-1 rounded-full border border-espresso-600 bg-espresso-900/80 p-1"
          role="group"
          aria-label="Bolanay ki zuban"
        >
          <span className="pl-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-paper-300/45">
            Zuban
          </span>
          {(["ur-PK", "en-US"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setRecogLang(l)}
              aria-pressed={recogLang === l}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                recogLang === l
                  ? "bg-gold-500 text-espresso-950 shadow"
                  : "text-paper-300/60 hover:text-paper-100"
              }`}
            >
              {l === "ur-PK" ? "Urdu" : "English"}
            </button>
          ))}
        </div>
      </section>

      {/* Text fallback */}
      <section className="mt-6">
        <div className="flex gap-2 rounded-2xl border border-espresso-600 bg-espresso-800/70 p-2 shadow-card transition-colors focus-within:border-gold-600/60">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitText(input);
            }}
            placeholder='Masalan: "sabzi ke 200 diye"'
            aria-label="Kharcha likho"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[15px] text-paper-50 placeholder:text-paper-300/35 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void submitText(input)}
            disabled={sending || !input.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-bold text-espresso-950 transition hover:brightness-110 active:scale-95 disabled:opacity-40"
          >
            {sending ? (
              "…"
            ) : (
              <>
                <PlusIcon className="h-4 w-4" />
                Likho
              </>
            )}
          </button>
        </div>
      </section>

      {/* Clarification ask-back (honesty, not a guess) */}
      {question && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-gold-600/40 bg-gold-500/10 px-4 py-3 shadow-card">
          <ChatIcon className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" />
          <p className="text-sm text-paper-100">
            <span className="font-semibold text-gold-300">{question}</span>
            <span className="text-paper-300/80"> — raqam dobara bolo ya likho.</span>
          </p>
        </div>
      )}

      {/* Error — warm, never alarming red */}
      {error && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-espresso-600 bg-espresso-800/80 px-4 py-3 shadow-card">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-gold-400" />
          <p className="text-sm text-paper-100">{error}</p>
        </div>
      )}

      {/* Entries — the diary */}
      <section className="mt-7">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-paper-300/55">
            Aaj ki diary
          </h2>
          {todays.length > 0 && (
            <span className="text-[11px] text-paper-300/45">
              {todays.length} {todays.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        {todays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-espresso-600 bg-espresso-900/40 px-5 py-8 text-center">
            <p className="text-sm text-paper-300/60">
              Diary abhi khaali hai.
            </p>
            <p className="mt-1 text-xs text-paper-300/40">
              Upar mic dabao aur apna pehla kharcha bolo.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {todays.map((e, i) => {
              const st = CATEGORY_STYLES[e.category] ?? CATEGORY_STYLES.other;
              return (
                <article
                  key={e.id}
                  className="animate-rise"
                  style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
                >
                  <div className="flex items-center gap-3 rounded-2xl border border-espresso-700/60 bg-espresso-800/60 px-3.5 py-3 shadow-card">
                    {/* category rail */}
                    <span
                      className="h-10 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: st.rail }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-paper-50">
                        {e.item}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-[11px]">
                        <span
                          className="rounded-full px-2 py-0.5 font-medium"
                          style={{
                            backgroundColor: st.chipBg,
                            color: st.chipText,
                          }}
                        >
                          {CATEGORY_LABELS[e.category] ?? e.category}
                        </span>
                        <span className="tnum text-paper-300/45">
                          {formatTime(e.createdAt)}
                        </span>
                      </p>
                      {e.note && (
                        <p className="mt-0.5 truncate text-xs text-paper-300/45">
                          {e.note}
                        </p>
                      )}
                    </div>
                    <p className="tnum shrink-0 text-[17px] font-bold text-gold-300">
                      {e.amount.toLocaleString("en-PK")}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeEntry(e.id)}
                      aria-label="Entry hatao"
                      className="shrink-0 rounded-xl p-2 text-paper-300/35 transition hover:bg-espresso-700 hover:text-paper-100 active:scale-90"
                    >
                      <TrashIcon className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="mt-10 text-center">
        <div className="mx-auto mb-3 w-16 border-t border-gold-600/30" aria-hidden="true" />
        <p className="text-[11px] text-paper-300/40">
          Diary sirf phone me rehti hai — kahin nahi bheji jati.
        </p>
        <p className="mt-1 text-[10px] tracking-wide text-paper-300/30">
          Built with Meta&apos;s Muse Spark Open · Baseten
        </p>
      </footer>
    </main>
  );
}
