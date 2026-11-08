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
buckets-by-date (the [creation timeline](resources-creation-timeline.md), and
effectively from "Recent Resources" since it sorts by timestamp descending).
They still appear in the
hierarchy tree and the Active/Archived tables, which don't depend on a date.
No "N undated" counter exists yet — deliberately deferred, not an oversight.

## Views

1. **Resource Creation Timeline** (top of note) — behavior, implementation
   notes, and test coverage are split into their own doc since this part
   changes independently of (and more often than) the rest of the dashboard:
   see [resources-creation-timeline.md](resources-creation-timeline.md).
2. **Recent Resources** — flat table, top 20 by `timestamp` descending.
3. **List of resources, and their subresources** — the parent/child tree,
   grouped by category, with a text filter.
4. **Active Resources** / **Archived Resources** — flat tables split on
   `#archive`.

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
