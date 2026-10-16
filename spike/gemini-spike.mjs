// Throwaway spike: can Gemini + Google Search grounding find big sports events for a month?
// Usage: GEMINI_API_KEY=... node spike/gemini-spike.mjs [YYYY-MM]
// Writes spike/out/gemini-<month>-<sport>.json (+ .raw.json) and prints a summary.
import { mkdir, writeFile } from "node:fs/promises";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("Missing GEMINI_API_KEY");
  process.exit(1);
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const month = process.argv[2] ?? nextMonth();
const SPORTS = {
  cycling: "Cyclisme (route, hommes et femmes : Tour de France, Giro, Vuelta, Monuments, Mondiaux, JO...)",
  athletics: "Athlétisme (JO, Mondiaux, Championnats d'Europe, Diamond League, finales...)",
  volleyball: "Volley-ball (JO, Mondiaux, Euro, Ligue des Nations, matchs de l'équipe de France...)",
  tabletennis: "Tennis de table (JO, Mondiaux, Euro, WTT Finals, Grand Smashes...)",
};

function nextMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 7);
}

const system =
  "Tu es un assistant qui recherche sur le web le calendrier des GRANDS événements sportifs. " +
  "Utilise la recherche Google. Réponds UNIQUEMENT par un tableau JSON valide, sans texte autour, sans balises markdown. " +
  'N\'invente jamais de date : si tu n\'es pas sûr, mets confidence à "low".';

function prompt(sport, label) {
  return (
    `Liste les grands événements de ${label} qui ont lieu en ${month} (heure de Paris), hommes et femmes. ` +
    `Maximum 15. Pour chacun renvoie un objet avec les clés : ` +
    `"name" (string), "sport" ("${sport}"), "start_date" (YYYY-MM-DD), "end_date" (YYYY-MM-DD), ` +
    `"location" (string), "broadcast_fr" (chaînes TV en France ou null), ` +
    `"source_url" (string), "confidence" ("high"|"medium"|"low").`
  );
}

function parseJson(text) {
  const t = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\[[\s\S]*\]/);
    try {
      return m ? JSON.parse(m[0]) : null;
    } catch {
      return null;
    }
  }
}

await mkdir("spike/out", { recursive: true });
console.log(`Gemini ${MODEL}, month ${month}\n`);

for (const [sport, label] of Object.entries(SPORTS)) {
  const t0 = Date.now();
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt(sport, label) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 600)}`);
    const data = JSON.parse(raw);
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    const gm = cand?.groundingMetadata ?? {};
    const refs = (gm.groundingChunks ?? []).map((c) => ({ title: c.web?.title, url: c.web?.uri }));
    const events = parseJson(text);
    const base = `spike/out/gemini-${month}-${sport}`;
    await writeFile(`${base}.raw.json`, JSON.stringify(data, null, 2));
    await writeFile(`${base}.json`, JSON.stringify({ events, refs, queries: gm.webSearchQueries }, null, 2));
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `== ${sport}: ${events?.length ?? "PARSE FAILED"} events, ${gm.webSearchQueries?.length ?? 0} searches, ${refs.length} refs, ${secs}s, usage=${JSON.stringify(data.usageMetadata ?? {})}`,
    );
    for (const e of events ?? [])
      console.log(`   ${e.start_date}..${e.end_date}  [${e.confidence}]  ${e.name} — ${e.location}`);
    if (!events) console.log(text.slice(0, 500));
  } catch (err) {
    console.log(`== ${sport}: ERROR ${err.message}`);
  }
}
