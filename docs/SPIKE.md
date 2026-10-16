# Feasibility spike: AI with web search

**Question:** can a free (or very cheap) AI provider with live web search return reliable big-event calendars for our four sports?

**Why it matters:** event dates months ahead are not reliably in model memory. Without web search the model would guess dates. The monthly job must therefore use a provider with search.

## Scripts

- `spike/mistral-spike.mjs`: creates a Mistral agent with the `web_search` tool, then one conversation per sport. Uses `mistral-medium-latest` (override with `MISTRAL_MODEL`). **Written but never run** (no key was available).
- `spike/gemini-spike.mjs`: calls Gemini `generateContent` with the `google_search` tool. Default model `gemini-2.5-flash` (override with `GEMINI_MODEL`).

Both ask for a JSON array of events for a month (default: next month) per sport, and print count, searches, references, timing and token usage. Results are saved to `spike/out/` (git-ignored).

## Results

### Gemini (free API key from Google AI Studio), run on 2026-10-16

| Test | Result |
| --- | --- |
| Key validity | Valid. `GET /v1beta/models` lists many models. |
| `gemini-2.5-flash` | `404`: "no longer available to new users", suggested `gemini-3.8-flash`. The script default is therefore stale. |
| Plain generation, no tools (`gemini-flash-latest`, `gemini-3.5-flash`) | Works ("Bonjour"). `gemini-3.1-flash-lite` and `gemini-3.8-flash` returned `503 UNAVAILABLE` (high demand), a transient state. |
| **Generation with `google_search` tool** | **`429 RESOURCE_EXHAUSTED` on every model tried**: `gemini-3.8-flash`, `gemini-flash-latest`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-3-flash-preview`, `gemini-3.7-flash`. |

**Interpretation (unverified):** search grounding has no free quota on this key or project, or the quota is used up. The error text does not say which. The owner can look at https://ai.dev/rate-limit. Enabling billing on the Google project would probably unlock grounding, but this was not tested.

No event-quality data was gathered from Gemini, because grounded calls never succeeded. Running without search was rejected on purpose, since it would test memory rather than search.

### Mistral

Not tested. Known from documentation and search:

- Free **Experiment** plan: verified phone number, no card, requests may be used for training. Rate limits are not clearly published; see the Admin Console, Limits.
- Web search is a connector of the **Agents API** (`tools: [{"type": "web_search"}]`), available on `/v1/conversations` but **not** on `/v1/chat/completions`.
- Unknown: whether agent creation and `web_search` are allowed on the free plan. Mistral's help page lists agent creation under the paid Scale plan, which hints at gating.
- Response shape expected by the script: `outputs[]` with `tool.execution` entries and a `message.output` entry whose `content` is a list of `text` and `tool_reference` chunks (`title`, `url`).

### Claude API

Not tested. Web search is supported, billed per use. A monthly run (about 4 sports, up to 25 events each, with analyses) was estimated at a few cents to a couple of euros.

## What was not verified

- Whether the Mistral free plan allows web search.
- The cause of the Gemini 429.
- Data quality of any provider: correctness of dates, coverage of big events, invented events, French TV channels.
- Real token usage and cost of a full monthly run.

## Security note

During this session a Gemini key was pasted in the chat and passed on the command line. It is not stored in any file of this repo, but it should be **regenerated**. Always pass keys through environment variables or GitHub Actions secrets, never commit them.
