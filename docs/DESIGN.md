# Design decisions

Outcome of the design interview (October 2026). Every item below was explicitly decided by the owner.
Anything not listed here was not decided.

## Users and platform

- 3 users: the owner, their sister, their mother. No accounts, no per-person profiles.
- Phone app delivered as a **PWA** (installed from a link to the home screen; no app stores). Works on iPhone and Android.
- Everyone sees everything by default; users can filter by sport.
- Everything in French, for France, times in Europe/Paris.

## Scope

- Sports v1: **Cycling, Athletics, Volley-ball, Table tennis (Ping Pong)**. More sports are welcome later.
- **Big events only**, men's and women's. The AI judges importance and may add exceptional events (for example a French final), flagged "added by AI".
- Starter anchors per sport (editable list):
  - Cycling: Tour de France, Giro, Vuelta, Monuments, Worlds, Olympics (men and women).
  - Athletics: Olympics, World and European Championships, Diamond League finals, Golden Leagues.
  - Volley-ball: Olympics, Worlds, Euros, Nations League finals, France national team matches.
  - Table tennis: Olympics, World and European Championships, WTT Finals and Grand Smashes.
- A French angle is included in every analysis (`french_interest`), without restricting which events appear.

## Calendar and UI

- Views: week, month, year. **Month is the default.** Year view is a heat-map. On mobile the week is a list.
- Past events stay visible, greyed out.
- Colours per sport and the visual design are **deferred to a later design document**.
- Dark mode follows the phone.
- Tapping an event opens a bottom sheet: stakes, favourites, outsider, French interest, summary, TV channel (France), source link, "to verify" badge, "added by AI" flag, "rescheduled" flag.

## Event data model (proposed)

Event: `sport`, `name`, `start_date`, `end_date`, `location`, `broadcast_fr`, `source_url`, `confidence` (`high|medium|low`).
Deduplicated by sport + name + date; a changed date or time is shown as "rescheduled".

Analysis (individual sports use athletes, not teams):
`stakes`, `favourites[]` (up to 3), `outsider`, `french_interest`, `summary` (max 120 words), `confidence`. All labelled "AI estimate".

## Architecture

Decided after the owner chose automatic monthly generation over a manual refresh button. This removed the need for any backend.

- **GitHub Actions cron job on the 1st of each month**, also triggerable by hand (`workflow_dispatch`) as an emergency refresh.
  - Regenerates the current month in full and discovers events for the **next 2 months**.
  - Generates **every analysis up front**.
  - Cap of about 25 events per sport per month to keep cost predictable.
  - Commits `events/YYYY-MM.json`.
- **Static PWA on GitHub Pages** reads those files. No server, no Worker, no database, no admin secret.
- The AI key lives only in **GitHub Actions secrets**.
- **Failure handling:** output validated against a schema, one retry, a failed run never overwrites good data (GitHub emails the owner), each event keeps its source URL and a confidence field, unconfirmed events show a "to verify" badge.
- **Staleness is accepted:** an analysis written on the 1st may miss a later injury or withdrawal. No weekly freshness job in v1.
- **AI provider behind a small interface** so Mistral, Gemini or Claude can be swapped without a rewrite.

## Sharing

A share is a URL with the view and filters, for example `?view=month&month=2026-11&sports=volley,cycling`. It preselects the view; the family can still change it. The site is public and the content is public sports information, so there is no secrecy and no revocation. If privacy is wanted later: password or Cloudflare Access.

## Stack and repo

TypeScript, Vite, Preact, a PWA plugin, Vitest. Public GitHub repo `Adrien-EPF/Sports-Scraping` (project name: SportsScrap).

## Decisions that were dropped along the way

These were discussed and then made unnecessary by the monthly pre-generation choice. They are recorded so they are not rediscovered as gaps:

- Manual refresh button, Cloudflare Worker, KV/D1 storage, admin secret, per-click spend caps.
- Family members generating analyses on demand with a daily limit (the earlier "Q3 = b").
- Revocable share tokens.

## Cost and billing facts established

- A Claude subscription (Pro/Max) does **not** include API access; the API is billed separately at console.anthropic.com.
- Earlier cost estimate with Claude: about 1-5 cents per on-demand analysis, a few cents to a couple of euros per month in total.
- Mistral's free Experiment plan needs only a verified phone number but **may use requests for training**; fine for public sports data.
