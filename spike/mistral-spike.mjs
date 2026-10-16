// Throwaway spike: can Mistral (free plan) + web_search find big sports events for a month?
// Usage: MISTRAL_API_KEY=... node spike/mistral-spike.mjs [YYYY-MM]
// Writes spike/out/<month>-<sport>.json (+ .raw.json) and prints a summary.
import { mkdir, writeFile } from "node:fs/promises";

const KEY = process.env.MISTRAL_API_KEY;
if (!KEY) {
  console.error("Missing MISTRAL_API_KEY");
  process.exit(1);
}

const API = "https://api.mistral.ai/v1";
const MODEL = process.env.MISTRAL_MODEL ?? "mistral-medium-latest";
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

async function call(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

const instructions =
  "Tu es un assistant qui recherche sur le web le calendrier des GRANDS événements sportifs. " +
  "Utilise la recherche web. Réponds UNIQUEMENT par un tableau JSON valide, sans texte autour, sans balises markdown. " +
  "N'invente jamais de date : si tu n'es pas sûr, mets confidence à \"low\".";

function prompt(sport, label) {
  return (
    `Liste les grands événements de ${label} qui ont lieu en ${month} (heure de Paris), hommes et femmes. ` +
    `Maximum 15. Pour chacun renvoie un objet avec les clés : ` +
    `"name" (string), "sport" ("${sport}"), "start_date" (YYYY-MM-DD), "end_date" (YYYY-MM-DD), ` +
    `"location" (string), "broadcast_fr" (chaînes TV en France ou null), ` +
    `"source_url" (string), "confidence" ("high"|"medium"|"low").`
  );
}

function extract(conv) {
  let text = "";
  const refs = [];
  let searches = 0;
  for (const o of conv.outputs ?? []) {
    if (o.type === "tool.execution") searches++;
    if (o.type === "message.output") {
      if (typeof o.content === "string") text += o.content;
      else
        for (const c of o.content ?? []) {
          if (c.type === "text") text += c.text;
          if (c.type === "tool_reference") refs.push({ title: c.title, url: c.url });
        }
    }
  }
  return { text, refs, searches };
}

function parseJson(text) {
  const t = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const m = t.match(/\[[\s\S]*\]/);
    return m ? JSON.parse(m[0]) : null;
  }
}

await mkdir("spike/out", { recursive: true });

const agent = await call("/agents", {
  model: MODEL,
  name: "sportsscrap-spike",
  description: "Spike: sports calendar via web search",
  instructions,
  tools: [{ type: "web_search" }],
  completion_args: { temperature: 0.2 },
});
console.log(`Agent ${agent.id} (${MODEL}), month ${month}\n`);

for (const [sport, label] of Object.entries(SPORTS)) {
  const t0 = Date.now();
  try {
    const conv = await call("/conversations", {
      agent_id: agent.id,
      inputs: prompt(sport, label),
      store: false,
    });
    const { text, refs, searches } = extract(conv);
    const events = parseJson(text);
    const base = `spike/out/${month}-${sport}`;
    await writeFile(`${base}.raw.json`, JSON.stringify(conv, null, 2));
    await writeFile(`${base}.json`, JSON.stringify({ events, refs }, null, 2));
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`== ${sport}: ${events?.length ?? "PARSE FAILED"} events, ${searches} searches, ${refs.length} refs, ${secs}s, usage=${JSON.stringify(conv.usage ?? {})}`);
    for (const e of events ?? [])
      console.log(`   ${e.start_date}..${e.end_date}  [${e.confidence}]  ${e.name} — ${e.location}`);
    if (!events) console.log(text.slice(0, 500));
  } catch (err) {
    console.log(`== ${sport}: ERROR ${err.message}`);
  }
}
