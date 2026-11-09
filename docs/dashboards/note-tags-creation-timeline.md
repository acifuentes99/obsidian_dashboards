# Note/Tags Creation Timeline

A multi-series creation timeline added to the top of `Note and Tags By Recent
Datacore Version.md`, one line per note type, built on the same shared
`datacore/creationTimeline.jsx` + `datacore/utils/timeline.js` the [Resources
dashboard](resources-creation-timeline.md) already uses — see that doc for
the base single-series behavior (range presets, panning slider, adaptive
bucket granularity) this inherits unchanged.

```jsx
const CreationTimeline = await dc.require("Z. Meta/datacore/creationTimeline.jsx");
<CreationTimeline
    resources={chartResources}
    seriesOrder={SERIES_ORDER}
    seriesLabels={SERIES_LABELS}
    defaultRangeId="180d"
/>
```

## Why this dashboard needed its own design pass

This dashboard's underlying query (`@page and supertree(!#journal and
!#dashboard and (path("B. Note Box") or path("A. PARA Notes")))`) scans
roughly **2,200 notes**, an order of magnitude more than Resources' `#type/resource`
query (~210 notes). Before adding a chart here, two things were checked:

- **Can the date window be pushed into the query string itself** (so Datacore
  never fetches notes outside the selected range)? No — the `timestamp`
  frontmatter field is inconsistently typed across the vault: some notes have
  ISO datetimes, some a bare `YYYYMMDDHHmm` integer, and roughly **half**
  (1,058 of 2,234 candidate notes) have no `timestamp` at all. A query-string
  date comparison can't coerce the numeric form, so it would silently drop
  notes rather than correctly filter them — the dashboard's own `getTimestamp()`
  helper already does this coercion in JS for exactly that reason. `$ctime`
  (file creation time) is always present and query-filterable, but it tracks
  when a file was created on disk, not the note's semantic `timestamp` — they
  diverge for backfilled/migrated notes, so it wasn't used as a stand-in.
- **Given that, where does the performance saving come from?** The query
  stays exactly as broad as today. The date-range selector (default 6
  months, same JS-side approach Resources already uses) filters the
  already-fetched array *before* the per-type bucketing work runs, rather
  than literally shrinking the query. With ~2,200 rows this is a single cheap
  array pass regardless — the point of windowing by default is to keep the
  chart itself readable and the bucket count small (6 months → weekly
  buckets; "All time" over the vault's ~6.5-year span → monthly), not to cut
  query cost.

## Series

**Revised**: every recognized `#type/*` tag now gets its own line — not
folded into a shared "Other" bucket. (An earlier version of this dashboard
grouped the long tail into one Other line to keep the chart simple; the
explicit list below, and "one line each," came from a follow-up
clarification overriding that choice.) Fixed, non-cycled order
(`SERIES_ORDER` in the dashboard's block, mirrored by `SERIES_LABELS`):

| id | label | matches |
|---|---|---|
| `project` | Project | `#type/project` |
| `resource` | Resource | `#type/resource` |
| `area` | Area | `#type/area` |
| `note-contact` | Note (contact) | `#type/note/contact` |
| `note-checklist` | Note (checklist) | `#type/note/checklist` |
| `note-brainstorm` | Note (brainstorm) | `#type/note/brainstorm` |
| `note-documentation` | Note (documentation) | `#type/note/documentation` |
| `note-list` | Note (list) | `#type/note/list` |
| `note-research` | Note (research) | `#type/note/research` |
| `note-study` | Note (study) | `#type/note/study` |
| `note-summary` | Note (summary) | `#type/note/summary` |
| `note-thoughts` | Note (thoughts) | `#type/note/thoughts` |
| `note-articlenote` | Note (article note) | `#type/note/articlenote` |
| `note-book` | Note (book) | `#type/note/book` |
| `note-experience` | Note (experience) | `#type/note/experience` |
| `note-default` | Note (default) | `#type/note/default` |
| `other` | Other | any `#type/*` tag not above, or no type tag at all |

16 real series + `other` = 17 lines. `other` stays a true residual — an
untagged note and a note with some future/unrecognized `#type/*` tag get
exactly the same treatment, no distinction between them beyond the
drill-down table's Type column (which still shows the raw tag if one
exists, or "untyped" if not). A note matching more than one tag counts
toward exactly one series via `resolveSeries()`'s top-to-bottom precedence
in the dashboard's block — the same precedence order this dashboard's
pre-existing `getEmojiPrefix()` uses for its emoji markers (with one
addition: `getEmojiPrefix()` has no explicit `#type/note/default` branch,
so an untagged note and a `note/default` note get the same ❓ emoji there;
`resolveSeries()` does distinguish them, since `note-default` has its own
guaranteed series here).

`buildBuckets()` in `timeline.js` takes an optional `seriesKey(resource)`
extractor: given one, each bucket gets a `series: { [id]: { count, items } }`
map alongside its existing aggregate `count`/`items`; omitted (as Resources
does), the bucket shape is byte-identical to before. `creationTimeline.jsx`
branches on whether a `seriesOrder` prop is passed — no prop keeps the
original single-line chart (no legend, plain `data-key` attributes, same
tooltip/click behavior); with it, every point gets both `data-key` and
`data-series`, and there's a clickable legend (toggles a line's visibility,
all on by default — plus "Select all"/"Select none" buttons above the
legend to toggle every line at once, since clicking all 17 individually to
isolate one or two is tedious). Hover is scoped to the one line/bucket pair
under the cursor (tooltip shows that series' label, count, and item names). Click is
not — clicking any one series' point drills into the whole bucket (every
series' notes for that day/week/month, via `buildBuckets`' aggregate
`count`/`items`, which it always keeps alongside the per-series `series`
map), not just the clicked line. The drill-down table's Type column is what
tells the mixed-type rows apart.

Selection is range-capable and keyed purely by bucket, never by series:
clicking a point sets both an anchor and head bucket key to it; Shift-click
another point (any series — which line you click doesn't matter, only its
bucket) moves the head, and every bucket between anchor and head
(inclusive, order-independent) gets selected. The drill-down table merges
all selected buckets' items into one list, titled with the bucket range
(`First label – Last label`) when more than one bucket is selected. A plain
click (no Shift) always collapses the selection back to that one bucket;
clicking the same single already-selected bucket again clears it. Selected
buckets get a faint `var(--interactive-accent)` background band across the
chart's full height, in addition to their enlarged point — this is shared
between single- and multi-series modes (same `selectedKeys` state, same
`buckets` array for index lookups), so Resources' chart gets range-select
for free.

## Drill-down table: sortable columns and the Name icon

`dc.Table` has no built-in column sort (checked against the real Datacore
docs — `TableColumn` has `value`/`render`/`title`/`width`, nothing
sort-related), so `creationTimeline.jsx` does it itself: `COLUMN_DEFS` keys
each column's `sortValue` accessor, clicking a column's `title` (a clickable
`<span>`, toggling `▲`/`▼`) sets `sortBy`/`sortDir` state, and the selected
items are sorted with that accessor *before* being handed to `dc.Table` as
`rows` — the table itself stays a passive renderer. Sort state persists
across different bucket/range selections (clicking a different dot doesn't
reset it). This is shared by both modes, so Resources' chart gets sortable
columns too, for free, same as range-select above.

The Name column's optional icon prefix is Note/Tags-specific: each
`chartResource` gets an `icon` field (`getEmojiPrefix(p, false)`, reusing
the dashboard's own pre-existing emoji-per-type function — so the chart's
icon always agrees with the emoji already shown in the week-grouped list
below it) which `COLUMN_DEFS.Name`'s `render` prefixes onto the link, per
Datacore's documented contract that JSX belongs in `render`, not `value`.
Resources' resources never set `.icon`, so its Name column renders exactly
as it did before — the fallback is `r.link` unchanged, not a blank icon.

**Gotcha this hit first try**: `render: (_v, r) => <>{r.icon} {r.link}</>` compiled
fine and ran without error, but only the icon showed — the link vanished.
`r.link` is a Datacore `Link` *literal*, not a plain string/element.
Table's own cell renderer (`useAsElement` in the plugin source,
`src/ui/hooks.tsx`) only converts a raw Literal into a real link element
when the column's `render`/`value` returns the Literal *directly*; once it's
one child inside a Fragment we return, the Fragment itself already counts
as "a valid element", so that conversion is skipped and Preact just drops
the un-renderable Link object as a child. Fix: wrap it explicitly with
`dc.Literal` — the public form of the same internal `Lit` component Table
uses (`<dc.Literal value={r.link} />` instead of bare `{r.link}`). The
mocked `dc` in this repo's test harness only ever hands the chart plain
strings for `link`, so this specific failure mode (something that only
breaks on a real `Link` object) couldn't have been caught by
`npm test` — it needed the manual Obsidian smoke test in `CLAUDE.md` §
Datacore to actually surface it.

## Colors

The first **8** non-`other` series (by position in `SERIES_ORDER`: Project,
Resource, Area, then Note contact/checklist/brainstorm) get one color each,
in **fixed order** — never reassigned by count or by which lines are
currently visible — from the dataviz skill's full default categorical
palette: blue, orange, aqua, yellow, magenta, green, violet, red
(`SERIES_PALETTE` in `creationTimeline.jsx`, light/dark variants switched
via `document.body.classList.contains("theme-dark")`, matching Obsidian's
own theme class rather than `prefers-color-scheme`, since a user can force
Obsidian dark while their OS is light). Validated with the skill's
`validate_palette.js` for the *adjacent*-pair case (this order is documented
as covering stacked/bar/line charts) at all 8 slots: light mode passes with
a contrast WARN on 3 colors, mitigated by the legend always showing a text
label next to each swatch rather than relying on color alone; dark mode
passes outright.

**Beyond those 8** (Note documentation/list/research/study/summary/
articlenote/book/experience — 8 more), `colorFor()` generates additional
hues by golden-angle spacing (`hue = index * 137.508° + 20°`, a standard
technique for visually well-spread categorical colors at counts a validated
palette doesn't cover) rather than cycling the 8 validated hues, which would
make two unrelated series look identical. These generated colors are **not**
CVD-validated — the dataviz skill's own guidance past 7-8 simultaneous
categorical series is to fold the tail into "Other" or facet, which is
exactly what this dashboard did before this revision. Going past that
ceiling here was an explicit, informed choice (made after being shown the
tradeoff) in exchange for every type getting a fully separable line; the
legend (plain text next to each swatch) and the drill-down table's Type
column (plain text, independent of color) are what keep a line's identity
from depending on color alone at this count, same mitigation the skill
requires even within the validated range.

**Other** gets neither path: the dataviz skill reserves a separate
"de-emphasis / Other" color role, distinct from the categorical ramps,
precisely so a true catch-all doesn't read as "just another category" with
equal visual weight to a real one. `colorFor()` special-cases
`seriesId === "other"` to a muted gray (`#898781` in both themes — the same
value the palette already uses for muted axis/label text, reused rather
than inventing a new tone) before falling through to the categorical/
generated lookup for every other id. Text in the legend stays in normal
ink regardless of path — only the swatch carries the series color.

## Animation

Three small, cheap touches (shared via `creationTimeline.jsx`, so both this
dashboard and Resources get them for free):

- **Scroll-in**: the whole chart fades and slides up once, the first time it
  scrolls into the viewport (`IntersectionObserver`, disconnects after
  firing). In environments with no `IntersectionObserver` (the test
  harness), it falls back to showing immediately — no animation, no crash.
- **Filter pulse**: whenever a range preset, custom range, or the panning
  slider actually changes the bucketed data, the chart area dims to ~35%
  opacity for 220ms and recovers via CSS transition — a visible "this just
  updated" cue instead of a silent, instant swap. Keyed off `buckets`
  itself, skipped on first mount, so it doesn't fire on initial render.
- **Point transitions**: marker circles get a CSS transition on `cx`/`cy`/`r`
  (not `points`/`d` — those have no CSS-animatable equivalent, so the
  polyline itself still redraws instantly). This mostly matters for
  selection: clicking a bucket to grow its dot from radius 3 to 6 animates
  rather than snapping, since that bucket's key — and thus its DOM node —
  persists across the re-render.

Not covered: cross-range transitions (switching "Last 30 days" to "Last
year" remounts almost every point, since bucket keys depend on the window),
and the line path itself. Both would need a tweened/interpolated redraw
(e.g. a RAF loop lerping bucket positions) rather than CSS, judged not worth
the complexity for this dashboard's scale.

## Testing

- `test/datacore/timeline-utils.test.js` — `buildBuckets({ seriesKey })`
  splits aggregate counts into a per-series breakdown; omitting `seriesKey`
  produces the old shape with no `series` key at all.
- `test/datacore/creation-timeline.test.js` — multi-series legend rendering,
  clicking either series' point for a shared bucket yields the identical
  combined (all-series) table, Shift-click range selection (across buckets,
  and across series — which line you Shift-click doesn't matter), a plain
  click collapsing a range back to one bucket, legend click hides a line's
  circles, column-header click-to-sort (ascending then descending, on the
  single-series chart — i.e. Resources gets the same coverage), the "other"
  series' swatch resolving to the muted gray rather than a categorical
  color, "Select none" then "Select all" toggling every line's circles off
  then back on, and a no-`seriesOrder` regression check that the original
  single-line chart is unchanged.
- `test/datacore/note-tags-dashboard.test.js` — extracts the real block from
  `Note and Tags By Recent Datacore Version.md` (same approach
  `projects-dashboard.test.js` uses for `Projects.md`) and checks the
  dashboard-local `resolveSeries()` end to end: clicking a bucket's point
  returns every note in it (project, resource, area, note/default,
  note/thoughts, a long-tail `#type/note/book`, and an untagged note), each
  row's Type column matching what `resolveSeries()` assigned and its Name
  column prefixed with the matching `getEmojiPrefix()` icon; a separate test
  checks the Name header sorts by the underlying note name (not the
  icon-prefixed display text). The legend test asserts all 17 lines render
  in the exact fixed order and that no two (including the golden-angle-
  generated tail) resolve to the same color. Needed two small additions to
  the shared mock harness along the way (`DCArray.limit()`, and `dc.List`
  flattening `groupBy()` groups) — this dashboard's pre-existing
  week-grouped list had no test coverage before, so nothing had exercised
  those paths yet.

Hover tooltip rendering and the legend's visual toggle state (vs. its
behavioral effect, which is tested) still rely on the manual Obsidian smoke
test described in `CLAUDE.md` § Datacore.
