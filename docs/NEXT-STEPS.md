# How to resume

The design is finished (see [DESIGN.md](DESIGN.md)); do not redo the interview. Only the AI provider is unresolved.

## 1. Unblock an AI provider with web search

Pick whichever works first, in this order of cost:

1. **Mistral free plan.** Get a key at console.mistral.ai, then
   `$env:MISTRAL_API_KEY="..."; node spike/mistral-spike.mjs`.
   Success means agent creation and `web_search` work on the free plan.
2. **Gemini.** Check https://ai.dev/rate-limit for the grounding quota, or enable billing on the Google project, then
   `$env:GEMINI_API_KEY="..."; $env:GEMINI_MODEL="gemini-3.5-flash"; node spike/gemini-spike.mjs`.
   (The script default `gemini-2.5-flash` is retired for new keys.)
3. **Claude API with web search.** Billed separately from a Claude subscription (console.anthropic.com). A few cents per monthly run. Needs a new spike script.

## 2. Judge the data

Read the output in `spike/out/` against the official calendars. Check:

- dates are correct, nothing is invented;
- the big events of each sport are present;
- French TV channels are usable;
- usage fits a monthly job and the provider's limits.

If quality is poor with every provider, the fallback to discuss is curated per-sport source URLs fetched by the job, with the AI only structuring and summarising them.

## 3. Build (suggested order)

1. Repo scaffold: Vite, Preact, TypeScript, PWA plugin, Vitest.
2. Event and analysis schema, with validation.
3. AI provider interface plus the chosen implementation.
4. Monthly generator script (dedupe, "rescheduled" detection, per-sport cap, retry, never overwrite good data on failure).
5. GitHub Actions workflow: cron on the 1st plus `workflow_dispatch`, key in repository secrets, commit `events/YYYY-MM.json`.
6. Calendar UI: month view first, then week and year heat-map, sport filter, URL-driven view and filters.
7. Event bottom sheet with analysis, "AI estimate" label and the flags.
8. GitHub Pages deployment.
9. A design document for colours and visual identity, then apply it.

## Owner-only steps

Create the AI account and key, add it to the repository's Actions secrets, enable GitHub Pages. A guided setup script can be prepared for these.
