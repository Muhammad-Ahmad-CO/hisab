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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 pb-10 pt-6">
      <header className="mb-5 text-center">
        <h1 className="text-2xl font-bold text-amber-300">
          Day-1 Risk Test
        </h1>
        <p className="mt-1 text-sm text-amber-200/70">
          20 asli jumle → parse accuracy. Ye test faisla karega: Hisab ya Dastaan.
        </p>
      </header>

      {accuracy !== null && (
        <section
          className={`mb-5 rounded-2xl px-5 py-6 text-center ${
            finished
              ? passed
                ? "bg-emerald-900/60"
                : "bg-amber-900/60"
              : "bg-amber-900/40"
          }`}
        >
          <p className="text-xs uppercase tracking-widest text-amber-200/60">
            Accuracy
          </p>
          <p className="mt-1 text-6xl font-bold text-amber-300">{accuracy}%</p>
          <p className="mt-2 text-sm text-amber-100">
            {finished
              ? passed
                ? "PASS — Hisab aage barhega. D2: evening story."
                : `PIVOT — ${PASS_THRESHOLD}% se kam. Dastaan par jao, bachane ki koshish nahi.`
              : `Chal raha hai… ${done}/${PHRASES.length}`}
          </p>
        </section>
      )}

      {fatal && (
        <div className="mb-4 rounded-xl border border-red-400/40 bg-red-950/60 px-4 py-3 text-sm text-red-200">
          {fatal}
        </div>
      )}

      <button
        type="button"
        onClick={() => void runTest()}
        disabled={running}
        className="mb-5 rounded-xl bg-amber-500 px-6 py-4 text-lg font-bold text-amber-950 disabled:opacity-40"
      >
        {running ? `Test chal raha hai… ${done}/${PHRASES.length}` : "Run test"}
      </button>

      {results.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-amber-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-amber-900/70 text-amber-200">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Jumla</th>
                <th className="px-3 py-2">Parse</th>
                <th className="px-3 py-2">Conf</th>
                <th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={i}
                  className={i % 2 === 0 ? "bg-amber-950/60" : "bg-amber-900/30"}
                >
                  <td className="px-3 py-2 text-amber-200/60">{i + 1}</td>
                  <td className="px-3 py-2 text-amber-100">
                    {r.phrase}
                    <span className="block text-amber-200/50">
                      expect: {r.expectedAmount} / {r.expectedCategory}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-amber-100">
                    {r.amount !== null ? (
                      <>
                        {r.amount} / {r.category}
                        <span className="block text-amber-200/50">{r.item}</span>
                      </>
                    ) : (
                      <span className="text-amber-200/50">{r.note}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-amber-200/70">
                    {r.confidence !== null ? r.confidence.toFixed(2) : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 font-bold ${
                      r.pass ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {r.pass ? "PASS" : "FAIL"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="mt-8 text-center text-[11px] text-amber-200/40">
        Faisla simple hai: {PASS_THRESHOLD}% ya zyada = Hisab. Kam = Dastaan.
      </footer>
    </main>
  );
}
