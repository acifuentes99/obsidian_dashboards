# Area Projects

A "Projects" section embeddable in any Area note, showing the projects
related to that area: a status-count badge row, and a table sorted by how
soon each project's `target` date is, with a "days until target" column.

```datacorejsx
const AreaProjects = await dc.require("Z. Meta/datacore/areaProjects.jsx");
return function View() {
    return <AreaProjects />;
}
```

## How a project is "related to" an area

A project belongs to an area via its own `area` frontmatter field (a
`[[Wikilink]]` to the Area note — already in use on at least one real
project note; see the "Obsidian Dashboards 1st iteration Project" note).
`datacore/utils/areaProjects.js`'s `matchesArea` accepts either shape
Datacore might hand back for that field: a plain `[[Wikilink]]` /
`[[Wikilink|Alias]]` string (matched by name, alias ignored) or a
Datacore-parsed `Link` object (matched by `.path`), and either a single
value or an array of them (a project with more than one area).

This was chosen over Datacore's `connected([[...]])` query predicate (used
by `projectNotes.jsx` for a different purpose) because `connected` matches
*any* link relationship with the area note, including a stray mention in a
project's body — `area` is a dedicated field, so matching it directly is
the precise relationship this section means to show.

## Status buckets

Reuses the same five buckets Projects.md shows, via a dedicated
`categorizeProject` in `datacore/utils/areaProjects.js` rather than
Projects.md's inline logic (see the "Project status bucket" glossary entry
for why: priority-ordered and mutually exclusive, which Projects.md's
version isn't quite). The badge row always shows all five counts, in fixed
order (Active, Cold Tasks, Backlog, Archived, Done), each colored with one
of `creationTimeline.jsx`'s 8 dataviz-skill-validated categorical hues (not
re-derived here — see that file and
`docs/dashboards/note-tags-creation-timeline.md` for the palette's
validation).

## Target date and "days until target"

A new optional `target` frontmatter field on project notes (a date) — not
used anywhere else in this repo yet. `daysUntilTarget` (whole days, rounded
up, negative once past) and `formatDaysUntil` turn it into "in Nd" / "Due
today" / "Nd overdue" / "—" (no target set). The table sorts by this
ascending, with no-target projects always last regardless of direction —
done via a key function mapping a missing target to `Infinity`, the same
`DataArray`-style `.sort(key, direction)` Projects.md already uses (not a
native comparator — DataArray's own `.sort()` has a different signature,
and silently misinterprets a comparator function as a key function instead;
see this dashboard's test suite for the regression that caught it).
Overdue rows render in `var(--color-red)`, due within a week in
`var(--color-orange)`, further out or unset left unstyled/muted.

Only `active`/`backlog`/`coldtask` projects show in the table by default —
`done`/`archived` ones are typically no longer working toward their target —
behind a "Show done/archived" toggle.

## Created column

Reuses `commons.js`'s `getTimestamp(dc, row)` for the `timestamp` frontmatter
field — not a 4th copy of it (Projects.md, the Note/Tags dashboard, and
commons.js itself already each have one) — since project notes share the
same vault-wide inconsistency (ISO datetime vs. a bare `YYYYMMDDHHmm`
integer; see `docs/dashboards/note-tags-creation-timeline.md`) that function
already coerces. Shown as-is, doesn't affect the table's sort order.

## Timeline

A second, separate presentational component, `datacore/areaProjectsTimeline.jsx`
(`dc.require`d and rendered by `areaProjects.jsx` itself, fed the same
`projects` array the badges/table already computed — no second query),
renders one horizontal bar per dated project: start = `created`, end =
whichever resolved date applies, or `null` (still open) — drawn as a faded
"ongoing" bar running through to today instead of stopping at a fixed point.
Shows **every** matching project regardless of status, independent of the
table's "Show done/archived" toggle, since the point here is the area's
whole history, not just what's still active.

- **End date — bucket-aware, not just "whichever is set"**:
  `resolveProjectEnd` in `utils/areaProjects.js` picks the project's
  *actual* resolution date for a resolved bucket — `doneDate` for `done`,
  `archivedDate` for `archived`, `coldDate` for `coldtask` — falling back to
  `target` only if that bucket's own date isn't set. Only `active`/`backlog`
  (no resolution date at all) use `target` directly. This matters because a
  project can have both: a `target` set when it started, still sitting in
  frontmatter after it was later marked done. Using `target ?? doneDate ?? …`
  (the first, wrong version of this) would draw the bar to the *planned*
  date instead of when the project *actually* finished.
- **Hover tooltip**: hovering a bar shows its creation date and the
  resolved end, labeled by what it actually is (`Target` for an open
  project, `Done`/`Archived`/`Paused` for a resolved one) rather than a
  generic "end" — `end` alone doesn't say which field it came from, so the
  tooltip's label comes from the row's `bucket` instead.
- **Window + scrolling**: a row of range-preset buttons (reusing a curated
  subset of `timeline.js`'s own `RANGE_PRESETS` ids — `90d`/`180d`/`365d`/
  `730d`/`all` — rather than forking a second preset list, since
  `resolveRange` looks ids up in that module's own hardcoded array, not a
  parameter) plus ◀/▶ buttons that shift an `anchor` date by the active
  preset's span, and a "Today" button that jumps back. `all` isn't reused
  as-is: timeline.js's own "all" branch stops at *now*, but a project's bar
  can run past today (a future `target`), so `resolveTimelineWindow` here
  spans from the earliest `created` to the furthest `end`-or-target across
  every row instead.
- **Clamped bars**: a bar that starts before, or (still) runs past, the
  visible window gets a small ‹/› arrow rather than being silently cut off
  with no indication there's more outside the frame.
- **Today marker**: a vertical line across all rows when today falls inside
  the current window, absent otherwise (e.g. after panning away from it).
- Rows with no `created` date can't be placed on the axis and are skipped,
  with a count shown below ("N project(s) with no creation date aren't
  shown here.").

Two gotchas carried over from elsewhere in this repo, deliberately avoided
here rather than rediscovered the hard way:

- **The `dc.Literal` gotcha** (`docs/dashboards/note-tags-creation-timeline.md`):
  a row's `link` is a real Datacore `Link`, not a string — rendered via
  `<dc.Literal value={r.link} />`, not `{r.link}`, since it's one child
  among several in that row's JSX rather than a bare returned value.
  Confirmed by test (fixtures use plain strings for `link`, so this is a
  production-only path the test harness can't catch).
- **The `DataArray.sort()` gotcha** (this dashboard's own table, above):
  `rows` here can be a Datacore DataArray (from `areaProjects.jsx`) or a
  plain array (tests) — rather than relying on which one it happens to be,
  it's normalized to a plain array (`Array.from(rows)`) before any sorting,
  so a native comparator (`(a, b) => a.created - b.created`) behaves
  correctly regardless of the input's real type.

## Gotcha: a trailing comment can swallow the block's closing syntax

Hit on first real-world use: the header comment above originally showed the
bare-usage shorthand (`<AreaProjects />  // current note is the Area note`,
no `return` wrapper) as a one-line illustration of the props, not as a
pasteable block. Someone copied it in verbatim anyway, and it failed with
`SyntaxError: Unexpected end of input` rather than just rendering nothing.
Why a *syntax* error: Datacore evaluates a block by wrapping its source in
something like `(async () => { <your code> })()`, appending its own closing
syntax immediately after your code with no newline in between. A same-line
trailing `//` comment as the last thing in the block comments out that
appended closing syntax too, leaving the wrapper function unterminated.
Fixed by rewriting the header comment to show the full, correct,
copy-pasteable block (with the required `return function View() {...}`
wrapper) instead of the shorthand — see `datacore/areaProjects.jsx`.

## Adding this to an Area note

Area notes aren't part of this repo (they live in the vault's `A. PARA
Notes/Areas/`, not one of the three folders this repo mirrors), so this
section can't be baked into a git-tracked template here. Instead,
`quickadd-scripts/insert-area-projects-dashboard.js` is a one-off QuickAdd
command (same shape as `status-date-backfill.js`) that appends the block
above to the active note, if it's tagged `type/area` and doesn't already
have it. Wire it as a macro step after "From Template: Area" so every new
Area note gets it automatically, and run it manually once per existing Area
note to backfill.

## Testing

- `test/datacore/area-projects-utils.test.js` — `categorizeProject`'s
  priority/exclusivity (including the inconsistent-frontmatter case),
  `matchesArea` against every frontmatter shape above,
  `daysUntilTarget`/`formatDaysUntil` across future/past/today/missing,
  `resolveProjectEnd` (a resolved bucket's own date beating a `target` it
  still has set, each bucket falling back to `target` when it has no date
  of its own, and active/backlog always using `target`), and the timeline's
  `barGeometry`/`todayMarkerPct`/`resolveTimelineWindow` (containment,
  left/right clamping, open-ended bars stopping at "now" not the window
  edge, and `all`'s future-reaching span).
- `test/datacore/area-projects.test.js` — filtering to only the current
  area's projects, the five count badges, the done/archived toggle, target-
  date sort order (including the `Infinity`-key regression above), overdue
  vs. upcoming formatting, and the Created column (including the
  bare-integer timestamp format).
- `test/datacore/area-projects-timeline.test.js` — chronological row order,
  the skipped-rows count, the today marker appearing/disappearing as the
  window pans, range-preset switching, panning disabled on `all`, the
  clamped-bar arrows, the open-ended-bar marker, and the hover tooltip's
  creation date + bucket-labeled resolved end.
