# Dataview → Datacore migration plan

> Status: **planning / overview** (2026-08-20). No blocks have been migrated yet. This doc is the
> reference plan. Companion personal note: `B. Note Box/Inbox/Dataview to Datacore migration — plan & performance notes.md`.

## 1. Scope snapshot (measured in this vault)

| Block type | Occurrences | Files | Detail |
|---|---|---|---|
| DQL ` ```dataview ` | 355 | 156 | 235 `LIST`, 22 `TABLE`, 5 `TASK`, 1 `CALENDAR` |
| ` ```dataviewjs ` | 641 | 439 | **311 files depend on `customJS`** |
| Inline `= dv…` / `$=` | ~408 | many | terse backtick expressions in headers/callouts |
| ` ```datacorejsx ` (already) | — | 90 | migration pattern already in use |

Concentration facts that drive the whole plan:

- **Most volume is template-propagated history.** 272 of the dataviewjs files and 129 of the DQL
  files live in `Y. Journal` — copies of a handful of blocks in `T. Templates/journal/daily.md` and
  `weekly.md`. Distinct logic is small (~6 templates + the `Z. Meta/datacore/*.jsx` modules).
- **Obsidian bakes block text into each note at creation.** Editing a template only changes *future*
  notes. Historical notes keep their Dataview blocks unless actively backfilled.
- **`customJS` coupling.** 311 blocks pull `noteUtils` (275) and `tableDrawer` (143) from
  `Z. Meta/custom-js/`. Datacore has no `customJS` bridge — these must be re-implemented as
  `dc.require(...)` JSX modules *first*.

## 2. Feasibility

Technically yes, but it is a **rewrite, not a transpile** — there is no automated DQL→Datacore
converter, and Datacore has no declarative query language (everything is JS + JSX).

| Source | Target | Effort |
|---|---|---|
| DQL `LIST`/`TABLE`/`TASK` | `datacorejsx` with `dc.useQuery` + `dc.Table`/`dc.List` | Mechanical but hand-written; ~260 blocks (mostly the same weekly pattern) |
| `dataviewjs` | `datacorejsx` | Real port: `dv.pages()`→`dc.useQuery()`, `dv.table()`→`<dc.Table>`, reactive model changes |
| `customJS` helpers | `dc.require` JSX modules in `Z. Meta/datacore/` | Port once, reuse everywhere |
| Inline `= dv…` (~408) | small `datacorejsx` blocks | **Sore spot** — Datacore has no terse inline-backtick equivalent; ergonomic downgrade *(verify against current Datacore docs before committing)* |

## 3. Performance findings (from web research, Aug 2026)

Treat vendor/author numbers as **claims**, not independent benchmarks — public hard data is thin.

- **Official goal:** *"2–10× better query and rendering performance"* vs Dataview (Datacore repo).
- **Author/community claims:** *"up to 100× faster"*; one anecdote of a table rendering in ~1 ms.
- **Why it's faster (architecture, well-supported):**
  - **Reactive incremental index** — Datacore updates only what changed and re-renders affected
    views live; Dataview leans on a periodic *refresh interval* (default 2500 ms) and often needs
    "Force Refresh".
  - **React-based views** — internal state + *flicker-free* updates; no content "jumping"/reflow
    that Dataview shows while rendering.
  - **New query API** — `dc.useQuery("@page and …")` is designed to beat `dv.pages().where(...)`.
- **Dataview pain points confirmed by users:** sluggish on large vaults, ~1–2 s added app load on
  mobile, content shuffling, stale/cached results.
- **Maturity caveat:** Datacore is **beta / work-in-progress** — back up, expect API churn.

## 4. Efficient resource use (guidance)

Some points are sourced; those marked *(reasoned)* follow from the architecture, not a cited benchmark.

- **Large dashboards:** prefer Datacore — live reactive index avoids the full re-scan + reflow that
  makes big Dataview dashboards feel unstable. Use `paging` on `dc.Table` and filter in the *query*
  string (`@page and path(...) and #tag`) rather than pulling everything then filtering in JS. *(reasoned)*
- **Small/one-off lookups:** the win is smaller; a trivial `LIST` is fine on either. Don't rewrite
  low-traffic one-offs just for speed. *(reasoned)*
- **Multiple `datacorejsx` blocks in one note:** the *index is shared*, so a second block does **not**
  re-index the vault — but each block is its own React root running its own query, so cost scales with
  `blocks × per-query cost`. Consolidate several small blocks into **one** block/component where it
  makes sense (e.g. the weekly note's 7 per-day `LIST`s → one component that buckets by day). *(reasoned)*
- **Reuse via `dc.require`:** factor shared logic into `Z. Meta/datacore/*.jsx` and `dc.require` it
  (already the vault pattern) — one cached module instead of duplicated inline code. *(sourced pattern)*
- **Debounce queries:** pass `{ debounce: 2500 }` (or higher) to `dc.useQuery` on heavy dashboards so
  rapid vault edits don't thrash re-runs; avoid `dc.useIndexUpdates()` unless you truly need
  per-change re-render. *(sourced from vault skill + docs)*
- **Mixing `datacorejsx` + `dataviewjs` in the same note / vault:** works, but during transition you
  run **two indexers** = higher memory and two engines re-rendering. It's fine for a migration window;
  it is *not* a good steady state. Don't split one logical dashboard across both engines — pick one per
  block, and ideally one per note. *(reasoned)*
- **Sync caveat:** this vault syncs via Google Drive across `.obsidian.desktop` + `.obsidian.tablet`.
  Keep plugin enable/version state consistent on both, or blocks render on one device and not the other.

## 5. Migration strategy (recommended: migrate-forward)

Port helpers + templates so **new** notes are pure Datacore; leave historical notes on Dataview and
keep the plugin installed as a legacy renderer. ~90% of the value, a fraction of the risk.

- **Phase 0 — Pilot & baseline.** Pick one low-risk PARA dashboard. Rebuild it in `datacorejsx`,
  compare feel/effort. Record how long it took (calibrates the rest).
- **Phase 1 — Port `customJS` helpers.** Reimplement `noteUtils.getDailyNoteHeader` and
  `tableDrawer.getTimestamp`/table logic as `Z. Meta/datacore/*.jsx` modules. Unblocks 311 files.
- **Phase 2 — Journal templates (highest traffic).** Convert `daily.md` and `weekly.md` blocks
  (incl. the 7 per-day `LIST`s → one component). New daily/weekly notes become Datacore-native.
- **Phase 3 — PARA + dashboards.** Convert `Project.md`, `Basic Dashboard.md`, and the `C. Dashboards`
  pages. These are few but high-value.
- **Phase 4 — Inline expressions.** Decide per-case: convert must-keeps to small blocks, drop the rest.
- **Phase 5 (optional) — Backfill history.** Only if the goal is to *uninstall Dataview*. Scripted
  find/replace across hundreds of notes — high risk; do last, with backups, or skip.

## 6. Per-block-type conversion cookbook (fill in during Phase 0)

- `LIST FROM #tag WHERE …` → `dc.useQuery("@page and #tag")` → `.filter(...)` → `<dc.List>`.
- `TABLE a, b FROM …` → `dc.useQuery` → `<dc.Table columns={[…]} rows={…} />`.
- `dv.pages(q).sort().limit(n)` → `dc.useArray(dc.useQuery(q), a => a.sort(...).slice(0,n))`.
- `dv.current()` → `dc.useCurrentFile()`.
- `customJS` class method → exported function in a `dc.require`d module.
- date/time frontmatter → `dc.luxon.DateTime` + `page.value("timestamp")`.
- *(Add real before/after snippets from the pilot here so later phases are copy-paste.)*

## 7. Risks & open decisions

**Risks:** beta API churn; loss of concise DQL + inline expressions; dual-plugin memory during
transition; sync/plugin-state drift across devices; backfill is destructive if scripted carelessly.

**Open decisions (needed before Phase 1):**
1. Endgame — eventually uninstall Dataview, or run both forever (forward-only)?
2. Inline `= dv…` snippets — must-keep, or accept small blocks / drop some?
3. Start point — highest-traffic journal templates, or the low-risk pilot first?

## 8. Sources

- Datacore repo — blacksmithgu/datacore (official 2–10× goal, React views, query API).
- Obsidian Rocks — "Dataview vs Datacore vs Obsidian Bases" and "Getting Started with Datacore".
- Medium — RooftopRobin, "Why Datacore Might Just Be Faster Than Dataview" (100× / ~1 ms claims).
- Obsidian forum + Dataview GitHub discussions — refresh-interval / force-refresh / large-vault slowness.
