"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Hisab — Day-1 risk test harness (/test).
// 20 real Roman-Urdu/Urdu spoken phrases, each run through /api/parse-entry.
// Big accuracy % decides: >= 80% -> PASS (Hisab aage barhega),
// < 80% -> PIVOT to Dastaan immediately, no rescue.
//
// NOTE: run this on the deployed Vercel site AFTER adding BASETEN_API_KEY
// in Environment Variables. It will not work without the key.
// ---------------------------------------------------------------------------

interface TestPhrase {
  text: string;
  expectedAmount: number;
  expectedCategory: string;
}

const PHRASES: TestPhrase[] = [
  { text: "sabzi ke 200 diye", expectedAmount: 200, expectedCategory: "sabzi" },
  { text: "doodh 150 ka liya", expectedAmount: 150, expectedCategory: "doodh" },
  { text: "bus ka kiraya 80 rupay", expectedAmount: 80, expectedCategory: "kiraya" },
  { text: "bachche ki copy 120 ki li", expectedAmount: 120, expectedCategory: "copy-kitaab" },
  { text: "dawai ke 350 diye", expectedAmount: 350, expectedCategory: "dawai" },
  { text: "bijli ka bill 1200 jama karaya", expectedAmount: 1200, expectedCategory: "bills" },
  { text: "kapde liye 800 ke", expectedAmount: 800, expectedCategory: "kapde" },
  { text: "chai ke 50 diye", expectedAmount: 50, expectedCategory: "sabzi" },
  { text: "rickshaw ka kiraya 100 rupay", expectedAmount: 100, expectedCategory: "kiraya" },
  { text: "atta 20 kilo 1800 ka", expectedAmount: 1800, expectedCategory: "sabzi" },
  { text: "gosht 500 ka liya", expectedAmount: 500, expectedCategory: "sabzi" },
  { text: "school fees 2000 di", expectedAmount: 2000, expectedCategory: "copy-kitaab" },
  { text: "mobile ka recharge 300 ka karaya", expectedAmount: 300, expectedCategory: "bills" },
  { text: "phalon ke 250 diye", expectedAmount: 250, expectedCategory: "sabzi" },
  { text: "dahi 100 ki li", expectedAmount: 100, expectedCategory: "doodh" },
  { text: "petrol 500 ka dalwaya", expectedAmount: 500, expectedCategory: "kiraya" },
  { text: "naan 4 liye 80 ke", expectedAmount: 80, expectedCategory: "sabzi" },
  { text: "sabun aur surf 220 ke", expectedAmount: 220, expectedCategory: "other" },
  { text: "doctor ki fees 500 di", expectedAmount: 500, expectedCategory: "dawai" },
  { text: "bache ko 100 diye kharchi ke", expectedAmount: 100, expectedCategory: "other" },
];

const PASS_THRESHOLD = 80;

interface TestResult {
  phrase: string;
  expectedAmount: number;
  expectedCategory: string;
  amount: number | null;
  category: string | null;
  confidence: number | null;
  item: string;
  pass: boolean;
  note: string;
}

interface ParseResponse {
  ok: boolean;
  entry?: {
    amount: number;
    currency: string;
    category: string;
    item: string;
    note: string;
    confidence: number;
  };
  needs_clarification?: boolean;
  question?: string;
  error?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Inline SVG icons (zero emoji, hard rule) ---

function FlaskIcon({ className }: { className?: string }) {
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
      <path d="M9.5 3h5" />
      <path d="M10.5 3v5.2L4.7 17.6A2.4 2.4 0 0 0 6.8 21h10.4a2.4 2.4 0 0 0 2.1-3.4L13.5 8.2V3" />
      <path d="M7.6 14.5h8.8" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
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

export default function TestPage() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<TestResult[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);

  async function runTest() {
    setRunning(true);
    setResults([]);
    setDone(0);
    setFatal(null);
    const out: TestResult[] = [];

    for (const p of PHRASES) {
      let result: TestResult;
      try {
        const res = await fetch("/api/parse-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: p.text, lang: "ur-PK" }),
        });
        const data = (await res.json()) as ParseResponse;

        if (!res.ok || !data.ok) {
          result = {
            phrase: p.text,
            expectedAmount: p.expectedAmount,
            expectedCategory: p.expectedCategory,
            amount: null,
            category: null,
            confidence: null,
            item: "",
            pass: false,
            note: data.error ? `API error: ${data.error}` : `HTTP ${res.status}`,
          };
          if (data.error === "MISSING_API_KEY") {
            setFatal(
              "BASETEN_API_KEY nahi mili — Vercel me Environment Variables me key add karo aur redeploy karo, phir test chalao."
            );
            setRunning(false);
            setResults(out);
            return;
          }
        } else if (data.needs_clarification) {
          result = {
            phrase: p.text,
            expectedAmount: p.expectedAmount,
            expectedCategory: p.expectedCategory,
            amount: null,
            category: null,
            confidence: null,
            item: "",
            pass: false,
            note: `Poochha gaya: "${data.question ?? "kitne diye?"}" (guess nahi kiya — imandaar, lekin parse nahi hua)`,
          };
        } else if (data.entry) {
          const e = data.entry;
          const pass =
            e.amount === p.expectedAmount && e.category === p.expectedCategory;
          result = {
            phrase: p.text,
            expectedAmount: p.expectedAmount,
            expectedCategory: p.expectedCategory,
            amount: e.amount,
            category: e.category,
            confidence: e.confidence,
            item: e.item,
            pass,
            note: pass ? "OK" : "Ghalat parse",
          };
        } else {
          result = {
            phrase: p.text,
            expectedAmount: p.expectedAmount,
            expectedCategory: p.expectedCategory,
            amount: null,
            category: null,
            confidence: null,
            item: "",
            pass: false,
            note: "Koi entry nahi mili",
          };
        }
      } catch {
        result = {
          phrase: p.text,
          expectedAmount: p.expectedAmount,
          expectedCategory: p.expectedCategory,
          amount: null,
          category: null,
          confidence: null,
          item: "",
          pass: false,
          note: "Network error",
        };
      }
      out.push(result);
      setResults([...out]);
      setDone(out.length);
      await sleep(400);
    }
    setRunning(false);
  }

  const accuracy =
    results.length > 0
      ? Math.round(
          (results.filter((r) => r.pass).length / results.length) * 100
        )
      : null;
  const finished = !running && results.length === PHRASES.length;
  const passed = finished && accuracy !== null && accuracy >= PASS_THRESHOLD;

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pb-10">
      {/* Header */}
      <header className="flex items-center gap-3 pt-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold-600/40 bg-espresso-800 shadow-card">
          <FlaskIcon className="h-5 w-5 text-gold-400" />
        </span>
        <span>
          <h1 className="font-display text-[22px] leading-none tracking-wide text-gold-300">
            Day-1 Risk Test
          </h1>
          <p className="mt-1 text-xs text-paper-300/60">
            20 asli jumle → parse accuracy. Ye test faisla karega: Hisab ya Dastaan.
          </p>
        </span>
      </header>

      <div className="mt-4 border-t border-gold-600/25" aria-hidden="true" />
      <div className="mt-[3px] border-t border-gold-600/10" aria-hidden="true" />

      {/* Accuracy — the decision dial */}
      {accuracy !== null && (
        <section
          className={`mt-5 overflow-hidden rounded-3xl border px-5 py-6 text-center shadow-card ${
            finished
              ? passed
                ? "border-emerald-500/30 bg-emerald-950/50"
                : "border-gold-600/30 bg-espresso-800/70"
              : "border-espresso-600 bg-espresso-900/60"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-paper-300/55">
            Accuracy
          </p>
          <p
            className={`tnum mt-1 font-display text-7xl leading-none ${
              finished ? (passed ? "text-emerald-300" : "text-gold-300") : "text-paper-100"
            }`}
          >
            {accuracy}
            <span className="text-4xl">%</span>
          </p>
          <div className="mx-auto mt-4 max-w-xs">
            {/* progress rail — neutral gold fill, never a verdict */}
            <div className="h-2 overflow-hidden rounded-full bg-espresso-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  finished && passed ? "bg-emerald-400" : "bg-gold-500"
                }`}
                style={{ width: `${accuracy}%` }}
              />
            </div>
          </div>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-paper-100">
            {finished ? (
              passed ? (
                <span className="flex items-center justify-center gap-2 font-semibold text-emerald-200">
                  <CheckIcon className="h-5 w-5" />
                  PASS — Hisab aage barhega. D2: evening story.
                </span>
              ) : (
                <span className="font-semibold text-gold-200">
                  PIVOT — {PASS_THRESHOLD}% se kam. Dastaan par jao, bachane ki
                  koshish nahi.
                </span>
              )
            ) : (
              <span className="text-paper-300/70">
                Chal raha hai… {done}/{PHRASES.length}
              </span>
            )}
          </p>
        </section>
      )}

      {/* Missing key notice */}
      {fatal && (
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-gold-600/50 bg-gold-500/10 px-4 py-3.5 shadow-card">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" />
          <p className="text-sm leading-relaxed text-paper-100">{fatal}</p>
        </div>
      )}

      {/* Run */}
      <button
        type="button"
        onClick={() => void runTest()}
        disabled={running}
        className="mt-5 rounded-2xl bg-gradient-to-b from-gold-400 to-gold-600 px-6 py-4 text-lg font-bold text-espresso-950 shadow-glow-gold transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
      >
        {running ? `Test chal raha hai… ${done}/${PHRASES.length}` : "Run test"}
      </button>

      {/* Results table */}
      {results.length > 0 && (
        <section className="mt-5 overflow-hidden rounded-2xl border border-espresso-600 shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-espresso-600 bg-espresso-800 text-[10px] uppercase tracking-[0.14em] text-paper-300/55">
                  <th className="px-3 py-2.5 font-semibold">#</th>
                  <th className="px-3 py-2.5 font-semibold">Jumla</th>
                  <th className="px-3 py-2.5 font-semibold">Parse</th>
                  <th className="px-3 py-2.5 font-semibold">Conf</th>
                  <th className="px-3 py-2.5 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-b border-espresso-700/50 last:border-0 ${
                      i % 2 === 0 ? "bg-espresso-900/50" : "bg-espresso-800/40"
                    }`}
                  >
                    <td className="tnum px-3 py-2.5 text-paper-300/50">{i + 1}</td>
                    <td className="px-3 py-2.5 text-paper-100">
                      {r.phrase}
                      <span className="tnum block text-paper-300/45">
                        expect: {r.expectedAmount} / {r.expectedCategory}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-paper-100">
                      {r.amount !== null ? (
                        <>
                          <span className="tnum">
                            {r.amount} / {r.category}
                          </span>
                          <span className="block text-paper-300/45">{r.item}</span>
                        </>
                      ) : (
                        <span className="text-paper-300/50">{r.note}</span>
                      )}
                    </td>
                    <td className="tnum px-3 py-2.5 text-paper-300/70">
                      {r.confidence !== null ? r.confidence.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          r.pass
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-gold-500/15 text-gold-300"
                        }`}
                      >
                        {r.pass ? (
                          <CheckIcon className="h-3.5 w-3.5" />
                        ) : (
                          <XIcon className="h-3.5 w-3.5" />
                        )}
                        {r.pass ? "PASS" : "FAIL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="mt-8 text-center">
        <div className="mx-auto mb-3 w-16 border-t border-gold-600/30" aria-hidden="true" />
        <p className="text-[11px] text-paper-300/40">
          Faisla simple hai: {PASS_THRESHOLD}% ya zyada = Hisab. Kam = Dastaan.
        </p>
      </footer>
    </main>
  );
}
