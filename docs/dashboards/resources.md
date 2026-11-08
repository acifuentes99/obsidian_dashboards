# Resources dashboard

`C. Dashboards/Main/Resources.md`. Single `datacorejsx` block, three views stacked
in one note. Source of truth for behavior is the code; this doc tracks *why*
it's shaped this way and what's deliberately left out.

## Data model

Query: `@page and #type/resource and !path("T. Templates")` — every non-template
note tagged `type/resource`.

Per resource, the block derives:

- `timestamp` (frontmatter) — creation date. Two formats exist in the vault:
  ISO strings (`2024-04-04T23:45:40`) and a bare numeric `YYYYMMDDHHmm`
  (`202308051222`). `getTimestamp()` tries `dc.coerce.date` first, then falls
  back to slicing the numeric form into `YYYY-MM-DD`.
- `category` (frontmatter, defaults to `"Otros"`).
- `#archive` tag → `isArchived`.
- `tags` — the note's full tag list minus the `#` prefix, with `type/resource`
  and `archive` filtered out (redundant — every row has the former, the
  latter's already `isArchived`). Shown in the timeline's drill-down table.
- Parent/child hierarchy — **inferred from outlinks**, not a frontmatter
  field: if resource A links to resource B, B is treated as A's parent. Roots
  (resources nothing links to) are grouped by category; everything else nests
  under whichever resource links to it.

### Known gap: missing timestamps

As of 2026-11-08, **63 of 162** resource notes (~39%) have no `timestamp`
field at all, and 2 more have an unresolved Templater placeholder
(`<% tp.frontmatter.timestamp %>`) instead of a real value. Both cases parse
to `null`/`undefined`.

Decision: these resources are **silently excluded** from anything that
buckets-by-date (the creation timeline below, and effectively from "Recent
Resources" since it sorts by timestamp descending). They still appear in the
hierarchy tree and the Active/Archived tables, which don't depend on a date.
No "N undated" counter exists yet — deliberately deferred, not an oversight.

## Views

1. **Resource Creation Timeline** (top of note) — see below.
2. **Recent Resources** — flat table, top 20 by `timestamp` descending.
3. **List of resources, and their subresources** — the parent/child tree,
   grouped by category, with a text filter.
4. **Active Resources** / **Archived Resources** — flat tables split on
   `#archive`.

## Resource Creation Timeline

`datacore/creationTimeline.jsx` (component) + `datacore/utils/timeline.js`
(pure bucketing logic, dc.require'd separately so it's unit-testable without
rendering anything — see `test/datacore/timeline-utils.test.js`).

```jsx
const CreationTimeline = await dc.require("Z. Meta/datacore/creationTimeline.jsx");
<CreationTimeline resources={resources} />
```

`resources` is the same array the rest of Resources.md already builds from
the query above — the timeline doesn't run its own query.

### Behavior

- **Range control**: preset buttons (Last week / 2 weeks / month / 3 months /
  6 months / year / All time) plus a custom date-range picker. "All time"
  starts at the oldest *dated* resource, not a fixed lookback.
- **Bucket granularity is adaptive**, not fixed, because the vault's
  timestamps span ~6.5 years (2020-05-09 → present) — a fixed daily bucket
  would make "All time" ~2,400 points. Rule (`granularityForSpan` in
  `timeline.js`): ≤31 days → daily, ≤365 days → weekly, beyond that →
  monthly. Applies to custom ranges too.
- **Zero-count buckets stay on the line at 0** rather than being skipped, so
  gaps and bursts are visible.
- **Panning slider** (above the chart, hidden for "All time" and custom
  ranges): drags the window's *anchor end* date backward/forward, so a
  fixed-size preset like "Last month" can show e.g. June 2024 instead of only
  the most recent 30 days. Implemented by reusing `resolveRange`'s existing
  `now` parameter as the anchor — the component passes the slider's value
  instead of the real `DateTime.now()` for pannable presets, so `timeline.js`
  needed no changes. Range bounds: oldest dated resource → today. A "Today"
  button resets the anchor to `null` (today). Switching presets resets the
  anchor too, so panning always starts from "most recent" for the newly
  picked window size.
- **Hover** a point → tooltip with the bucket's label, count, and resource
  names (capped at 8 inline, "+N more" beyond that).
- **Click** a point → selects it (single-select; click again to clear, click
  a different point to swap) and renders that bucket's resources as a
  `dc.Table` below the chart (Name / Timestamp / Tags columns), reusing the
  same `value: r => r.link` pattern the rest of `Resources.md` already uses
  for clickable links in `dc.Table` columns.
- Hand-rolled SVG — no charting library. None existed anywhere in this repo
  or in Datacore's own docs at the time this was built, and a single polyline
  + circles doesn't need one.

## Extension points (not built yet)

These came up while scoping the timeline and were explicitly deferred, not
forgotten:

- **Other note types.** `timeline.js` and `CreationTimeline` take a plain
  `resources`-shaped array and don't know about `type/resource` — reusing
  them for Areas/Projects/Books just means feeding a different query's
  output in. Nobody's asked for this yet.
- **Filters on the timeline itself** (by category, archived/active) — the
  hierarchy tree already filters by category; the timeline doesn't yet.
- **Surfacing the undated-resource gap** — currently invisible in the UI;
  could become a small counter/badge if it starts mattering.

## Testing

`test/datacore/timeline-utils.test.js` covers `resolveRange` and
`buildBuckets` in isolation (granularity stepping, undated exclusion, custom
range start/end order) via the same sucrase-eval harness
`projects-dashboard.test.js` uses, with `dc.luxon` added to
`createMockDc.js` to support it.

`test/datacore/creation-timeline.test.js` renders the actual chart component
with `@testing-library/preact` and asserts on the click → drill-down table
(columns, row data, toggle-off). Since `creationTimeline.jsx` itself does
`await dc.require("Z. Meta/datacore/utils/timeline.js")`, and the harness's
`createMockDc` doesn't implement `dc.require` (none of the earlier dashboard
tests needed it — `projects-dashboard.test.js` extracts a whole block, it
doesn't `dc.require` anything), this test attaches a small one-off
`dc.require` that resolves a vault path back to this repo's local file and
evals it through the same `runDatacoreBlock`. If more components start
needing this, it's worth promoting into `runBlock.js` as a shared helper
rather than copy-pasting the loader per test file.

Hover (tooltip content/positioning) and the panning slider's drag UX aren't
covered by either test file — both still rely on the manual Obsidian smoke
test described in `CLAUDE.md` § Datacore.
