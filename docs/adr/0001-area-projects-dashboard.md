# 0001. Area Projects dashboard: data model, shipping mechanism, and timeline design

## Status

Accepted (2026-11-23 — 2026-11-26 session; smoke-tested against a real vault by the author).

## Context

The request: give each Area note a "Projects" overview — counts by status,
and a visual sense of how its projects have started and are progressing —
inspired loosely by the existing Note/Tags creation-timeline dashboard.

This is the first ADR in the repo (`docs/adr/` didn't exist before this), so
it also records a few decisions that would otherwise only live in PR/commit
history or chat — a stand-in until a real decision-record flow (e.g. this
writing straight back to the vault's own PARA project notes via a Google
Drive integration) exists. See `docs/dashboards/area-projects.md` for the
full implementation write-up this ADR summarizes the *decisions* behind.

## Decisions

**1. A project belongs to an area via a dedicated `area` frontmatter field,
matched directly — not Datacore's `connected()` query.**
`connected([[Area Note]])` (already used elsewhere in this repo, for a
different purpose) matches *any* link relationship with a note, including a
stray mention in a project's body. `area` is a purpose-built field, so
`matchesArea()` resolves it directly instead — accepting either a plain
`[[Wikilink]]`/`[[Wikilink|Alias]]` frontmatter string or a Datacore-parsed
`Link` object, since it wasn't certain in advance which shape Datacore would
hand back.

**2. Status-bucket categorization got its own module
(`datacore/utils/areaProjects.js`'s `categorizeProject`), not a reuse of
Projects.md's inline logic.** Projects.md's version isn't fully exclusive —
a project with inconsistent frontmatter (e.g. `status: coldtask` plus a
leftover `#archive` tag) can land in two of its sections at once. Rather
than import that ambiguity into a second dashboard, this one is
priority-ordered and strictly mutually exclusive (`done` > `archived` >
`coldtask` > `backlog` > `active`). Projects.md itself wasn't touched —
reconciling the two was judged out of scope for this change.

**3. Shipped as a `dc.require`d shared component, attached via a one-off
QuickAdd script — not a template edit.** Area notes live in the vault's
`A. PARA Notes/Areas/`, not in any of the three folders this repo mirrors,
so there's no Area template file here to edit directly. The actual delivery
mechanism is `quickadd-scripts/insert-area-projects-dashboard.js`, intended
as a macro step after "From Template: Area" for new notes, and a manual
backfill command for existing ones.

**4. A new `target` frontmatter field on project notes.** Didn't exist
before this feature; nothing else in the vault/repo uses it yet. Every
project without one simply shows "—" / sorts last — adopting it is opt-in,
not a migration.

**5. The timeline is a per-project Gantt-style bar, not a calendar or a
reuse of the aggregate multi-series creation-timeline chart.** The
alternative considered was reusing `creationTimeline.jsx` wholesale (bucket
counts over time, like the Note/Tags and Resources dashboards). Rejected
because an area's project count is typically small — a handful, not
hundreds — so bucketed counts would be thin and wouldn't show *progress*
per project at all, only creation cadence. A calendar was also considered
and rejected: calendars suit discrete events on specific days, not spans
from a start to an open-ended or resolved end. The Gantt-row approach does
cost new code (bar geometry/clamping math, a scrollable window) rather than
reusing an existing component outright, but it's what actually answers "how
has each project progressed."

**6. The timeline bar's end date is bucket-aware — a resolved project's own
date wins over a `target` it still happens to have.** First shipped as
`target ?? doneDate ?? archivedDate ?? coldDate`, which is wrong whenever a
project keeps the `target` it was given at the start even after being
marked done: the bar would draw to the *planned* date, not when the project
*actually* finished. Fixed to resolve per-bucket (`doneDate` for `done`,
`archivedDate` for `archived`, `coldDate` for `coldtask`, falling back to
`target` only if that bucket's own field is empty; `active`/`backlog`
always use `target`, having no resolution date of their own). Caught by the
project owner reviewing the shipped behavior, not by the test suite
written for the original (wrong) version — see
`docs/dashboards/area-projects.md`'s "End date" note.

## Consequences

- A GLOSSARY entry ("Project status bucket") documents the new bucket
  concept and flags that it isn't yet shared with Projects.md's own
  categorization — a known, accepted inconsistency rather than a silent one.
- `datacore/utils/areaProjects.js` now also hosts the timeline's window/
  geometry math and re-exports a curated subset of `timeline.js`'s
  `RANGE_PRESETS` — a second module reaching into `timeline.js`, which
  hadn't happened before this feature.
- The `target` field is net-new vault-wide schema; if it turns out to be
  useful, Projects.md and other project-facing dashboards may eventually
  want it too (not done here).
- No vault-side change shipped in this repo: applying the dashboard to a
  real Area note, and setting `target` on real project notes, is manual
  follow-up work for the vault owner, not something this PR does.
