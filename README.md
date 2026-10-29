# Hisab — Voice Money Diary for Cash Households

Speak your spending in your own language ("sabzi ke 200 diye") — the diary
keeps itself. Every evening it tells your day back as a warm story and teaches
one small saving trick. It never judges your money.

Built with **Meta's Muse Spark Open** (open weights) via Baseten.
Meta AI Developer Hackathon entry — Day 1 scaffold.

## What is built (Day 1 only)

- `app/api/parse-entry/route.ts` — POST `{text, lang}` → Baseten
  `meta-models/muse-spark-open` with a forced tool call. Returns a structured
  entry `{amount, currency, category, item, note, confidence}`. If confidence
  is below 0.6 (or no amount was spoken) it asks back "kitne diye?" instead of
  guessing. Never guesses.
- `app/page.tsx` — home: big mic button (Web Speech, ur-PK / en-US), text
  input fallback, today's entries saved in the phone's localStorage.
- `app/test/page.tsx` — Day-1 risk test: 20 real Roman-Urdu phrases through
  the parser, accuracy % decides PASS (build Hisab) vs PIVOT (build Dastaan).

**Design law:** no red numbers, no "overspent", no grades, no scolding charts —
anywhere, ever.

## Your steps (do them one by one)

### Step 1 — Create the public repo
1. Open github.com and click **New repository**.
2. Name: `hisab`. Make it **Public** (hackathon needs a public repo).
3. Do NOT tick "Add a README". Click **Create repository**.

### Step 2 — Upload these files
1. On the new repo page, click **"uploading an existing file"**.
2. Open the `hisab` folder on your laptop, select ALL files and folders inside
   it, and drag them into the GitHub upload box. (Or use **Add file → Upload
   files**.)
3. Click **Commit changes**.

### Step 3 — Import into Vercel
1. Open vercel.com → **Add New… → Project**.
2. Find the `hisab` repo and click **Import**.
3. Keep all settings as they are, click **Deploy**. Wait until it finishes.

### Step 4 — Add your Baseten key (important)
1. In Vercel, open the `hisab` project → **Settings → Environment Variables**.
2. Name: `BASETEN_API_KEY` — Value: paste your Baseten API key
   (the same one from the MediLens project; it is never written in chat
   or in any file).
3. Tick all environments, click **Save**.
4. Go to **Deployments**, open the latest one, click the **⋯** menu →
   **Redeploy**. Wait until it finishes.

### Step 5 — Run the Day-1 risk test
1. Open your site: `https://hisab.vercel.app/test`
   (your real URL is shown on the Vercel project page).
2. Tap **Run test** and wait for all 20 phrases.
3. **80% or more → PASS:** Hisab moves to Day 2 (evening story).
   **Below 80% → PIVOT:** we build Dastaan instead, no rescue attempts.

### Step 6 — Try the diary
Open `https://hisab.vercel.app/` on your phone, tap the mic, say
"sabzi ke 200 diye", and watch the entry appear.

## For developers

```bash
npm install
npm run typecheck   # tsc --noEmit, must be clean
npm run build       # next build, must be clean
```

Copy `.env.example` to `.env.local` and fill in `BASETEN_API_KEY` for local dev.
