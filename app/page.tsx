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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-6">
      {/* Header */}
      <header className="mb-5 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-amber-300">
          Hisab
        </h1>
        <p className="mt-1 text-sm text-amber-200/70">
          Bolo — diary khud likhi jayegi
        </p>
      </header>

      {/* Mic + language */}
      <section className="mb-4 flex flex-col items-center">
        <button
          type="button"
          onClick={listening ? stopListening : startListening}
          aria-label={listening ? "Sunnna band karo" : "Bolo"}
          className={`flex h-28 w-28 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 ${
            listening
              ? "animate-pulse bg-red-400 text-amber-950"
              : "bg-amber-500 text-amber-950 hover:bg-amber-400"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-12 w-12"
            aria-hidden="true"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" strokeLinecap="round" />
            <path d="M12 17v4" strokeLinecap="round" />
          </svg>
        </button>
        <p className="mt-2 text-xs text-amber-200/70">
          {listening ? "Sun raha hun… bolo" : "Mic dabao aur bolo"}
        </p>
        <label className="mt-3 flex items-center gap-2 text-xs text-amber-200/70">
          Zuban:
          <select
            value={recogLang}
            onChange={(e) => setRecogLang(e.target.value)}
            className="rounded-lg border border-amber-800 bg-amber-900 px-2 py-1 text-amber-100"
          >
            <option value="ur-PK">Urdu</option>
            <option value="en-US">English</option>
          </select>
        </label>
      </section>

      {/* Text fallback */}
      <section className="mb-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitText(input);
            }}
            placeholder='Masalan: "sabzi ke 200 diye"'
            className="min-w-0 flex-1 rounded-xl border border-amber-800 bg-amber-900/60 px-4 py-3 text-amber-50 placeholder:text-amber-200/40 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void submitText(input)}
            disabled={sending || !input.trim()}
            className="shrink-0 rounded-xl bg-amber-500 px-4 py-3 font-semibold text-amber-950 disabled:opacity-40"
          >
            {sending ? "…" : "Likho"}
          </button>
        </div>
      </section>

      {/* Clarification ask-back (honesty, not a guess) */}
      {question && (
        <div className="mb-4 rounded-xl border border-amber-600/60 bg-amber-900/70 px-4 py-3 text-sm text-amber-100">
          <span className="font-semibold text-amber-300">{question}</span>
          <span className="text-amber-200/80"> — raqam dobara bolo ya likho.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-amber-800 bg-amber-900/70 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      {/* Today's total — warm, never a verdict */}
      <section className="mb-4 rounded-2xl bg-amber-900/50 px-5 py-4 text-center">
        <p className="text-xs uppercase tracking-widest text-amber-200/60">
          Aaj ka hisab
        </p>
        <p className="mt-1 text-4xl font-bold text-amber-300">
          Rs {total.toLocaleString("en-PK")}
        </p>
        <p className="mt-1 text-xs text-amber-200/60">
          {todays.length === 0
            ? "Abhi kuch nahi likha"
            : `${todays.length} ${todays.length === 1 ? "entry" : "entries"}`}
        </p>
      </section>

      {/* Entries list */}
      <section className="flex flex-col gap-2">
        {todays.length === 0 && (
          <p className="py-6 text-center text-sm text-amber-200/50">
            Upar mic dabao aur apna pehla kharcha bolo.
          </p>
        )}
        {todays.map((e) => (
          <article
            key={e.id}
            className="flex items-center gap-3 rounded-xl bg-amber-900/40 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-amber-100">
                {e.item}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-amber-200/60">
                <span className="rounded-full bg-amber-800/80 px-2 py-0.5 text-amber-200">
                  {CATEGORY_LABELS[e.category] ?? e.category}
                </span>
                <span>{formatTime(e.createdAt)}</span>
              </p>
              {e.note && (
                <p className="mt-0.5 truncate text-xs text-amber-200/50">
                  {e.note}
                </p>
              )}
            </div>
            <p className="shrink-0 text-base font-bold text-amber-300">
              Rs {e.amount.toLocaleString("en-PK")}
            </p>
            <button
              type="button"
              onClick={() => removeEntry(e.id)}
              aria-label="Entry hatao"
              className="shrink-0 rounded-lg px-2 py-1 text-xs text-amber-200/60 hover:bg-amber-800 hover:text-amber-100"
            >
              Hatao
            </button>
          </article>
        ))}
      </section>

      <footer className="mt-8 text-center text-[11px] text-amber-200/40">
        Diary sirf phone me rehti hai — kahin nahi bheji jati.
      </footer>
    </main>
  );
}
